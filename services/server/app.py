
# -*- coding: utf-8 -*-
"""
大理此刻 - 后端 API 服务 (Python Flask 版)
============================================
为微信小程序提供 MySQL 数据存取接口
端口: 3000
"""
import json, os, uuid, pymysql, base64, threading, secrets, hashlib, time as time_mod
from datetime import datetime
try:
    from urllib.request import urlopen
except ImportError:
    from urllib2 import urlopen
from werkzeug.utils import secure_filename
from flask import Flask, request, jsonify, send_from_directory, g
from functools import wraps
from flask_cors import CORS
from config import (
    DB_CONFIG, UPLOAD_DIR, ALLOWED_EXTENSIONS, IMAGES_DIR,
    MAX_CONTENT_LENGTH, MIN_MATCH_LENGTH, DEFAULT_SENSITIVE_FIELDS,
    DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, IMAGE_PROFILES, SERVER_PORT,
    DEFAULT_NICKNAME, WECHAT_APPID, WECHAT_SECRET,
    API_SECRET, SIGNATURE_WINDOW_SECONDS, RATE_LIMIT_GENERAL, RATE_LIMIT_SEARCH
)
app = Flask(__name__)
CORS(app, supports_credentials=True)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# ============================================================
# 频率限制（零依赖，Python 3.6+ 可用）
# 信任 Nginx 反代的 X-Real-IP / X-Forwarded-For
# ============================================================
_rate_limit_store = {}      # {ip: [timestamps...]}
_rate_lock = threading.Lock()

def _get_client_ip():
    """获取客户端真实 IP（兼容 Nginx 反代）"""
    return request.headers.get('X-Real-IP') or \
           (request.headers.get('X-Forwarded-For', '').split(',')[0].strip()) or \
           request.remote_addr or '127.0.0.1'

def _parse_rate(rate_str):
    """解析 '100 per minute' 或 '30 per minute' → (max_req, window_sec)"""
    parts = rate_str.strip().split()
    if len(parts) == 3 and parts[1] == 'per':
        max_req = int(parts[0])
        unit = parts[2].lower()
        if 'minute' in unit:
            return max_req, 60
        elif 'second' in unit:
            return max_req, 1
        elif 'hour' in unit:
            return max_req, 3600
    return 100, 60  # 默认兜底

def _rate_limit_check(rate_str):
    """检查当前请求是否超频，返回 True 表示被限制"""
    max_req, window = _parse_rate(rate_str)
    ip = _get_client_ip()
    now = time_mod.time()
    cutoff = now - window

    with _rate_lock:
        if ip not in _rate_limit_store:
            _rate_limit_store[ip] = []
        ts_list = _rate_limit_store[ip]
        # 清理窗口外的旧记录
        while ts_list and ts_list[0] < cutoff:
            ts_list.pop(0)
        if len(ts_list) >= max_req:
            return True
        ts_list.append(now)

    # 定期全量清理过期 IP（每次请求时概率触发）
    if not hasattr(_rate_limit_check, '_clean_counter'):
        _rate_limit_check._clean_counter = 0
    _rate_limit_check._clean_counter += 1
    if _rate_limit_check._clean_counter % 1000 == 0:
        with _rate_lock:
            dead = [k for k, v in _rate_limit_store.items() if not v or v[-1] < cutoff]
            for k in dead:
                del _rate_limit_store[k]
    return False

def rate_limit(rate_str):
    """装饰器：单路由频率限制"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if _rate_limit_check(rate_str):
                return jsonify({'code': -1, 'msg': '请求过于频繁，请稍后重试'}), 429
            return f(*args, **kwargs)
        return wrapper
    return decorator

# 注入全局 before_request 做通用限频
@app.before_request
def _global_rate_limit():
    if _rate_limit_check(RATE_LIMIT_GENERAL):
        return jsonify({'code': -1, 'msg': '请求过于频繁，请稍后重试'}), 429

# 上传目录配置
os.makedirs(UPLOAD_DIR, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# ============================================================
# API 认证装饰器
# ============================================================
def login_required(f):
    """验证 Authorization: Bearer <token>，注入 g.current_user"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        token = None
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
        if not token:
            return jsonify({'code': -1, 'msg': '请先登录'}), 401
        rows = query('SELECT * FROM users WHERE token = %s', [token])
        if not rows:
            return jsonify({'code': -1, 'msg': '登录已过期，请重新登录'}), 401
        user = rows[0]
        # 检查封禁状态
        if user.get('status') == 'disabled':
            return jsonify({'code': -1, 'msg': '账号已被禁用'}), 403
        if user.get('status') == 'muted' and user.get('ban_until'):
            from datetime import datetime as dt
            ban_until = user['ban_until']
            if isinstance(ban_until, str):
                ban_until = dt.strptime(ban_until, '%Y-%m-%d %H:%M:%S') if ' ' in ban_until else dt.strptime(ban_until, '%Y-%m-%d')
            if dt.now() > ban_until:
                execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=NULL WHERE id=%s', ['active', user['id']])
                user['status'] = 'active'
        g.current_user = user
        return f(*args, **kwargs)
    return wrapper

# ============================================================
# GET 请求签名验证（防第三方恶意调用）
# ============================================================
SKIP_SIGNATURE_PATHS = {'/api/user/login', '/api/health', '/api/sensitive/reload', '/api/config'}

def _compute_get_sign(timestamp, nonce, method, path, secret):
    raw = '{}|{}|{}|{}|{}'.format(timestamp, nonce, method, path, secret)
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()

@app.before_request
def verify_get_signature():
    """GET 请求必须携带有效签名（白名单除外）"""
    if request.method != 'GET':
        return  # POST/PUT/DELETE 由 @login_required 保护
    path = request.path
    if path.startswith('/uploads/') or path.startswith('/images/') or path.startswith('/api/admin/'):
        return
    if path.rstrip('/') in SKIP_SIGNATURE_PATHS or any(path.startswith(p) for p in ['/api/config/']):
        return

    timestamp = request.headers.get('X-Timestamp', '')
    nonce = request.headers.get('X-Nonce', '')
    sign = request.headers.get('X-Sign', '')

    if not timestamp or not nonce or not sign:
        return jsonify({'code': -1, 'msg': '请求缺少签名参数，请通过小程序访问'}), 401

    try:
        ts = int(timestamp)
    except (ValueError, TypeError):
        return jsonify({'code': -1, 'msg': '签名格式错误'}), 401

    now_ms = int(time_mod.time() * 1000)
    if abs(now_ms - ts) > SIGNATURE_WINDOW_SECONDS * 1000:
        return jsonify({'code': -1, 'msg': '请求签名已过期'}), 401

    expected = _compute_get_sign(timestamp, nonce, request.method, request.path, API_SECRET)
    if sign != expected:
        return jsonify({'code': -1, 'msg': '请求签名无效'}), 401

