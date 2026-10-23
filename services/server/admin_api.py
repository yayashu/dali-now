# -*- coding: utf-8 -*-
"""
大理此刻 - 后台管理系统 API (Admin Blueprint)
=============================================
提供管理员认证 + 全模块 CRUD + 数据统计 + Excel 导入
前缀: /api/admin
"""
import json, os, uuid, hashlib, hmac, functools, io, time
from datetime import datetime
from flask import Blueprint, request, jsonify, send_file

# 复用主 app 的数据库连接和工具函数
from app import get_conn, query, execute, ok, fail
from config import ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SECRET

admin_bp = Blueprint('admin', __name__)

# ============================================================
# 管理员认证（HMAC 签名 Token，兼容 Gunicorn 多 Worker）
# ============================================================
ADMIN_TOKEN_EXPIRE_SECONDS = 24 * 3600  # Token 有效期 24 小时

def generate_admin_token():
    """生成 HMAC 签名 Token，格式: timestamp:signature"""
    ts = str(int(time.time()))
    payload = f"admin:{ts}"
    sig = hmac.new(
        ADMIN_SECRET.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return f"{ts}:{sig}"

def verify_admin_token():
    """验证 HMAC 签名 Token，无需共享状态（多 Worker 兼容）"""
    token = request.headers.get('X-Admin-Token', '')
    if not token:
        return False
    parts = token.split(':')
    if len(parts) != 2:
        return False
    ts_str, sig = parts
    try:
        ts = int(ts_str)
    except ValueError:
        return False
    # 检查是否过期
    if time.time() - ts > ADMIN_TOKEN_EXPIRE_SECONDS:
        return False
    # 验证签名
    payload = f"admin:{ts_str}"
    expected_sig = hmac.new(
        ADMIN_SECRET.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(sig, expected_sig)

def admin_required(f):
    """管理员认证装饰器"""
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        if not verify_admin_token():
            return jsonify({'code': -1, 'msg': '未登录或登录已过期'}), 401
        return f(*args, **kwargs)
    return wrapper

@admin_bp.route('/login', methods=['POST'])
def admin_login():
    data = request.get_json(force=True)
    username = data.get('username', '')
    password = data.get('password', '')
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        token = generate_admin_token()
        return ok({'token': token, 'username': 'admin'}, '登录成功')
    return fail('用户名或密码错误')

@admin_bp.route('/logout', methods=['POST'])
def admin_logout():
    # HMAC Token 无需服务端注销，前端清除 token 即可
    return ok(msg='已退出')

@admin_bp.route('/check')
@admin_required
def admin_check():
    return ok({'username': 'admin'})

# ============================================================
# Dashboard 数据看板
# ============================================================
@admin_bp.route('/dashboard')
@admin_required
def dashboard():
    try:
        print('[Dashboard] 开始查询统计数据...', flush=True)
        total_activities = query("SELECT COUNT(*) as cnt FROM activities")[0]['cnt']
        active_activities = query("SELECT COUNT(*) as cnt FROM activities WHERE status='active'")[0]['cnt']
        total_checkin = query("SELECT COUNT(*) as cnt FROM checkin_points")[0]['cnt']
        total_live = query("SELECT COUNT(*) as cnt FROM live_posts")[0]['cnt']
        total_community = query("SELECT COUNT(*) as cnt FROM community_posts")[0]['cnt']
        total_users = query("SELECT COUNT(*) as cnt FROM users")[0]['cnt']
        total_bookings = query("SELECT COUNT(*) as cnt FROM user_bookings")[0]['cnt']
        total_favorites = query("SELECT COUNT(*) as cnt FROM user_favorites")[0]['cnt']
        total_photos = query("SELECT COUNT(*) as cnt FROM homepage_photos")[0]['cnt']
        total_locallife = query("SELECT COUNT(*) as cnt FROM local_life_items")[0]['cnt']

        # 最近7天发文趋势
        trend = query("""
            SELECT post_date as date, COUNT(*) as cnt
            FROM live_posts
            WHERE post_date >= DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 7 DAY), '%%Y-%%m-%%d')
            GROUP BY post_date ORDER BY post_date ASC
        """)

        # 活动状态分布
        act_status = query("SELECT status, COUNT(*) as cnt FROM activities GROUP BY status")

        # 按热度 Top5 活动
        top_activities = query("SELECT name, hot_value, booked FROM activities ORDER BY hot_value DESC LIMIT 5")

        # 每日新增用户(近7天)
        new_users = query("""
            SELECT DATE(created_at) as date, COUNT(*) as cnt
            FROM users WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at) ORDER BY date ASC
        """)

        return ok({
            'stats': {
                'total_activities': total_activities,
                'active_activities': active_activities,
                'total_checkin': total_checkin,
                'total_live': total_live,
                'total_community': total_community,
                'total_users': total_users,
                'total_bookings': total_bookings,
                'total_favorites': total_favorites,
                'total_photos': total_photos,
                'total_locallife': total_locallife
            },
            'trend': trend,
            'act_status': act_status,
            'top_activities': top_activities,
            'new_users': new_users
        })
        print(f'[Dashboard] 查询完成: 活动{total_activities} 打卡{total_checkin} 用户{total_users} 现场{total_live} 攻略{total_community} 预约{total_bookings} 本地{total_locallife}', flush=True)
    except Exception as e:
        print(f'[Dashboard] 查询异常: {e}', flush=True)
        return fail(str(e))

# ============================================================
# 活动管理 CRUD
# ============================================================
@admin_bp.route('/activities')
@admin_required
def admin_activities():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        keyword = request.args.get('keyword', '')
        status = request.args.get('status', '')
        offset_val = (page - 1) * size

        sql = 'SELECT * FROM activities WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM activities WHERE 1=1'
        params = []

        if keyword:
            sql += ' AND name LIKE %s'
            count_sql += ' AND name LIKE %s'
            params.append(f'%{keyword}%')
        if status:
            sql += ' AND status = %s'
            count_sql += ' AND status = %s'
            params.append(status)

        review_status = request.args.get('review_status', '')
        if review_status:
            sql += ' AND review_status = %s'
            count_sql += ' AND review_status = %s'
            params.append(review_status)

        publish_status = request.args.get('publish_status', '')
        if publish_status:
            sql += ' AND publish_status = %s'
            count_sql += ' AND publish_status = %s'
            params.append(publish_status)

        sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])

        # 附带标签和图片数量
        for act in rows:
            tags = query('SELECT tag FROM activity_tags WHERE activity_id=%s', [act['id']])
            act['tags'] = [t['tag'] for t in tags]
            img_count = query('SELECT COUNT(*) as cnt FROM activity_images WHERE activity_id=%s', [act['id']])[0]['cnt']
            act['image_count'] = img_count

        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activities/<aid>')
@admin_required
def admin_activity_detail(aid):
    try:
        rows = query('SELECT * FROM activities WHERE id=%s', [aid])
        if not rows:
            return fail('活动不存在')
        act = rows[0]
        tags = query('SELECT id, tag FROM activity_tags WHERE activity_id=%s', [aid])
        images = query('SELECT id, image_url, sort_order, is_cover FROM activity_images WHERE activity_id=%s ORDER BY sort_order', [aid])
        act['tags'] = [t['tag'] for t in tags]
        act['images'] = images
        return ok(act)
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activities', methods=['POST'])
@admin_required
def admin_activity_create():
    try:
        data = request.get_json(force=True)
        aid = data.get('id') or 'act_' + uuid.uuid4().hex[:8]
        fields = ['id','name','type','type_name','cover','poster','date','time','time_range',
                  'location','latitude','longitude','district_code','price','price_text','is_free','capacity',
                  'remaining','hot_value','description','culture_intro',
                  'organizer','traffic','notes','rules','status','date_range_start',
                  'date_range_end','duration_days','review_status','publish_status']
        # 管理员创建默认审核通过 + 默认上架
        if not data.get('review_status'):
            data['review_status'] = 'approved'
        if not data.get('publish_status'):
            data['publish_status'] = 'listed'
        values = []
        placeholders = []
        for f in fields:
            placeholders.append('%s')
            values.append(aid if f == 'id' else data.get(f, ''))
        execute(f"INSERT INTO activities ({','.join(fields)}) VALUES ({','.join(placeholders)})", values)
        # 保存标签
        tags = data.get('tags', [])
        if isinstance(tags, list):
            for tag in tags:
                t = tag.strip() if isinstance(tag, str) else tag.get('tag','').strip()
                if t:
                    execute('INSERT INTO activity_tags (activity_id, tag) VALUES (%s,%s)', [aid, t])
        # 保存图片
        images = data.get('images', [])
        if isinstance(images, list):
            for i, img in enumerate(images):
                url = img if isinstance(img, str) else img.get('image_url','')
                if url:
                    execute('INSERT INTO activity_images (activity_id, image_url, sort_order, is_cover) VALUES (%s,%s,%s,%s)',
                            [aid, url, i, 1 if i == 0 else 0])
        return ok({'id': aid}, '创建成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activities/<aid>', methods=['PUT'])
@admin_required
def admin_activity_update(aid):
    try:
        data = request.get_json(force=True)
        updatable = ['name','type','type_name','cover','poster','date','time','time_range',
                     'location','latitude','longitude','district_code','price','price_text','is_free','capacity',
                     'remaining','hot_value','description','culture_intro',
                     'organizer','traffic','notes','rules','status','date_range_start',
                     'date_range_end','duration_days','review_status','publish_status']
        sets = []
        vals = []
        for f in updatable:
            if f in data:
                sets.append(f'{f}=%s')
                vals.append(data[f])
        if sets:
            vals.append(aid)
            execute(f"UPDATE activities SET {','.join(sets)} WHERE id=%s", vals)
        # 更新标签
        if 'tags' in data:
            execute('DELETE FROM activity_tags WHERE activity_id=%s', [aid])
            for tag in data['tags']:
                t = tag.strip() if isinstance(tag, str) else tag.get('tag','').strip()
                if t:
                    execute('INSERT INTO activity_tags (activity_id,tag) VALUES (%s,%s)', [aid, t])
        # 更新图片
        if 'images' in data:
            execute('DELETE FROM activity_images WHERE activity_id=%s', [aid])
            for i, img in enumerate(data['images']):
                url = img if isinstance(img, str) else img.get('image_url','')
                if url:
                    execute('INSERT INTO activity_images (activity_id,image_url,sort_order,is_cover) VALUES (%s,%s,%s,%s)',
                            [aid, url, i, 1 if i == 0 else 0])
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activities/<aid>', methods=['DELETE'])
@admin_required
def admin_activity_delete(aid):
    try:
        execute('DELETE FROM activity_tags WHERE activity_id=%s', [aid])
        execute('DELETE FROM activity_images WHERE activity_id=%s', [aid])
        execute('DELETE FROM activities WHERE id=%s', [aid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activities/<aid>/publish', methods=['PUT'])
@admin_required
def admin_activity_publish(aid):
    """上架/下架活动"""
    try:
        data = request.get_json(force=True) or {}
        status = data.get('publish_status', 'listed')
        if status not in ('listed', 'unlisted'):
            return fail('状态无效，仅支持 listed/unlisted')
        execute('UPDATE activities SET publish_status=%s WHERE id=%s', [status, aid])
        return ok(msg='已上架' if status == 'listed' else '已下架')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activities/<aid>/approve', methods=['PUT'])
@admin_required
def admin_activity_approve(aid):
    """审核通过/拒绝活动"""
    try:
        data = request.get_json(force=True) or {}
        status = data.get('review_status', 'approved')
        if status not in ('approved', 'rejected'):
            return fail('审核状态无效，仅支持 approved/rejected')
        execute('UPDATE activities SET review_status=%s WHERE id=%s', [status, aid])
        return ok(msg='审核通过' if status == 'approved' else '已拒绝')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 活动 Excel 导入
# ============================================================
ACTIVITY_FIELDS = ['name','type','type_name','cover','poster','date','time','time_range',
                   'location','latitude','longitude','district_code','price','price_text',
                   'is_free','capacity','remaining','hot_value','description','culture_intro',
                   'organizer','traffic','notes','rules','status','date_range_start',
                   'date_range_end','duration_days']

ACTIVITY_TEMPLATE_HEADERS = ACTIVITY_FIELDS + ['tags(逗号分隔)', 'images(逗号分隔)']

# 中文表头（模板展示用）
ACTIVITY_CN_HEADERS = [
    '活动名称', '活动类型(英文)', '活动类型名称', '封面图链接', '海报图链接', '开始日期',
    '开始时间', '时间范围(如09:00-18:00)', '地点', '纬度', '经度', '区域编码(如dali)',
    '价格(元,0=免费)', '价格说明', '是否免费(1是/0否)', '名额总数', '剩余名额',
    '热度值', '简介', '文化介绍', '主办方', '交通指南',
    '注意事项', '报名规则', '状态(active/pending/inactive)', '活动开始日期', '活动结束日期',
    '持续天数', '标签(逗号分隔)', '图片链接(逗号分隔)'
]
# 中文→英文字段名映射（导入时翻译用）
ACTIVITY_CN_TO_EN = dict(zip(ACTIVITY_CN_HEADERS, ACTIVITY_TEMPLATE_HEADERS))

@admin_bp.route('/activities/template')
@admin_required
def activity_template():
    """下载活动导入模板"""
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = '活动导入模板'
        # 表头行用中文，便于用户理解
        ws.append(ACTIVITY_CN_HEADERS)
        # 冻结表头行
        ws.freeze_panes = 'A2'
        # 表头样式：蓝色背景+白色粗体+自动换行
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
        header_font = Font(name='微软雅黑', bold=True, color='FFFFFF', size=10)
        header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='D9D9D9'),
            right=Side(style='thin', color='D9D9D9'),
            top=Side(style='thin', color='D9D9D9'),
            bottom=Side(style='thin', color='D9D9D9')
        )
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_align
            cell.border = thin_border
        # 写入示例数据
        sample_data = [
            '示例活动名称', 'folk', '民俗活动', '', '', '2026-06-10', '09:00',
            '09:00-18:00', '大理古城', 25.6756, 100.1623, 'dali', 0, '免费', 1,
            100, 100, 5000, '活动简介描述', '文化介绍',
            '主办方名称', '交通指南', '注意事项', '报名规则', 'active',
            '2026-06-10', '2026-06-15', 6, '标签1,标签2', 'https://example.com/img1.jpg,https://example.com/img2.jpg'
        ]
        ws.append(sample_data)
        # 示例数据行样式：浅灰背景+普通字体
        sample_fill = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')
        sample_font = Font(name='微软雅黑', size=10, color='808080')
        for cell in ws[2]:
            cell.fill = sample_fill
            cell.font = sample_font
            cell.alignment = Alignment(vertical='center', wrap_text=True)
            cell.border = thin_border
        # 设置列宽
        for col_idx in range(1, len(ACTIVITY_CN_HEADERS) + 1):
            col_letter = ws.cell(1, col_idx).column_letter
            ws.column_dimensions[col_letter].width = 18
        # 设置行高
        ws.row_dimensions[1].height = 36
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         as_attachment=True, download_name='activities_template.xlsx')
    except Exception as e:
        return fail(f'生成模板失败: {str(e)}')