# ============================================================
# 数据库连接池（配置从 config.py 导入）
# ============================================================

_tlocal = threading.local()

def get_conn():
    """每个线程独立的连接，避免多线程并发 Packet sequence number 错误"""
    conn = getattr(_tlocal, 'conn', None)
    try:
        if conn is not None:
            conn.ping(reconnect=True)
            return conn
    except Exception:
        conn = None
    conn = pymysql.connect(**DB_CONFIG)
    _tlocal.conn = conn
    return conn

def query(sql, params=None):
    """执行 SQL 查询并返回结果"""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params or [])
        return cur.fetchall()

def execute(sql, params=None):
    """执行写入 SQL"""
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, params or [])
        conn.commit()
        return cur.lastrowid

def ok(data=None, msg='ok'):
    return jsonify({'code': 0, 'data': data, 'msg': msg})

def fail(msg='error', data=None):
    resp = {'code': -1, 'msg': msg}
    if data is not None:
        resp['data'] = data
    return jsonify(resp)

def get_pagination():
    """从请求参数提取分页信息，兼容 page/size 和 limit/offset"""
    page = int(request.args.get('page', DEFAULT_PAGE))
    size = int(request.args.get('size', DEFAULT_PAGE_SIZE))
    # 限制最大页大小，防止查询过载
    if size > MAX_PAGE_SIZE:
        size = MAX_PAGE_SIZE
    # 兼容旧版 limit/offset 方式
    if request.args.get('limit') and 'page' not in request.args:
        limit = int(request.args.get('limit', DEFAULT_PAGE_SIZE))
        offset = int(request.args.get('offset', 0))
        size = min(limit, MAX_PAGE_SIZE)
        page = (offset // limit) + 1 if limit > 0 else 1
    return page, size, (page - 1) * size

# ============================================================
# DFA 敏感词引擎
# ============================================================
_dfa = {'root': {}}
_dfa_loaded = False

def _build_dfa(words):
    root = {}
    for word in words:
        # 跳过单字词（它们几乎全是误报源）
        if not word or len(word) < MIN_MATCH_LENGTH:
            continue
        node = root
        for ch in word:
            if ch not in node:
                node[ch] = {}
            node = node[ch]
        node['_end'] = True
    return root

def scan_text(text):
    """扫描文本，返回命中敏感词列表"""
    if not text or not isinstance(text, str):
        return []
    root = _dfa['root']
    if not root:
        return []
    hits = []
    n = len(text)
    i = 0
    while i < n:
        node = root
        j = i
        match_end = -1
        while j < n and text[j] in node:
            node = node[text[j]]
            j += 1
            if node.get('_end'):
                match_end = j
        if match_end > i:
            hits.append(text[i:match_end])
            i = match_end
        else:
            i += 1
    return hits

def reload_dfa():
    """从 DB 重新加载 DFA 词库"""
    global _dfa, _dfa_loaded
    try:
        rows = query("SELECT word FROM sensitive_words WHERE enabled = 1 ORDER BY id ASC")
        words = [r['word'] for r in rows]
        _dfa['root'] = _build_dfa(words)
        _dfa_loaded = True
        return len(words)
    except Exception:
        return 0

# 启动时加载词库
reload_dfa()

# 敏感词过滤辅助函数（供各路由使用）
def check_sensitive_fields(body, fields=None):
    """检查请求 body 中指定字段是否包含敏感词，返回命中详情或 None"""
    if not body or not isinstance(body, dict):
        return None
    if fields is None:
        fields = DEFAULT_SENSITIVE_FIELDS
    all_hits = []
    for field in fields:
        value = body.get(field)
        if isinstance(value, str):
            hits = scan_text(value)
            if hits:
                all_hits.append({'field': field, 'hits': hits})
    if all_hits:
        details = '; '.join(f"[{h['field']}] {'、'.join(h['hits'])}" for h in all_hits)
        return details
    return None

# ============================================================
# 敏感词 API
# ============================================================

@app.route('/api/sensitive/check')
def sensitive_check():
    """预检文本是否包含敏感词"""
    text = request.args.get('text', '')
    hits = scan_text(text)
    if hits:
        return jsonify({'code': -1, 'passed': False, 'hits': hits, 'msg': f'内容包含 {len(hits)} 处敏感词'})
    return jsonify({'code': 0, 'passed': True, 'hits': [], 'msg': 'ok'})

@app.route('/api/sensitive/words')
def sensitive_words():
    """列出所有敏感词（分页）— 管理功能已屏蔽，返回空数据"""
    page, size, offset_val = get_pagination()
    return ok({'list': [], 'total': 0, 'page': page, 'size': size})

@app.route('/api/sensitive/words', methods=['POST'])
def sensitive_add_word():
    """新增敏感词 — 管理功能已屏蔽"""
    return fail('敏感词管理功能已禁用')

@app.route('/api/sensitive/words/<int:wid>', methods=['DELETE'])
def sensitive_delete_word(wid):
    """删除敏感词 — 管理功能已屏蔽"""
    return fail('敏感词管理功能已禁用')

@app.route('/api/sensitive/reload', methods=['POST'])
def sensitive_reload():
    """热更新词库"""
    try:
        count = reload_dfa()
        return jsonify({'code': 0, 'msg': f'词库已重新加载，当前词数: {count}'})
    except Exception as e:
        return fail(str(e))

# ============================================================
# 健康检查
# ============================================================
@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': datetime.now().isoformat()})

# ============================================================
# 图片上传
# ============================================================
@app.route('/api/upload/image', methods=['POST'])
def upload_image():
    """上传单张图片（管理后台用），服务端压缩 + 转 WebP；返回访问URL"""
    try:
        f = request.files.get('file')
        if not f or f.filename == '':
            return fail('未选择文件')
        if not allowed_file(f.filename):
            return fail('不支持的文件格式')
        file_data = f.read()

        # 服务端统一压缩处理（管理后台原图通常很大）
        from image_utils import process_image
        p = IMAGE_PROFILES['cover']
        processed_data, out_ext = process_image(
            file_data,
            max_width=p['max_width'], max_height=p['max_height'],
            quality=p['quality'], output_format='webp'
        )
        ext = (out_ext or f.filename.rsplit('.', 1)[1].lower())
        safe_name = uuid.uuid4().hex + '.' + ext
        date_dir = datetime.now().strftime('%Y%m')
        dir_path = os.path.join(UPLOAD_DIR, date_dir)
        os.makedirs(dir_path, exist_ok=True)
        save_path = os.path.join(dir_path, safe_name)
        with open(save_path, 'wb') as fout:
            fout.write(processed_data)
        rel_path = f'uploads/{date_dir}/{safe_name}'
        return ok({
            'url': rel_path,
            'full_url': f'/{rel_path}'
        })
    except Exception as e:
        return fail(str(e))

@app.route('/api/upload/image_base64', methods=['POST'])
@login_required
def upload_image_base64():
    """通过 base64 上传图片（小程序用），客户端已压缩，服务端补做格式转换 + 高度限制"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return fail('无效的请求数据')
        img_b64 = data.get('data')
        ext = data.get('ext', 'jpg').lower()
        if not img_b64:
            return fail('缺少图片数据')
        if ext not in ALLOWED_EXTENSIONS:
            return fail('不支持的图片格式')
        # base64 解码
        try:
            img_bytes = base64.b64decode(img_b64)
        except Exception:
            return fail('base64 解码失败')

        # 服务端补做处理：转 WebP + 强制高度限制（客户端仅限宽不限高）
        from image_utils import process_image
        p = IMAGE_PROFILES['gallery']
        processed_data, out_ext = process_image(
            img_bytes,
            max_width=p['max_width'], max_height=p['max_height'],
            quality=p['quality'], output_format='webp'
        )
        ext = (out_ext or ext)
        safe_name = uuid.uuid4().hex + '.' + ext
        date_dir = datetime.now().strftime('%Y%m')
        dir_path = os.path.join(UPLOAD_DIR, date_dir)
        os.makedirs(dir_path, exist_ok=True)
        save_path = os.path.join(dir_path, safe_name)
        with open(save_path, 'wb') as f:
            f.write(processed_data)
        rel_path = f'uploads/{date_dir}/{safe_name}'
        return ok({
            'url': rel_path
        })
    except Exception as e:
        return fail(str(e))


@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    """提供上传文件的静态访问"""
    return send_from_directory(UPLOAD_DIR, filename)

@app.route('/images/<path:filename>')
def serve_images(filename):
    """提供种子图片的静态访问"""
    return send_from_directory(IMAGES_DIR, filename)

# ============================================================
# 区域
# ============================================================
@app.route('/api/districts')
def get_districts():
    try:
        page, size, offset_val = get_pagination()
        total = query('SELECT COUNT(*) as total FROM districts')[0]['total']
        rows = query('SELECT * FROM districts ORDER BY sort_order ASC LIMIT %s OFFSET %s', [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

# ============================================================
# 景区（公开 API，供小程序搜索选择）
# ============================================================
@app.route('/api/scenic-spots')
def get_scenic_spots():
    try:
        keyword = request.args.get('keyword', '')
        sel_fields = 'id, name, cover, description, ticket_type, ticket_price, ticket_note, open_time, close_time, level, sort_order'
        if keyword:
            like_pattern = '%' + '%'.join(list(keyword)) + '%'
            rows = query(
                f'SELECT {sel_fields} FROM scenic_spots WHERE name LIKE %s AND status=%s ORDER BY sort_order ASC LIMIT 50',
                [like_pattern, 'active']
            )
        else:
            rows = query(
                f'SELECT {sel_fields} FROM scenic_spots WHERE status=%s ORDER BY sort_order ASC LIMIT 200',
                ['active']
            )
        return ok(rows)
    except Exception as e:
        return fail(str(e))

@app.route('/api/scenic-spots/<int:sid>')
def get_scenic_spot_detail(sid):
    try:
        rows = query('SELECT * FROM scenic_spots WHERE id=%s', [sid])
        if not rows:
            return fail('景区不存在')
        return ok(rows[0])
    except Exception as e:
        return fail(str(e))

# ============================================================
# 活动
# ============================================================
@app.route('/api/activities')
def get_activities():
    try:
        district = request.args.get('district')
        atype = request.args.get('type')
        status = request.args.get('status', 'active')
        date = request.args.get('date')
        page, size, offset_val = get_pagination()
        order_by = request.args.get('orderBy', 'hot_value')
        order_dir = request.args.get('orderDir', 'desc').upper()

        base_sql = "SELECT * FROM activities WHERE review_status='approved' AND publish_status='listed'"
        count_sql = "SELECT COUNT(*) as total FROM activities WHERE review_status='approved' AND publish_status='listed'"
        params = []

        if district:
            cond = ' AND district_code = %s'
            base_sql += cond; count_sql += cond
            params.append(district)
        if atype:
            cond = ' AND type = %s'
            base_sql += cond; count_sql += cond
            params.append(atype)
        if status:
            cond = ' AND status = %s'
            base_sql += cond; count_sql += cond
            params.append(status)
        if date:
            cond = ' AND date = %s'
            base_sql += cond; count_sql += cond
            params.append(date)

        total = query(count_sql, params[:])[0]['total']
        base_sql += f' ORDER BY {order_by} {order_dir}'
        base_sql += ' LIMIT %s OFFSET %s'
        rows = query(base_sql, params + [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/activities/<aid>')
def get_activity(aid):
    try:
        rows = query('SELECT * FROM activities WHERE id = %s', [aid])
        if not rows:
            return fail('活动不存在')
        act = rows[0]
        # 标签
        tags = query('SELECT tag FROM activity_tags WHERE activity_id = %s', [aid])
        act['tags'] = [t['tag'] for t in tags]
        # 图片
        images = query('SELECT image_url FROM activity_images WHERE activity_id = %s ORDER BY sort_order ASC', [aid])
        act['images'] = [i['image_url'] for i in images]
        return ok(act)
    except Exception as e:
        return fail(str(e))

@app.route('/api/activities/<aid>', methods=['PUT'])
def update_activity(aid):
    try:
        data = request.get_json()
        fields = []
        params = []
        for key in ['date', 'date_start', 'date_end', 'status', 'name', 'type']:
            if key in data:
                fields.append(f'{key} = %s')
                params.append(data[key])
        if not fields:
            return fail('没有要更新的字段')
        params.append(aid)
        sql = f"UPDATE activities SET {', '.join(fields)} WHERE id = %s"
        execute(sql, params)
        return ok(None, '更新成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/activities/batch-update', methods=['PUT'])
def batch_update_activities():
    try:
        data = request.get_json()
        date_val = data.get('date')
        if not date_val:
            return fail('请提供日期')
        execute("UPDATE activities SET date = %s WHERE status = 'active'", [date_val])
        return ok(None, f'所有活动日期已更新为 {date_val}')
    except Exception as e:
        return fail(str(e))

@app.route('/api/activities/search/<keyword>')
def search_activities(keyword):
    try:
        page, size, offset_val = get_pagination()
        like = f'%{keyword}%'
        total = query(
            "SELECT COUNT(*) as total FROM activities WHERE name LIKE %s AND status = 'active' AND review_status='approved' AND publish_status='listed'",
            [like]
        )[0]['total']
        rows = query(
            "SELECT * FROM activities WHERE name LIKE %s AND status = 'active' AND review_status='approved' AND publish_status='listed' ORDER BY hot_value DESC LIMIT %s OFFSET %s",
            [like, size, offset_val]
        )
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

# ============================================================
# 打卡点
# ============================================================
def _attach_scenic_spot_names(points):
    """批量附加景区名称到打卡点列表"""
    spot_ids = list(set(p.get('scenic_spot_id') for p in points if p.get('scenic_spot_id')))
    if not spot_ids:
        for p in points:
            p['scenic_spot_name'] = ''
        return
    placeholders = ','.join(['%s'] * len(spot_ids))
    spot_rows = query(f'SELECT id, name FROM scenic_spots WHERE id IN ({placeholders})', spot_ids)
    spot_map = {s['id']: s['name'] for s in spot_rows}
    for p in points:
        p['scenic_spot_name'] = spot_map.get(p.get('scenic_spot_id'), '')

@app.route('/api/checkin/points')
def get_checkin_points():
    try:
        atype = request.args.get('type')
        activity_id = request.args.get('activity_id')
        keyword = request.args.get('keyword', '').strip()
        lat = request.args.get('latitude', type=float)
        lng = request.args.get('longitude', type=float)
        page, size, offset_val = get_pagination()

        base_sql = "SELECT * FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
        count_sql = "SELECT COUNT(*) as total FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
        params = []

        if atype:
            cond = ' AND type = %s'
            base_sql += cond; count_sql += cond
            params.append(atype)
        if activity_id:
            cond = ' AND activity_id = %s'
            base_sql += cond; count_sql += cond
            params.append(activity_id)

        # 关键字分词模糊检索：全词 + 首尾 bigram
        keyword_applied = False
        if keyword:
            kw = keyword.strip()
            patterns = []
            patterns.append('%' + kw + '%')                         # 全词匹配
            if len(kw) >= 2:
                bg = '%' + kw[:2] + '%'
                if bg not in patterns:
                    patterns.append(bg)                             # 首 bigram
            if len(kw) >= 4:
                bg = '%' + kw[-2:] + '%'
                if bg not in patterns:
                    patterns.append(bg)                             # 尾 bigram
            like_clauses = ' OR '.join(['(name LIKE %s OR description LIKE %s OR landmark LIKE %s)'] * len(patterns))
            cond = ' AND (' + like_clauses + ')'
            base_sql += cond; count_sql += cond
            for p in patterns:
                params.extend([p, p, p])
            keyword_applied = True

        total = query(count_sql, params[:])[0]['total']

        # 关键字无结果时：移除关键字条件，按距离回退
        if keyword_applied and total == 0 and lat is not None and lng is not None:
            # 重建 SQL，去掉关键字条件
            base_sql = "SELECT * FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
            count_sql = "SELECT COUNT(*) as total FROM checkin_points WHERE review_status='approved' AND publish_status='listed'"
            params = []
            if atype:
                cond = ' AND type = %s'
                base_sql += cond; count_sql += cond
                params.append(atype)
            if activity_id:
                cond = ' AND activity_id = %s'
                base_sql += cond; count_sql += cond
                params.append(activity_id)
            total = query(count_sql, params[:])[0]['total']
            # 按欧氏距离由近及远排序
            base_sql += ' ORDER BY (latitude - %s) * (latitude - %s) + (longitude - %s) * (longitude - %s) ASC LIMIT %s OFFSET %s'
            rows = query(base_sql, params + [lat, lat, lng, lng, size, offset_val])
            _attach_scenic_spot_names(rows)
            return ok({
                'list': rows, 'total': total, 'page': page, 'size': size,
                'fallback': True  # 标记为回退结果
            })

        if keyword_applied:
            kw = keyword.strip()
            base_sql += ' ORDER BY (CASE WHEN name LIKE %s THEN 4 WHEN name LIKE %s THEN 3 WHEN description LIKE %s THEN 2 WHEN landmark LIKE %s THEN 1 ELSE 0 END) DESC, popularity DESC LIMIT %s OFFSET %s'
            params.extend([kw + '%', '%' + kw + '%', '%' + kw + '%', '%' + kw + '%', size, offset_val])
        else:
            base_sql += ' ORDER BY popularity DESC LIMIT %s OFFSET %s'
            params.extend([size, offset_val])
        rows = query(base_sql, params)
        _attach_scenic_spot_names(rows)
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/checkin/points/<cid>')
def get_checkin_point(cid):
    try:
        rows = query('SELECT * FROM checkin_points WHERE id = %s', [cid])
        if not rows:
            return fail('打卡点不存在')
        point = rows[0]
        photos = query('SELECT * FROM checkin_photos WHERE checkin_id = %s ORDER BY created_at DESC', [cid])
        point['photos'] = photos
        # 附带景区名称
        if point.get('scenic_spot_id'):
            spots = query('SELECT name FROM scenic_spots WHERE id=%s', [point['scenic_spot_id']])
            point['scenic_spot_name'] = spots[0]['name'] if spots else ''
        else:
            point['scenic_spot_name'] = ''
        return ok(point)
    except Exception as e:
        return fail(str(e))

# 用户提交新打卡点（小程序端）
@app.route('/api/checkin/points/submit', methods=['POST'])
@login_required
def submit_checkin_point():
    try:
        data = request.get_json(force=True)
        cid = 'cp_' + uuid.uuid4().hex[:8]
        fields = ['id','name','type','scenic_spot_id','cover','latitude','longitude','description',
                  'angle','composition','best_time','crowd_level','crowd_peak',
                  'tips','taboos','landmark','popularity','charge_type','charge_price',
                  'charge_note','review_status']
        vals = [cid]
        int_fields = {'scenic_spot_id', 'popularity'}
        for f in fields[1:]:  # skip id
            v = data.get(f, '')
            if f in int_fields and v == '':
                vals.append(None)
            else:
                vals.append(v)
        vals.append('pending')  # review_status 用户提交默认待审核
        execute(f"INSERT INTO checkin_points ({','.join(fields)}) VALUES ({','.join(['%s']*len(fields))})", vals)
        return ok({'id': cid}, '提交成功，等待管理员审核')
    except Exception as e:
        return fail(str(e))

# 用户提交新活动（小程序端）
@app.route('/api/activities/submit', methods=['POST'])
@login_required
def submit_activity():
    try:
        data = request.get_json(force=True)
        aid = 'act_' + uuid.uuid4().hex[:8]
        fields = ['id','name','type','type_name','cover','date','time','time_range',
                  'location','latitude','longitude','district_code','price','price_text',
                  'is_free','description','organizer','traffic','notes','status','review_status']
        vals = [aid]
        for f in fields[1:]:
            vals.append(data.get(f, ''))
        vals.append('pending')  # review_status 用户提交默认待审核
        execute(f"INSERT INTO activities ({','.join(fields)}) VALUES ({','.join(['%s']*len(fields))})", vals)
        return ok({'id': aid}, '提交成功，等待管理员审核')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 现场发文
# ============================================================
@app.route('/api/live/posts')
def get_live_posts():
    try:
        activity_id = request.args.get('activity_id')
        user_id = request.args.get('user_id')
        page, size, offset_val = get_pagination()
        order_by = request.args.get('orderBy', 'post_date')
        order_dir = request.args.get('orderDir', 'desc').upper()

        base_sql = 'SELECT * FROM live_posts WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM live_posts WHERE 1=1'
        params = []

        if activity_id:
            cond = ' AND activity_id = %s'
            base_sql += cond; count_sql += cond
            params.append(activity_id)
        if user_id:
            cond = ' AND user_id = %s'
            base_sql += cond; count_sql += cond
            params.append(user_id)

        total = query(count_sql, params[:])[0]['total']
        base_sql += f' ORDER BY {order_by} {order_dir}, post_time DESC LIMIT %s OFFSET %s'
        posts = query(base_sql, params + [size, offset_val])

        # 附带图片
        if posts:
            post_ids = [p['id'] for p in posts]
            placeholders = ','.join(['%s'] * len(post_ids))
            images = query(
                f'SELECT post_id, image_url FROM live_post_images WHERE post_id IN ({placeholders}) ORDER BY sort_order ASC',
                post_ids
            )
            img_map = {}
            for img in images:
                img_map.setdefault(img['post_id'], []).append(img['image_url'])
            for post in posts:
                post['images'] = img_map.get(post['id'], [])

        return ok({'list': posts, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/live/posts/<pid>')
def get_live_post(pid):
    try:
        rows = query('SELECT * FROM live_posts WHERE id = %s', [pid])
        if not rows:
            return fail('发文不存在')
        post = rows[0]
        images = query('SELECT image_url FROM live_post_images WHERE post_id = %s ORDER BY sort_order ASC', [pid])
        post['images'] = [i['image_url'] for i in images]
        return ok(post)
    except Exception as e:
        return fail(str(e))

@app.route('/api/live/posts', methods=['POST'])
@login_required
def create_live_post():
    try:
        data = request.get_json()
        uid = data.get('user_id', '')
        if uid:
            banned, resp = _check_user_banned(uid)
            if banned:
                return resp
        execute(
            'INSERT INTO live_posts (id, user_id, activity_id, activity_name, user_name, user_avatar, type, content, cover, video_url, point_id, point_name, location, post_time, post_date, is_verified, is_hidden) '
            'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)',
            [data.get('id'), data.get('user_id', ''), data.get('activity_id'), data.get('activity_name'),
             data.get('user_name'), data.get('user_avatar'), data.get('type'),
             data.get('content'), data.get('cover'), data.get('video_url'),
             data.get('point_id', ''), data.get('point_name', ''),
             data.get('location'), data.get('post_time'), data.get('post_date'),
             data.get('is_verified', 1), data.get('is_hidden', 0)]
        )
        # 保存图片
        images = data.get('images', [])
        for i, url in enumerate(images):
            execute('INSERT INTO live_post_images (post_id, image_url, sort_order) VALUES (%s, %s, %s)',
                    [data['id'], url, i])
        return ok(msg='发布成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/live/posts/<pid>/like', methods=['POST'])
@login_required
def like_live_post(pid):
    try:
        execute('UPDATE live_posts SET like_count = like_count + 1 WHERE id = %s', [pid])
        return ok(msg='点赞成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/live/posts/<pid>/hide', methods=['PUT'])
def hide_live_post(pid):
    try:
        data = request.get_json()
        is_hidden = data.get('is_hidden', 0)
        execute('UPDATE live_posts SET is_hidden = %s WHERE id = %s', [is_hidden, pid])
        return ok(msg='已隐藏' if is_hidden else '已恢复显示')
    except Exception as e:
        return fail(str(e))

@app.route('/api/live/posts/<pid>', methods=['DELETE'])
def delete_live_post(pid):
    try:
        execute('DELETE FROM live_post_images WHERE post_id = %s', [pid])
        execute('DELETE FROM live_posts WHERE id = %s', [pid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 社区
# ============================================================
@app.route('/api/community/posts')
def get_community_posts():
    try:
        page, size, offset_val = get_pagination()
        order_by = request.args.get('orderBy', 'created_at')
        order_dir = request.args.get('orderDir', 'desc').upper()

        total = query('SELECT COUNT(*) as total FROM community_posts')[0]['total']
        sql = f'SELECT * FROM community_posts ORDER BY {order_by} {order_dir} LIMIT %s OFFSET %s'
        posts = query(sql, [size, offset_val])

        # 附带标签
        if posts:
            post_ids = [p['id'] for p in posts]
            placeholders = ','.join(['%s'] * len(post_ids))
            tags = query(
                f'SELECT post_id, tag FROM community_tags WHERE post_id IN ({placeholders})',
                post_ids
            )
            tag_map = {}
            for t in tags:
                tag_map.setdefault(t['post_id'], []).append(t['tag'])
            for post in posts:
                post['tags'] = tag_map.get(post['id'], [])

        return ok({'list': posts, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/community/posts/<pid>')
def get_community_post(pid):
    try:
        rows = query('SELECT * FROM community_posts WHERE id = %s', [pid])
        if not rows:
            return fail('帖子不存在')
        post = rows[0]
        tags = query('SELECT tag FROM community_tags WHERE post_id = %s', [pid])
        post['tags'] = [t['tag'] for t in tags]
        execute('UPDATE community_posts SET view_count = view_count + 1 WHERE id = %s', [pid])
        return ok(post)
    except Exception as e:
        return fail(str(e))

# ============================================================
# 照片
# ============================================================
@app.route('/api/photos/checkin')
def get_checkin_photos():
    try:
        checkin_id = request.args.get('checkin_id')
        page, size, offset_val = get_pagination()

        base_sql = 'SELECT * FROM checkin_photos WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM checkin_photos WHERE 1=1'
        params = []

        if checkin_id:
            cond = ' AND checkin_id = %s'
            base_sql += cond; count_sql += cond
            params.append(checkin_id)

        total = query(count_sql, params[:])[0]['total']
        base_sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        rows = query(base_sql, params + [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/photos/homepage')
def get_homepage_photos():
    try:
        page, size, offset_val = get_pagination()
        total = query('SELECT COUNT(*) as total FROM homepage_photos')[0]['total']
        rows = query('SELECT * FROM homepage_photos ORDER BY sort_order ASC, created_at DESC LIMIT %s OFFSET %s', [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

# ============================================================
# 本地生活
# ============================================================
@app.route('/api/locallife/categories')
def get_locallife_categories():
    try:
        page, size, offset_val = get_pagination()
        total = query('SELECT COUNT(*) as total FROM local_life_categories')[0]['total']
        rows = query('SELECT * FROM local_life_categories ORDER BY id ASC LIMIT %s OFFSET %s', [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/locallife/items')
def get_locallife_items():
    try:
        category = request.args.get('category')
        page, size, offset_val = get_pagination()

        base_sql = 'SELECT * FROM local_life_items WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM local_life_items WHERE 1=1'
        params = []

        if category:
            cond = ' AND category = %s'
            base_sql += cond; count_sql += cond
            params.append(category)

        total = query(count_sql, params[:])[0]['total']
        base_sql += ' ORDER BY sort_order ASC LIMIT %s OFFSET %s'
        rows = query(base_sql, params + [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

# ============================================================
# 用户
# ============================================================
def _check_user_banned(uid):
    """检查用户是否处于禁闭状态, 返回 (is_banned, error_response)
    禁闭用户: 可浏览但不可执行任何写操作
    """
    rows = query('SELECT status, ban_until, ban_reason FROM users WHERE id = %s', [uid])
    if not rows:
        return False, None
    user = rows[0]
    status = user.get('status', 'active')
    if status == 'muted':
        ban_until = user.get('ban_until')
        if ban_until:
            from datetime import datetime as dt
            if isinstance(ban_until, str):
                fmt = '%Y-%m-%d %H:%M:%S' if ' ' in ban_until else '%Y-%m-%d'
                ban_until = dt.strptime(ban_until, fmt)
            if dt.now() > ban_until:
                # 到期自动恢复
                execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=NULL WHERE id=%s', ['active', uid])
                return False, None
        reason = user.get('ban_reason', '您的账号已被禁闭')
        ban_msg = reason
        if user.get('ban_until'):
            ban_msg += f'，预计 {str(user["ban_until"])[:16]} 解除'
        return True, fail(ban_msg)
    return False, None

@app.route('/api/user/login', methods=['POST'])
def user_login():
    try:
        data = request.get_json()
        code = data.get('code')
        nickname = data.get('nickname', '旅行者·大理')
        avatar = data.get('avatar', '')
        direct_openid = data.get('openid', '')
        privacy_agreed = data.get('privacy_agreed', 0)

        openid = direct_openid

        # 如果有 code，通过微信 code2session 换取真实 openid
        if code:
            try:
                if not WECHAT_APPID or not WECHAT_SECRET:
                    if not openid:
                        return fail('微信小程序 AppID/Secret 未配置，无法登录')
                else:
                    wx_url = ('https://api.weixin.qq.com/sns/jscode2session'
                              '?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code') % (
                              WECHAT_APPID, WECHAT_SECRET, code)
                    resp = urlopen(wx_url, timeout=10)
                    wx_data = json.loads(resp.read().decode('utf-8'))
                    if 'errcode' in wx_data and wx_data['errcode'] != 0:
                        if not openid:
                            return fail('微信登录失败: %s %s' % (wx_data.get('errcode'), wx_data.get('errmsg', '')))
                    else:
                        openid = wx_data.get('openid', openid)
                        # session_key 可用于后续解密敏感数据，此处暂存
            except Exception as wx_err:
                if not openid:
                    return fail('微信登录失败: %s' % str(wx_err))

        if not openid:
            return fail('缺少 openid 或 code')

        rows = query('SELECT * FROM users WHERE openid = %s', [openid])

        token = secrets.token_hex(32)

        agreed = 1 if privacy_agreed else 0
        agreed_at = datetime.now() if privacy_agreed else None

        is_new_user = False
        if not rows:
            uid = execute(
                'INSERT INTO users (openid, nickname, avatar, token, is_logged_in, privacy_agreed, privacy_agreed_at) VALUES (%s, %s, %s, %s, 1, %s, %s)',
                [openid, nickname, avatar, token, agreed, agreed_at]
            )
            user = {'id': uid, 'openid': openid, 'nickname': nickname, 'avatar': avatar, 'is_logged_in': 1, 'privacy_agreed': agreed}
            is_new_user = True
        else:
            user = rows[0]

            # 检查封禁状态
            user_status = user.get('status', 'active')
            if user_status == 'disabled':
                return fail('您的账号已被禁用，无法登录。原因: %s' % (user.get('ban_reason', '违反用户协议')))
            if user_status == 'muted':
                ban_until = user.get('ban_until')
                if ban_until:
                    from datetime import datetime as dt
                    if isinstance(ban_until, str):
                        ban_until = dt.strptime(ban_until, '%Y-%m-%d %H:%M:%S') if ' ' in ban_until else dt.strptime(ban_until, '%Y-%m-%d')
                    if dt.now() > ban_until:
                        # 禁闭已过期，自动恢复
                        execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=NULL WHERE id=%s',
                                ['active', user['id']])
                        user['status'] = 'active'
                        user['ban_until'] = None
                        user['ban_reason'] = None

            # 已有用户登录：只更新 token 和登录状态，不覆盖用户已修改的头像/昵称
            # 头像/昵称的修改应通过 PUT /api/user/:id 接口完成
            if privacy_agreed and not user.get('privacy_agreed'):
                execute('UPDATE users SET is_logged_in = 1, token = %s, privacy_agreed = 1, privacy_agreed_at = %s WHERE id = %s',
                        [token, datetime.now(), user['id']])
            else:
                execute('UPDATE users SET is_logged_in = 1, token = %s WHERE id = %s',
                        [token, user['id']])
            user['is_logged_in'] = 1
            user['privacy_agreed'] = 1 if privacy_agreed else user.get('privacy_agreed', 0)

        return ok({'token': token, 'user': user, 'is_new_user': is_new_user})
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>')
def get_user(uid):
    try:
        rows = query('SELECT * FROM users WHERE id = %s', [uid])
        if not rows:
            return fail('用户不存在')
        return ok(rows[0])
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/status')
def get_user_status(uid):
    """查询用户封禁状态（轻量接口，供小程序启动时校验）"""
    try:
        rows = query('SELECT status, ban_until, ban_reason FROM users WHERE id = %s', [uid])
        if not rows:
            return fail('用户不存在')
        user = rows[0]
        # 检查禁闭是否过期，自动恢复
        status = user.get('status', 'active')
        if status == 'muted' and user.get('ban_until'):
            from datetime import datetime as dt
            ban_until = user['ban_until']
            if isinstance(ban_until, str):
                fmt = '%Y-%m-%d %H:%M:%S' if ' ' in ban_until else '%Y-%m-%d'
                ban_until = dt.strptime(ban_until, fmt)
            if dt.now() > ban_until:
                execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=NULL WHERE id=%s', ['active', uid])
                user['status'] = 'active'
                user['ban_until'] = None
                user['ban_reason'] = None
        return ok(user)
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>', methods=['PUT'])
@login_required
def update_user(uid):
    try:
        banned, resp = _check_user_banned(uid)
        if banned:
            return resp
        data = request.get_json()
        execute('UPDATE users SET nickname = %s, avatar = %s, phone = %s WHERE id = %s',
                [data.get('nickname'), data.get('avatar'), data.get('phone'), uid])
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/checkins')
def get_user_checkins(uid):
    try:
        page, size, offset_val = get_pagination()
        total = query('SELECT COUNT(*) as total FROM user_checkins WHERE user_id = %s', [uid])[0]['total']
        rows = query(
            'SELECT uc.*, cp.name as point_name, cp.cover as point_cover '
            'FROM user_checkins uc '
            'LEFT JOIN checkin_points cp ON uc.checkin_id = cp.id '
            'WHERE uc.user_id = %s '
            'ORDER BY uc.created_at DESC LIMIT %s OFFSET %s',
            [uid, size, offset_val]
        )
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/checkins', methods=['POST'])
@login_required
def create_user_checkin(uid):
    try:
        banned, resp = _check_user_banned(uid)
        if banned:
            return resp
        data = request.get_json()
        execute(
            'INSERT INTO user_checkins (user_id, checkin_id, image_url, note, latitude, longitude) '
            'VALUES (%s, %s, %s, %s, %s, %s)',
            [uid, data.get('point_id'), data.get('image_url', ''), data.get('note', ''),
             data.get('latitude', 0), data.get('longitude', 0)]
        )
        return ok(msg='打卡成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/stats')
def get_user_stats(uid):
    try:
        booking_count = query('SELECT COUNT(*) as cnt FROM user_bookings WHERE user_id = %s', [uid])[0]['cnt']
        fav_count = query('SELECT COUNT(*) as cnt FROM user_favorites WHERE user_id = %s', [uid])[0]['cnt']
        checkin_count = query('SELECT COUNT(*) as cnt FROM user_checkins WHERE user_id = %s', [uid])[0]['cnt']
        post_count = query('SELECT COUNT(*) as cnt FROM live_posts WHERE user_id = %s', [uid])[0]['cnt']
        return ok({
            'bookingCount': booking_count,
            'favCount': fav_count,
            'checkinCount': checkin_count,
            'postCount': post_count
        })
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/bookings')
def get_user_bookings(uid):
    try:
        page, size, offset_val = get_pagination()
        total = query('SELECT COUNT(*) as total FROM user_bookings WHERE user_id = %s', [uid])[0]['total']
        rows = query(
            '''SELECT ub.*, a.name as activity_name, a.cover as activity_cover, a.date as activity_date
               FROM user_bookings ub
               LEFT JOIN activities a ON ub.activity_id = a.id
               WHERE ub.user_id = %s
               ORDER BY ub.created_at DESC LIMIT %s OFFSET %s''',
            [uid, size, offset_val]
        )
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/bookings', methods=['POST'])
@login_required
def create_booking(uid):
    try:
        banned, resp = _check_user_banned(uid)
        if banned:
            return resp
        data = request.get_json()
        cnt = data.get('count', 1)
        execute(
            'INSERT INTO user_bookings (user_id, activity_id, name, phone, count) VALUES (%s, %s, %s, %s, %s)',
            [uid, data.get('activity_id'), data.get('name'), data.get('phone'), cnt]
        )
        execute('UPDATE activities SET booked = booked + %s WHERE id = %s', [cnt, data.get('activity_id')])
        return ok(msg='预约成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/favorites', methods=['POST'])
@login_required
def add_favorite(uid):
    try:
        banned, resp = _check_user_banned(uid)
        if banned:
            return resp
        data = request.get_json()
        execute(
            'INSERT IGNORE INTO user_favorites (user_id, item_type, item_id) VALUES (%s, %s, %s)',
            [uid, data.get('item_type'), data.get('item_id')]
        )
        return ok(msg='收藏成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/favorites', methods=['DELETE'])
@login_required
def remove_favorite(uid):
    try:
        data = request.get_json()
        execute(
            'DELETE FROM user_favorites WHERE user_id = %s AND item_type = %s AND item_id = %s',
            [uid, data.get('item_type'), data.get('item_id')]
        )
        return ok(msg='已取消收藏')
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/favorites', methods=['GET'])
def get_user_favorites(uid):
    try:
        item_type = request.args.get('item_type')
        page, size, offset_val = get_pagination()

        base_sql = 'SELECT * FROM user_favorites WHERE user_id = %s'
        count_sql = 'SELECT COUNT(*) as total FROM user_favorites WHERE user_id = %s'
        params = [uid]

        if item_type:
            cond = ' AND item_type = %s'
            base_sql += cond; count_sql += cond
            params.append(item_type)

        total = query(count_sql, params[:])[0]['total']
        base_sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        rows = query(base_sql, params + [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/likes', methods=['POST'])
@login_required
def add_like(uid):
    try:
        banned, resp = _check_user_banned(uid)
        if banned:
            return resp
        data = request.get_json()
        execute(
            'INSERT IGNORE INTO user_likes (user_id, item_type, item_id) VALUES (%s, %s, %s)',
            [uid, data.get('item_type'), data.get('item_id')]
        )
        return ok(msg='点赞成功')
    except Exception as e:
        return fail(str(e))

@app.route('/api/user/<uid>/likes', methods=['DELETE'])
@login_required
def remove_like(uid):
    try:
        data = request.get_json()
        execute(
            'DELETE FROM user_likes WHERE user_id = %s AND item_type = %s AND item_id = %s',
            [uid, data.get('item_type'), data.get('item_id')]
        )
        return ok(msg='已取消点赞')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 搜索
# ============================================================
@app.route('/api/search/history', methods=['POST'])
@login_required
def add_search_history():
    try:
        data = request.get_json()
        keyword = data.get('keyword', '').strip()
        if not keyword:
            return ok(msg='关键词为空')
        user_id = data.get('user_id')
        execute('DELETE FROM search_history WHERE user_id = %s AND keyword = %s', [user_id, keyword])
        execute('INSERT INTO search_history (user_id, keyword) VALUES (%s, %s)', [user_id, keyword])
        return ok(msg='已记录')
    except Exception as e:
        return fail(str(e))

@app.route('/api/search/history/<user_id>', methods=['GET'])
def get_search_history(user_id):
    try:
        page, size, offset_val = get_pagination()
        total = query('SELECT COUNT(*) as total FROM search_history WHERE user_id = %s', [user_id])[0]['total']
        rows = query(
            'SELECT keyword, created_at FROM search_history WHERE user_id = %s ORDER BY created_at DESC LIMIT %s OFFSET %s',
            [user_id, size, offset_val]
        )
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@app.route('/api/search/history/<user_id>', methods=['DELETE'])
@login_required
def clear_search_history(user_id):
    try:
        execute('DELETE FROM search_history WHERE user_id = %s', [user_id])
        return ok(msg='已清空')
    except Exception as e:
        return fail(str(e))

@app.route('/api/search/activities')
@rate_limit(RATE_LIMIT_SEARCH)
def global_search_activities():
    try:
        keyword = request.args.get('keyword')
        if not keyword:
            return ok({'list': [], 'total': 0, 'page': 1, 'size': 20})
        page, size, offset_val = get_pagination()
        like = f'%{keyword}%'
        total = query(
            "SELECT COUNT(*) as total FROM activities WHERE name LIKE %s AND status = 'active' AND review_status='approved' AND publish_status='listed'",
            [like]
        )[0]['total']
        rows = query(
            "SELECT * FROM activities WHERE name LIKE %s AND status = 'active' AND review_status='approved' AND publish_status='listed' ORDER BY hot_value DESC LIMIT %s OFFSET %s",
            [like, size, offset_val]
        )
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))


# ============================================================
# 应用配置
# ============================================================
@app.route('/api/config/<key>')
def get_config(key):
    try:
        rows = query('SELECT `value` FROM app_config WHERE `key` = %s', [key])
        return ok(rows[0]['value'] if rows else None)
    except Exception as e:
        return fail(str(e))

@app.route('/api/config/<key>', methods=['PUT'])
def set_config(key):
    try:
        data = request.get_json()
        value = data.get('value')
        execute(
            'INSERT INTO app_config (`key`, `value`) VALUES (%s, %s) ON DUPLICATE KEY UPDATE `value` = %s',
            [key, value, value]
        )
        return ok(msg='ok')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 注册管理后台蓝图（必须在模块级别注册，gunicorn 不会触发 __main__）
# ============================================================
from admin_api import admin_bp
app.register_blueprint(admin_bp, url_prefix='/api/admin')

# ============================================================
# 启动
# ============================================================
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=SERVER_PORT, debug=False)