def _find_import_sheet(wb, expected_min_cols=10):
    """在 workbook 中找到数据最多的 sheet（避免 active sheet 是字典表等）"""
    best_ws = None
    best_cols = 0
    for sname in wb.sheetnames:
        ws = wb[sname]
        rows = list(ws.iter_rows(min_row=1, max_row=1, values_only=True))
        if rows:
            ncols = len([c for c in rows[0] if c is not None])
            if ncols > best_cols:
                best_cols = ncols
                best_ws = ws
    if best_ws and best_cols >= expected_min_cols:
        return best_ws
    # fallback: 第一个 sheet
    if wb.sheetnames:
        return wb[wb.sheetnames[0]]
    return wb.active

@admin_bp.route('/activities/import', methods=['POST'])
@admin_required
def activity_import():
    """从 Excel 批量导入活动"""
    try:
        from openpyxl import load_workbook
        file = request.files.get('file')
        if not file:
            return fail('请上传文件')
        if not file.filename.endswith(('.xlsx', '.xls')):
            return fail('仅支持 .xlsx / .xls 格式')

        wb = load_workbook(file, read_only=True)
        ws = _find_import_sheet(wb, expected_min_cols=10)
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            return fail('文件中无数据行（至少需要表头+1行数据）')

        # 解析表头（兼容中文表头和英文表头）
        raw_headers = [str(h).strip() if h else '' for h in rows[0]]
        headers = []
        for h in raw_headers:
            # 中文表头 → 翻译为英文字段名，否则保持原样
            headers.append(ACTIVITY_CN_TO_EN.get(h, h))
        success = 0
        errors = []
        row_num = 0

        for row_data in rows[1:]:
            row_num += 1
            try:
                if not any(row_data):  # 跳过空行
                    continue
                data_dict = {}
                for i, h in enumerate(headers):
                    if i < len(row_data):
                        val = row_data[i]
                        data_dict[h] = str(val).strip() if val is not None else ''

                # 生成 ID
                aid = 'act_' + uuid.uuid4().hex[:8]

                # 提取 tags 和 images 字段（兼容中文表头 key）
                tags_str = data_dict.pop('tags(逗号分隔)', '') or data_dict.pop('标签(逗号分隔)', '')
                images_str = data_dict.pop('images(逗号分隔)', '') or data_dict.pop('图片链接(逗号分隔)', '')

                # 构建插入值
                values = [aid]
                for f in ACTIVITY_FIELDS:
                    val = data_dict.get(f, '')
                    # 数值类型转换
                    if f in ('latitude', 'longitude', 'price'):
                        try:
                            val = float(val) if val else 0
                        except ValueError:
                            val = 0
                    elif f in ('is_free', 'capacity', 'remaining', 'hot_value', 'duration_days'):
                        try:
                            val = int(float(val)) if val else 0
                        except ValueError:
                            val = 0
                    values.append(val)

                execute(
                    f"INSERT INTO activities (id,{','.join(ACTIVITY_FIELDS)}) VALUES ({','.join(['%s']*(len(ACTIVITY_FIELDS)+1))})",
                    values
                )

                # 写入标签
                if tags_str:
                    for tag in tags_str.split(','):
                        t = tag.strip()
                        if t:
                            execute('INSERT INTO activity_tags (activity_id, tag) VALUES (%s,%s)', [aid, t])

                # 写入图片
                if images_str:
                    for idx, url in enumerate(images_str.split(',')):
                        u = url.strip()
                        if u:
                            execute(
                                'INSERT INTO activity_images (activity_id, image_url, sort_order, is_cover) VALUES (%s,%s,%s,%s)',
                                [aid, u, idx, 1 if idx == 0 else 0]
                            )

                success += 1
            except Exception as row_err:
                errors.append(f'第{row_num}行: {str(row_err)}')

        msg = f'成功导入 {success} 条'
        if errors:
            msg += f'，{len(errors)} 条失败'
        return ok({'success': success, 'errors': errors[:20]}, msg)
    except Exception as e:
        return fail(f'导入失败: {str(e)}')

# ============================================================
# 活动类型字典管理
# ============================================================
@admin_bp.route('/activity-types')
@admin_required
def admin_activity_types():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        offset_val = (page - 1) * size
        total = query('SELECT COUNT(*) as total FROM activity_types')[0]['total']
        rows = query('SELECT * FROM activity_types ORDER BY sort_order ASC LIMIT %s OFFSET %s', [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activity-types', methods=['POST'])
@admin_required
def admin_activity_type_create():
    try:
        data = request.get_json(force=True)
        execute('INSERT INTO activity_types (code,name,sort_order) VALUES (%s,%s,%s)',
                [data.get('code'), data.get('name'), data.get('sort_order', 0)])
        return ok(msg='添加成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activity-types/<int:tid>', methods=['PUT'])
@admin_required
def admin_activity_type_update(tid):
    try:
        data = request.get_json(force=True)
        execute('UPDATE activity_types SET code=%s,name=%s,sort_order=%s WHERE id=%s',
                [data.get('code'), data.get('name'), data.get('sort_order', 0), tid])
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/activity-types/<int:tid>', methods=['DELETE'])
@admin_required
def admin_activity_type_delete(tid):
    try:
        execute('DELETE FROM activity_types WHERE id=%s', [tid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 景区管理 CRUD
# ============================================================
@admin_bp.route('/scenic-spots')
@admin_required
def admin_scenic_spots():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        keyword = request.args.get('keyword', '')
        district = request.args.get('district', '')
        status = request.args.get('status', '')
        offset_val = (page - 1) * size

        sql = 'SELECT * FROM scenic_spots WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM scenic_spots WHERE 1=1'
        params = []
        if keyword:
            like_pattern = '%' + '%'.join(list(keyword)) + '%'
            cond = ' AND (name LIKE %s OR description LIKE %s)'
            sql += cond; count_sql += cond
            params.extend([like_pattern, like_pattern])
        if district:
            sql += ' AND district_code = %s'
            count_sql += ' AND district_code = %s'
            params.append(district)
        if status:
            sql += ' AND status = %s'
            count_sql += ' AND status = %s'
            params.append(status)

        sql += ' ORDER BY sort_order ASC, id DESC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])

        # 附带区域名称
        for spot in rows:
            if spot.get('district_code'):
                districts = query('SELECT name FROM districts WHERE code=%s', [spot['district_code']])
                spot['district_name'] = districts[0]['name'] if districts else ''
            else:
                spot['district_name'] = ''

        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/scenic-spots/search')
@admin_required
def admin_scenic_spots_search():
    """轻量接口：用于下拉搜索选择（只返回 id + name）"""
    try:
        keyword = request.args.get('keyword', '')
        limit = int(request.args.get('limit', 50))
        if keyword:
            like_pattern = '%' + '%'.join(list(keyword)) + '%'
            rows = query(
                'SELECT id, name FROM scenic_spots WHERE name LIKE %s AND status=%s ORDER BY sort_order ASC LIMIT %s',
                [like_pattern, 'active', limit]
            )
        else:
            rows = query(
                'SELECT id, name FROM scenic_spots WHERE status=%s ORDER BY sort_order ASC LIMIT %s',
                ['active', limit]
            )
        return ok(rows)
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/scenic-spots/<int:sid>')
@admin_required
def admin_scenic_spot_detail(sid):
    try:
        rows = query('SELECT * FROM scenic_spots WHERE id=%s', [sid])
        if not rows:
            return fail('景区不存在')
        return ok(rows[0])
    except Exception as e:
        return fail(str(e))

SCENIC_FIELDS = ['name','district_code','cover','images','description','overview',
                 'entrance','entrance_lat','entrance_lng','parking','parking_lat',
                 'parking_lng','parking_fee','ticket_type','ticket_price','ticket_note',
                 'half_price_note','open_time','close_time','best_season','suggested_time',
                 'address','latitude','longitude','phone','website','level','tags',
                 'facilities','transport','notice','tips','popularity','status','sort_order']

@admin_bp.route('/scenic-spots', methods=['POST'])
@admin_required
def admin_scenic_spot_create():
    try:
        data = request.get_json(force=True)
        # images JSON 序列化处理
        if 'images' in data and isinstance(data['images'], list):
            data['images'] = json.dumps(data['images'], ensure_ascii=False)
        def _val_or_null(f):
            v = data.get(f, '')
            if f == 'images' and (v == '' or v is None):
                return None
            return v
        vals = [_val_or_null(f) for f in SCENIC_FIELDS]
        execute(f"INSERT INTO scenic_spots ({','.join(SCENIC_FIELDS)}) VALUES ({','.join(['%s']*len(SCENIC_FIELDS))})", vals)
        new_id = query('SELECT LAST_INSERT_ID() as id')[0]['id']
        return ok({'id': new_id}, '创建成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/scenic-spots/<int:sid>', methods=['PUT'])
@admin_required
def admin_scenic_spot_update(sid):
    try:
        data = request.get_json(force=True)
        if 'images' in data and isinstance(data['images'], list):
            data['images'] = json.dumps(data['images'], ensure_ascii=False)
        sets = []
        vals = []
        for f in SCENIC_FIELDS:
            if f in data:
                sets.append(f'{f}=%s')
                vals.append(data[f])
        if sets:
            vals.append(sid)
            execute(f"UPDATE scenic_spots SET {','.join(sets)} WHERE id=%s", vals)
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/scenic-spots/<int:sid>', methods=['DELETE'])
@admin_required
def admin_scenic_spot_delete(sid):
    try:
        execute('DELETE FROM scenic_spots WHERE id=%s', [sid])
        # 清理打卡点中的关联
        execute('UPDATE checkin_points SET scenic_spot_id=NULL WHERE scenic_spot_id=%s', [sid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# 景区 Excel 导入
SCENIC_CN_HEADERS = [
    '景区名称','所属区域code','封面图链接','简介','概况','入口描述',
    '入口纬度','入口经度','停车场信息','停车场纬度','停车场经度','停车费',
    '门票类型(free/paid)','门票价格(元)','票价说明','优惠政策',
    '开放时间','关闭时间','最佳季节','建议游览时长',
    '地址','纬度','经度','电话','官网','级别(5A/4A/3A)','标签',
    '配套设施','交通指南','注意事项','游览贴士','热度','排序'
]

SCENIC_CN_TO_EN = {
    '景区名称': 'name', '所属区域code': 'district_code', '封面图链接': 'cover',
    '简介': 'description', '概况': 'overview', '入口描述': 'entrance',
    '入口纬度': 'entrance_lat', '入口经度': 'entrance_lng',
    '停车场信息': 'parking', '停车场纬度': 'parking_lat', '停车场经度': 'parking_lng',
    '停车费': 'parking_fee', '门票类型(free/paid)': 'ticket_type',
    '门票价格(元)': 'ticket_price', '票价说明': 'ticket_note',
    '优惠政策': 'half_price_note', '开放时间': 'open_time', '关闭时间': 'close_time',
    '最佳季节': 'best_season', '建议游览时长': 'suggested_time',
    '地址': 'address', '纬度': 'latitude', '经度': 'longitude',
    '电话': 'phone', '官网': 'website', '级别(5A/4A/3A)': 'level',
    '标签': 'tags', '配套设施': 'facilities', '交通指南': 'transport',
    '注意事项': 'notice', '游览贴士': 'tips', '热度': 'popularity', '排序': 'sort_order',
}

@admin_bp.route('/scenic-spots/template')
@admin_required
def scenic_spot_template():
    try:
        from openpyxl import Workbook
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        wb = Workbook()
        ws = wb.active
        ws.title = '景区导入模板'
        ws.append(SCENIC_CN_HEADERS)
        ws.freeze_panes = 'A2'
        header_fill = PatternFill(start_color='2E7D32', end_color='2E7D32', fill_type='solid')
        header_font = Font(name='微软雅黑', bold=True, color='FFFFFF', size=10)
        header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='D9D9D9'), right=Side(style='thin', color='D9D9D9'),
            top=Side(style='thin', color='D9D9D9'), bottom=Side(style='thin', color='D9D9D9')
        )
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_align
            cell.border = thin_border
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                        as_attachment=True, download_name='scenic_spots_template.xlsx')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/scenic-spots/import', methods=['POST'])
@admin_required
def scenic_spot_import():
    try:
        from openpyxl import load_workbook
        if 'file' not in request.files:
            return fail('请上传文件')
        file = request.files['file']
        wb = load_workbook(file, read_only=False, data_only=True)
        ws = None
        for sn in wb.sheetnames:
            s = wb[sn]
            if s.max_row and s.max_row >= 1:
                ws = s
                break
        if not ws:
            return fail('文件中无数据')

        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            return fail('文件中无数据行')

        raw_headers = [str(h).strip() if h else '' for h in rows[0]]
        headers = [SCENIC_CN_TO_EN.get(h, h) for h in raw_headers]
        success = 0
        errors = []
        row_num = 0

        for row_data in rows[1:]:
            row_num += 1
            try:
                if not any(row_data):
                    continue
                data_dict = {}
                for i, mapped_key in enumerate(headers):
                    if i >= len(row_data):
                        continue
                    val = row_data[i]
                    str_val = str(val).strip() if val is not None else ''
                    if mapped_key in SCENIC_FIELDS:
                        data_dict[mapped_key] = str_val

                # JSON 列空字符串非法，设默认值
                data_dict.setdefault('images', None)

                if not data_dict.get('name'):
                    errors.append(f'第{row_num}行: 无景区名称')
                    continue

                # 数值字段处理
                for nf in ['latitude','longitude','entrance_lat','entrance_lng','parking_lat','parking_lng','ticket_price','popularity','sort_order']:
                    if nf in data_dict:
                        try:
                            data_dict[nf] = float(data_dict[nf]) if data_dict[nf] else 0
                        except ValueError:
                            data_dict[nf] = 0
                if 'popularity' in data_dict:
                    data_dict['popularity'] = int(data_dict['popularity'])
                if 'sort_order' in data_dict:
                    data_dict['sort_order'] = int(data_dict['sort_order'])
                if 'status' not in data_dict or not data_dict['status']:
                    data_dict['status'] = 'active'

                vals = [data_dict.get(f, '') for f in SCENIC_FIELDS]
                execute(f"INSERT INTO scenic_spots ({','.join(SCENIC_FIELDS)}) VALUES ({','.join(['%s']*len(SCENIC_FIELDS))})", vals)
                success += 1
            except Exception as row_err:
                errors.append(f'第{row_num}行: {str(row_err)}')

        return ok({'success': success, 'errors': errors, 'total': row_num}, f'成功导入 {success} 条')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 打卡点管理 CRUD
# ============================================================
@admin_bp.route('/checkin-points')
@admin_required
def admin_checkin_points():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        keyword = request.args.get('keyword', '')
        ctype = request.args.get('type', '')
        review_status = request.args.get('review_status', '')
        offset_val = (page - 1) * size

        sql = 'SELECT * FROM checkin_points WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM checkin_points WHERE 1=1'
        params = []
        if keyword:
            # 分词模糊检索：将关键词拆为单字，实现 "大理" 可匹配 "大理古城南门"
            like_pattern = '%' + '%'.join(list(keyword)) + '%'
            sql += ' AND (name LIKE %s OR description LIKE %s OR landmark LIKE %s)'
            count_sql += ' AND (name LIKE %s OR description LIKE %s OR landmark LIKE %s)'
            params.extend([like_pattern, like_pattern, like_pattern])
        if ctype:
            sql += ' AND type = %s'
            count_sql += ' AND type = %s'
            params.append(ctype)
        if review_status:
            sql += ' AND review_status = %s'
            count_sql += ' AND review_status = %s'
            params.append(review_status)

        publish_status = request.args.get('publish_status', '')
        if publish_status:
            sql += ' AND publish_status = %s'
            count_sql += ' AND publish_status = %s'
            params.append(publish_status)

        sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])

        # 附带活动名称 + 景区名称
        for pt in rows:
            if pt.get('activity_id'):
                acts = query('SELECT name FROM activities WHERE id=%s', [pt['activity_id']])
                pt['activity_name'] = acts[0]['name'] if acts else ''
            else:
                pt['activity_name'] = ''
            if pt.get('scenic_spot_id'):
                spots = query('SELECT name FROM scenic_spots WHERE id=%s', [pt['scenic_spot_id']])
                pt['scenic_spot_name'] = spots[0]['name'] if spots else ''
            else:
                pt['scenic_spot_name'] = ''

        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/checkin-points/<cid>')
@admin_required
def admin_checkin_point_detail(cid):
    try:
        rows = query('SELECT * FROM checkin_points WHERE id=%s', [cid])
        if not rows:
            return fail('打卡点不存在')
        return ok(rows[0])
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/checkin-points', methods=['POST'])
@admin_required
def admin_checkin_point_create():
    try:
        data = request.get_json(force=True)
        # 创建时始终生成新 ID，避免前端传已有 ID 导致主键冲突
        cid = 'cp_' + uuid.uuid4().hex[:8]
        fields = ['id','name','type','activity_id','scenic_spot_id','cover','latitude','longitude','description',
                  'angle','composition','best_time','crowd_level','crowd_peak','crowd_morning',
                  'crowd_noon','crowd_afternoon','crowd_evening','tips','taboos','landmark',
                  'popularity','popularity_text','charge_type','charge_price','charge_note','distance','review_status','publish_status']
        # 管理员创建默认审核通过 + 默认上架
        if not data.get('review_status'):
            data['review_status'] = 'approved'
        if not data.get('publish_status'):
            data['publish_status'] = 'listed'
        vals = [(cid if f == 'id' else data.get(f, '')) for f in fields]
        execute(f"INSERT INTO checkin_points ({','.join(fields)}) VALUES ({','.join(['%s']*len(fields))})", vals)
        return ok({'id': cid}, '创建成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/checkin-points/<cid>', methods=['PUT'])
@admin_required
def admin_checkin_point_update(cid):
    try:
        data = request.get_json(force=True)
        updatable = ['name','type','activity_id','scenic_spot_id','cover','latitude','longitude','description',
                     'angle','composition','best_time','crowd_level','crowd_peak','crowd_morning',
                     'crowd_noon','crowd_afternoon','crowd_evening','tips','taboos','landmark',
                     'popularity','popularity_text','charge_type','charge_price','charge_note','distance','review_status','publish_status']
        sets = []
        vals = []
        for f in updatable:
            if f in data:
                sets.append(f'{f}=%s')
                vals.append(data[f])
        if sets:
            vals.append(cid)
            execute(f"UPDATE checkin_points SET {','.join(sets)} WHERE id=%s", vals)
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/checkin-points/<cid>', methods=['DELETE'])
@admin_required
def admin_checkin_point_delete(cid):
    try:
        execute('DELETE FROM checkin_points WHERE id=%s', [cid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/checkin-points/<cid>/publish', methods=['PUT'])
@admin_required
def admin_checkin_point_publish(cid):
    """上架/下架打卡点"""
    try:
        data = request.get_json(force=True) or {}
        status = data.get('publish_status', 'listed')
        if status not in ('listed', 'unlisted'):
            return fail('状态无效，仅支持 listed/unlisted')
        execute('UPDATE checkin_points SET publish_status=%s WHERE id=%s', [status, cid])
        return ok(msg='已上架' if status == 'listed' else '已下架')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/checkin-points/<cid>/approve', methods=['PUT'])
@admin_required
def admin_checkin_point_approve(cid):
    """审核通过/拒绝打卡点"""
    try:
        data = request.get_json(force=True) or {}
        status = data.get('review_status', 'approved')
        if status not in ('approved', 'rejected'):
            return fail('审核状态无效，仅支持 approved/rejected')
        execute('UPDATE checkin_points SET review_status=%s WHERE id=%s', [status, cid])
        return ok(msg='审核通过' if status == 'approved' else '已拒绝')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 打卡点 Excel 导入
# ============================================================
CHECKIN_FIELDS = ['name','type','activity_id','scenic_spot_id','cover','latitude','longitude','description',
                  'angle','composition','best_time','crowd_level','crowd_peak','crowd_morning',
                  'crowd_noon','crowd_afternoon','crowd_evening','tips','taboos','landmark',
                  'popularity','popularity_text','charge_type','charge_price','charge_note','distance']

CHECKIN_TEMPLATE_HEADERS = CHECKIN_FIELDS

# 中文表头（模板展示用）
CHECKIN_CN_HEADERS = [
    '打卡点名称', '类型(scenic/activity)', '关联活动ID(选填)', '所属景区ID(选填)', '封面图链接', '纬度', '经度', '描述',
    '拍摄角度', '构图建议', '最佳拍摄时间', '人流等级', '人流高峰时段',
    '上午人流', '中午人流', '下午人流', '傍晚人流', '拍摄小贴士',
    '禁忌事项', '地标/位置描述', '人气值', '人气描述',
    '收费类型(free/paid)', '收费价格(元)', '收费说明', '参照距离(米)'
]
# 中文→英文字段名映射（兼容模板 + 外部数据源两种表头）
CHECKIN_CN_TO_EN = {
    # ── 标准模板表头 ──
    '打卡点名称': 'name',
    '类型(scenic/activity)': 'type',
    '关联活动ID(选填)': 'activity_id',
    '所属景区ID(选填)': 'scenic_spot_id',
    '封面图链接': 'cover',
    '纬度': 'latitude',
    '经度': 'longitude',
    '描述': 'description',
    '拍摄角度': 'angle',
    '构图建议': 'composition',
    '最佳拍摄时间': 'best_time',
    '人流等级': 'crowd_level',
    '人流高峰时段': 'crowd_peak',
    '上午人流': 'crowd_morning',
    '中午人流': 'crowd_noon',
    '下午人流': 'crowd_afternoon',
    '傍晚人流': 'crowd_evening',
    '拍摄小贴士': 'tips',
    '禁忌事项': 'taboos',
    '地标/位置描述': 'landmark',
    '人气值': 'popularity',
    '人气描述': 'popularity_text',
    '收费类型(free/paid)': 'charge_type',
    '收费价格(元)': 'charge_price',
    '收费说明': 'charge_note',
    '参照距离(米)': 'distance',
    # ── 外部数据源表头（与模板不同的中文名） ──
    '关联ID(景区/活动)': 'activity_id',
    '打卡点描述': 'description',
    '位置名称': 'landmark',
    '开放时间': 'best_time',
    '推荐时间段': 'crowd_peak',
    '小贴士': 'tips',
    '打卡点类型(小众/热门)': 'popularity_text',
    '热度值': 'popularity',
    '费用说明': 'charge_note',
    '费用预估(元)': 'charge_price',
    '拍摄建议': 'composition',
    '网格坐标(格)': 'distance',
}

# 额外字段 → 拼入 tips（数据库无对应列，保留到 tips 中）
CHECKIN_EXTRA_TIPS_MAP = {
    '交通方式': '交通方式',
    '最佳拍照时间': '最佳拍照时间',
    '季节性推荐': '季节性推荐',
    '难度评级': '难度评级',
    '适合人群': '适合人群',
    '关联景区': '关联景区',
    '最佳季节': '最佳季节',
}

@admin_bp.route('/checkin-points/template')
@admin_required
def checkin_point_template():
    """下载打卡点导入模板"""
    try:
        from openpyxl import Workbook
        wb = Workbook()
        ws = wb.active
        ws.title = '打卡点导入模板'
        # 表头行用中文
        ws.append(CHECKIN_CN_HEADERS)
        # 冻结表头行
        ws.freeze_panes = 'A2'
        # 表头样式
        from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
        header_fill = PatternFill(start_color='4472C4', end_color='4472C4', fill_type='solid')
        header_font = Font(name='微软雅黑', bold=True, color='FFFFFF', size=10)
        header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
        thin_border = Border(
            left=Side(style='thin', color='D9D9D9'),
            right=Side(style='thin', color='D9D9D9'),
            top=Side(style='thin', color='D9D9D9'),
            bottom=Side(style='thin', color='D9D9D9')
        )
        for cell in ws[1]:
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = header_align
            cell.border = thin_border
        # 写入示例数据
        sample_data = [
            '示例打卡点', 'scenic', '', '', 25.6756, 100.1623, '打卡点描述',
            '正面45度', '三分法', '日出时分', '舒适', '10:00-14:00',
            '较少', '较多', '较多', '适中', '拍摄小贴士',
            '禁忌事项', '大理古城南门', 5000, '人气热门',
            'free', '', '', 0
        ]
        ws.append(sample_data)
        # 示例数据行样式
        sample_fill = PatternFill(start_color='F2F2F2', end_color='F2F2F2', fill_type='solid')
        sample_font = Font(name='微软雅黑', size=10, color='808080')
        for cell in ws[2]:
            cell.fill = sample_fill
            cell.font = sample_font
            cell.alignment = Alignment(vertical='center', wrap_text=True)
            cell.border = thin_border
        # 设置列宽
        for col_idx in range(1, len(CHECKIN_CN_HEADERS) + 1):
            col_letter = ws.cell(1, col_idx).column_letter
            ws.column_dimensions[col_letter].width = 18
        ws.row_dimensions[1].height = 36
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return send_file(output, mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                         as_attachment=True, download_name='checkin_points_template.xlsx')
    except Exception as e:
        return fail(f'生成模板失败: {str(e)}')

@admin_bp.route('/checkin-points/import', methods=['POST'])
@admin_required
def checkin_point_import():
    """从 Excel 批量导入打卡点"""
    try:
        from openpyxl import load_workbook
        file = request.files.get('file')
        if not file:
            return fail('请上传文件')
        if not file.filename.endswith(('.xlsx', '.xls')):
            return fail('仅支持 .xlsx / .xls 格式')

        wb = load_workbook(file, read_only=True)
        ws = _find_import_sheet(wb, expected_min_cols=10)
        rows = list(ws.iter_rows(values_only=True))
        if len(rows) < 2:
            return fail('文件中无数据行')

        # 解析表头（兼容中文和英文表头）
        raw_headers = [str(h).strip() if h else '' for h in rows[0]]
        headers = []
        raw_header_map = {}  # index → raw_header 用于特殊列处理
        for i, h in enumerate(raw_headers):
            headers.append(CHECKIN_CN_TO_EN.get(h, h))
            raw_header_map[i] = h
        success = 0
        errors = []
        row_num = 0

        for row_data in rows[1:]:
            row_num += 1
            try:
                if not any(row_data):
                    continue
                data_dict = {}
                extra_tips_parts = []

                for i, mapped_key in enumerate(headers):
                    if i >= len(row_data):
                        continue
                    val = row_data[i]
                    raw_h = raw_header_map.get(i, '')

                    # 额外字段 → 收集拼入 tips
                    if raw_h in CHECKIN_EXTRA_TIPS_MAP:
                        if val is not None and str(val).strip():
                            extra_tips_parts.append(f'【{CHECKIN_EXTRA_TIPS_MAP[raw_h]}】{str(val).strip()}')
                        continue

                    # 是否热门 → crowd_level + popularity_text
                    if raw_h == '是否热门':
                        is_hot = int(val) if val is not None else 0
                        data_dict['crowd_level'] = '拥挤' if is_hot == 1 else '舒适'
                        if not data_dict.get('popularity_text'):
                            data_dict['popularity_text'] = '热门' if is_hot == 1 else '小众'
                        continue

                    # 是否免费 → charge_type 标准化
                    if raw_h == '是否免费(free/paid)':
                        v = str(val).strip().lower() if val is not None else 'free'
                        data_dict['charge_type'] = v if v in ('free', 'paid') else 'free'
                        continue

                    str_val = str(val).strip() if val is not None else ''
                    data_dict[mapped_key] = str_val

                # 合并 tips：主 tips + 额外字段
                main_tip = data_dict.get('tips', '')
                if extra_tips_parts:
                    data_dict['tips'] = (main_tip + '\n' if main_tip else '') + '\n'.join(extra_tips_parts)

                # 生成 ID
                ctype = data_dict.get('type', 'scenic')
                if ctype not in ('scenic', 'activity'):
                    if '活动' in ctype:
                        ctype = 'activity'
                    else:
                        ctype = 'scenic'
                prefix = 'cp_' if ctype == 'activity' else 'sp_'
                cid = prefix + uuid.uuid4().hex[:8]

                values = [cid]
                for f in CHECKIN_FIELDS:
                    val = data_dict.get(f, '')
                    if f in ('latitude', 'longitude', 'distance'):
                        try:
                            val = float(val) if val else 0
                        except ValueError:
                            val = 0
                    elif f == 'popularity':
                        try:
                            val = int(float(val)) if val else 0
                        except ValueError:
                            val = 0
                    values.append(val)

                execute(
                    f"INSERT INTO checkin_points (id,{','.join(CHECKIN_FIELDS)}) VALUES ({','.join(['%s']*(len(CHECKIN_FIELDS)+1))})",
                    values
                )
                success += 1
            except Exception as row_err:
                errors.append(f'第{row_num}行: {str(row_err)}')

        msg = f'成功导入 {success} 条'
        if errors:
            msg += f'，{len(errors)} 条失败'
        return ok({'success': success, 'errors': errors[:20]}, msg)
    except Exception as e:
        return fail(f'导入失败: {str(e)}')

# ============================================================
# 现场发文管理
# ============================================================
@admin_bp.route('/live-posts')
@admin_required
def admin_live_posts():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        keyword = request.args.get('keyword', '')
        is_hidden = request.args.get('is_hidden', '')
        offset_val = (page - 1) * size

        sql = 'SELECT * FROM live_posts WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM live_posts WHERE 1=1'
        params = []
        if keyword:
            c = ' AND (user_name LIKE %s OR content LIKE %s OR location LIKE %s)'
            sql += c; count_sql += c
            params.extend([f'%{keyword}%'] * 3)
        if is_hidden != '':
            sql += ' AND is_hidden = %s'
            count_sql += ' AND is_hidden = %s'
            params.append(int(is_hidden))

        sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/live-posts/<pid>', methods=['DELETE'])
@admin_required
def admin_live_post_delete(pid):
    try:
        execute('DELETE FROM live_post_images WHERE post_id=%s', [pid])
        execute('DELETE FROM live_posts WHERE id=%s', [pid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 社区攻略管理
# ============================================================
@admin_bp.route('/community-posts')
@admin_required
def admin_community_posts():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        keyword = request.args.get('keyword', '')
        offset_val = (page - 1) * size

        sql = 'SELECT * FROM community_posts WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM community_posts WHERE 1=1'
        params = []
        if keyword:
            c = ' AND (title LIKE %s OR content LIKE %s)'
            sql += c; count_sql += c
            params.extend([f'%{keyword}%'] * 2)

        sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])
        # 附带标签
        if rows:
            pids = [r['id'] for r in rows]
            placeholders = ','.join(['%s'] * len(pids))
            tags = query(f'SELECT post_id,tag FROM community_tags WHERE post_id IN ({placeholders})', pids)
            tag_map = {}
            for t in tags:
                tag_map.setdefault(t['post_id'], []).append(t['tag'])
            for post in rows:
                post['tags'] = tag_map.get(post['id'], [])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/community-posts/<pid>')
@admin_required
def admin_community_post_detail(pid):
    try:
        rows = query('SELECT * FROM community_posts WHERE id=%s', [pid])
        if not rows:
            return fail('不存在')
        post = rows[0]
        tags = query('SELECT tag FROM community_tags WHERE post_id=%s', [pid])
        post['tags'] = [t['tag'] for t in tags]
        return ok(post)
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/community-posts', methods=['POST'])
@admin_required
def admin_community_post_create():
    try:
        data = request.get_json(force=True)
        pid = data.get('id') or 'com_' + uuid.uuid4().hex[:8]
        execute(
            'INSERT INTO community_posts (id,user_name,user_avatar,title,cover,content,post_date) VALUES (%s,%s,%s,%s,%s,%s,%s)',
            [pid, data.get('user_name','管理员'), data.get('user_avatar',''), data.get('title',''),
             data.get('cover',''), data.get('content',''), data.get('post_date', datetime.now().strftime('%Y-%m-%d'))]
        )
        tags = data.get('tags', [])
        for tag in tags:
            t = tag.strip() if isinstance(tag, str) else tag.get('tag','').strip()
            if t:
                execute('INSERT INTO community_tags (post_id,tag) VALUES (%s,%s)', [pid, t])
        return ok({'id': pid}, '创建成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/community-posts/<pid>', methods=['PUT'])
@admin_required
def admin_community_post_update(pid):
    try:
        data = request.get_json(force=True)
        updatable = ['user_name','title','cover','content','post_date']
        sets = []
        vals = []
        for f in updatable:
            if f in data:
                sets.append(f'{f}=%s')
                vals.append(data[f])
        if sets:
            vals.append(pid)
            execute(f"UPDATE community_posts SET {','.join(sets)} WHERE id=%s", vals)
        if 'tags' in data:
            execute('DELETE FROM community_tags WHERE post_id=%s', [pid])
            for tag in data['tags']:
                t = tag.strip() if isinstance(tag, str) else tag.get('tag','').strip()
                if t:
                    execute('INSERT INTO community_tags (post_id,tag) VALUES (%s,%s)', [pid, t])
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/community-posts/<pid>', methods=['DELETE'])
@admin_required
def admin_community_post_delete(pid):
    try:
        execute('DELETE FROM community_tags WHERE post_id=%s', [pid])
        execute('DELETE FROM community_posts WHERE id=%s', [pid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 首页照片管理
# ============================================================
@admin_bp.route('/homepage-photos')
@admin_required
def admin_homepage_photos():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        offset_val = (page - 1) * size
        total = query('SELECT COUNT(*) as total FROM homepage_photos')[0]['total']
        rows = query('SELECT * FROM homepage_photos ORDER BY sort_order ASC, created_at DESC LIMIT %s OFFSET %s',
                     [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/homepage-photos', methods=['POST'])
@admin_required
def admin_homepage_photo_create():
    try:
        data = request.get_json(force=True)
        pid = data.get('id') or 'hp_' + uuid.uuid4().hex[:8]
        execute(
            'INSERT INTO homepage_photos (id,image_url,user_name,user_avatar,shoot_date,weather,temperature,sort_order) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
            [pid, data.get('image_url',''), data.get('user_name',''), data.get('user_avatar',''),
             data.get('shoot_date',''), data.get('weather',''), data.get('temperature',''), data.get('sort_order',0)]
        )
        return ok({'id': pid}, '添加成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/homepage-photos/<pid>', methods=['PUT'])
@admin_required
def admin_homepage_photo_update(pid):
    try:
        data = request.get_json(force=True)
        updatable = ['image_url','user_name','user_avatar','shoot_date','weather','temperature','sort_order']
        sets = []
        vals = []
        for f in updatable:
            if f in data:
                sets.append(f'{f}=%s')
                vals.append(data[f])
        if sets:
            vals.append(pid)
            execute(f"UPDATE homepage_photos SET {','.join(sets)} WHERE id=%s", vals)
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/homepage-photos/<pid>', methods=['DELETE'])
@admin_required
def admin_homepage_photo_delete(pid):
    try:
        execute('DELETE FROM homepage_photos WHERE id=%s', [pid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 本地生活管理
# ============================================================
@admin_bp.route('/locallife-items')
@admin_required
def admin_locallife_items():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        category = request.args.get('category', '')
        keyword = request.args.get('keyword', '')
        offset_val = (page - 1) * size

        sql = 'SELECT * FROM local_life_items WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM local_life_items WHERE 1=1'
        params = []
        if category:
            sql += ' AND category=%s'; count_sql += ' AND category=%s'; params.append(category)
        if keyword:
            sql += ' AND name LIKE %s'; count_sql += ' AND name LIKE %s'; params.append(f'%{keyword}%')

        sql += ' ORDER BY sort_order ASC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/locallife-items', methods=['POST'])
@admin_required
def admin_locallife_item_create():
    try:
        data = request.get_json(force=True)
        lid = data.get('id') or 'll_' + uuid.uuid4().hex[:8]
        fields = ['id','category','name','cover','item_type','rating','price','location','description','sort_order']
        vals = [(lid if f == 'id' else data.get(f, '')) for f in fields]
        execute(f"INSERT INTO local_life_items ({','.join(fields)}) VALUES ({','.join(['%s']*len(fields))})", vals)
        return ok({'id': lid}, '创建成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/locallife-items/<lid>', methods=['PUT'])
@admin_required
def admin_locallife_item_update(lid):
    try:
        data = request.get_json(force=True)
        updatable = ['category','name','cover','item_type','rating','price','location','description','sort_order']
        sets = []
        vals = []
        for f in updatable:
            if f in data:
                sets.append(f'{f}=%s')
                vals.append(data[f])
        if sets:
            vals.append(lid)
            execute(f"UPDATE local_life_items SET {','.join(sets)} WHERE id=%s", vals)
        return ok(msg='更新成功')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/locallife-items/<lid>', methods=['DELETE'])
@admin_required
def admin_locallife_item_delete(lid):
    try:
        execute('DELETE FROM local_life_items WHERE id=%s', [lid])
        return ok(msg='已删除')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 区域管理
# ============================================================
@admin_bp.route('/districts')
@admin_required
def admin_districts():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        offset_val = (page - 1) * size
        total = query('SELECT COUNT(*) as total FROM districts')[0]['total']
        rows = query('SELECT * FROM districts ORDER BY sort_order ASC LIMIT %s OFFSET %s', [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/districts', methods=['POST'])
@admin_required
def admin_district_create():
    data = request.get_json(force=True)
    execute('INSERT INTO districts (code,name,sort_order) VALUES (%s,%s,%s)',
            [data.get('code'), data.get('name'), data.get('sort_order', 0)])
    return ok(msg='添加成功')

@admin_bp.route('/districts/<int:did>', methods=['PUT'])
@admin_required
def admin_district_update(did):
    data = request.get_json(force=True)
    execute('UPDATE districts SET code=%s,name=%s,sort_order=%s WHERE id=%s',
            [data.get('code'), data.get('name'), data.get('sort_order', 0), did])
    return ok(msg='更新成功')

@admin_bp.route('/districts/<int:did>', methods=['DELETE'])
@admin_required
def admin_district_delete(did):
    execute('DELETE FROM districts WHERE id=%s', [did])
    return ok(msg='已删除')

# ============================================================
# 用户管理
# ============================================================
@admin_bp.route('/users')
@admin_required
def admin_users():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        keyword = request.args.get('keyword', '')
        offset_val = (page - 1) * size

        sql = 'SELECT id,nickname,avatar,phone,is_logged_in,status,ban_until,ban_reason,created_at FROM users WHERE 1=1'
        count_sql = 'SELECT COUNT(*) as total FROM users WHERE 1=1'
        params = []
        if keyword:
            c = ' AND (nickname LIKE %s OR phone LIKE %s)'
            sql += c; count_sql += c
            params.extend([f'%{keyword}%'] * 2)

        sql += ' ORDER BY created_at DESC LIMIT %s OFFSET %s'
        total = query(count_sql, params)[0]['total']
        rows = query(sql, params + [size, offset_val])
        # 附带各用户统计
        for u in rows:
            u['booking_count'] = query('SELECT COUNT(*) as cnt FROM user_bookings WHERE user_id=%s', [u['id']])[0]['cnt']
            u['post_count'] = query('SELECT COUNT(*) as cnt FROM live_posts WHERE user_id=%s', [u['id']])[0]['cnt']
            u['fav_count'] = query('SELECT COUNT(*) as cnt FROM user_favorites WHERE user_id=%s', [u['id']])[0]['cnt']
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/users/<int:uid>', methods=['DELETE'])
@admin_required
def admin_user_delete(uid):
    try:
        execute('DELETE FROM user_bookings WHERE user_id=%s', [uid])
        execute('DELETE FROM user_favorites WHERE user_id=%s', [uid])
        execute('DELETE FROM user_likes WHERE user_id=%s', [uid])
        execute('DELETE FROM search_history WHERE user_id=%s', [uid])
        execute('DELETE FROM users WHERE id=%s', [uid])
        return ok(msg='已删除用户及关联数据')
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/users/<int:uid>/ban', methods=['PUT'])
@admin_required
def admin_user_ban(uid):
    """封禁用户: type=disabled(禁用登录) 或 muted(禁闭,有截止时间)"""
    try:
        data = request.get_json() or {}
        ban_type = data.get('type', 'disabled')       # 'disabled' 或 'muted'
        reason = data.get('reason', '')
        duration_hours = data.get('duration_hours', None)  # 仅 muted 用, None=永久

        if ban_type == 'muted' and duration_hours:
            from datetime import datetime, timedelta
            ban_until = datetime.now() + timedelta(hours=int(duration_hours))
            execute('UPDATE users SET status=%s, ban_until=%s, ban_reason=%s WHERE id=%s',
                    ['muted', ban_until.strftime('%Y-%m-%d %H:%M:%S'), reason, uid])
            return ok(msg=f'已禁闭用户，{duration_hours}小时后自动解除')
        elif ban_type == 'muted':
            execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=%s WHERE id=%s',
                    ['muted', reason, uid])
            return ok(msg='已禁闭用户（永久）')
        else:
            execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=%s WHERE id=%s',
                    ['disabled', reason, uid])
            return ok(msg='已禁用用户，该用户将无法登录')

    except Exception as e:
        return fail(str(e))

@admin_bp.route('/users/<int:uid>/unban', methods=['PUT'])
@admin_required
def admin_user_unban(uid):
    """解除封禁/禁闭，恢复正常"""
    try:
        execute('UPDATE users SET status=%s, ban_until=NULL, ban_reason=NULL WHERE id=%s',
                ['active', uid])
        return ok(msg='已解除封禁，用户恢复正常')
    except Exception as e:
        return fail(str(e))

# ============================================================
# 预约管理
# ============================================================
@admin_bp.route('/bookings')
@admin_required
def admin_bookings():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        offset_val = (page - 1) * size
        sql = '''SELECT ub.*, u.nickname as user_nickname, a.name as activity_name 
                 FROM user_bookings ub
                 LEFT JOIN users u ON ub.user_id = u.id
                 LEFT JOIN activities a ON ub.activity_id = a.id
                 ORDER BY ub.created_at DESC LIMIT %s OFFSET %s'''
        total = query('SELECT COUNT(*) as total FROM user_bookings')[0]['total']
        rows = query(sql, [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

# ============================================================
# 系统配置
# ============================================================
@admin_bp.route('/config')
@admin_required
def admin_configs():
    try:
        page = int(request.args.get('page', 1))
        size = int(request.args.get('size', 20))
        offset_val = (page - 1) * size
        total = query('SELECT COUNT(*) as total FROM app_config')[0]['total']
        rows = query('SELECT * FROM app_config ORDER BY `key` ASC LIMIT %s OFFSET %s', [size, offset_val])
        return ok({'list': rows, 'total': total, 'page': page, 'size': size})
    except Exception as e:
        return fail(str(e))

@admin_bp.route('/config', methods=['POST'])
@admin_required
def admin_config_set():
    data = request.get_json(force=True)
    execute(
        'INSERT INTO app_config (`key`,`value`) VALUES (%s,%s) ON DUPLICATE KEY UPDATE `value`=%s',
        [data['key'], data['value'], data['value']]
    )
    return ok(msg='已保存')

@admin_bp.route('/config/<key>', methods=['DELETE'])
@admin_required
def admin_config_delete(key):
    execute('DELETE FROM app_config WHERE `key`=%s', [key])
    return ok(msg='已删除')
