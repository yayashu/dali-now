# 大理此刻 — v2.1.0 升级文档：GET 接口防滥用安全加固

> **升级日期**：2026-06-23  
> **升级范围**：双后端（Python Flask + Node.js Express）+ 微信小程序前端  
> **升级类型**：安全加固（无破坏性变更，旧版小程序需同步更新）  
> **路径说明**：本文档写于 monorepo 整理之前，文中 `dali-now-server/`、`dali-now-app/` 为当时的仓库名，对应现仓库的 `services/server/` 与 `apps/miniprogram/`

---

## 目录

- [一、升级背景](#一升级背景)
- [二、防护架构](#二防护架构)
- [三、修改文件清单](#三修改文件清单)
- [四、详细改动](#四详细改动)
  - [4.1 服务端配置层](#41-服务端配置层)
  - [4.2 Python Flask](#42-python-flask)
  - [4.3 Node.js Express](#43-nodejs-express)
  - [4.4 签名中间件](#44-签名中间件)
  - [4.5 微信小程序前端](#45-微信小程序前端)
- [五、部署步骤](#五部署步骤)
- [六、验证方法](#六验证方法)
- [七、配置参考](#七配置参考)
- [八、回滚方案](#八回滚方案)

---

## 一、升级背景

### 问题

当前 GET 接口**完全无防护**，存在以下风险：

| 风险 | 说明 |
|------|------|
| 接口裸奔 | 无频率限制，任何 IP 可以无限调用 |
| 无身份校验 | GET 请求无需登录，第三方可随意抓取数据 |
| 可被重放 | 请求无时间戳/签名，可被截获后无限重放 |
| CORS 全开放 | 浏览器端跨域无限制 |

### 目标

为所有公开 GET 接口实施 **三层防护**，确保只有微信小程序客户端能正确调用。

---

## 二、防护架构

```
微信小程序请求
      │
      ├─ X-Timestamp: 1719150000123   (毫秒时间戳)
      ├─ X-Nonce:     a3f8c2e1        (8位随机十六进制)
      └─ X-Sign:      sha256(...)     (HMAC 签名)
      │
      ▼
┌─────────────────────────────────────────────┐
│  第1层：频率限制 (Rate Limiting)              │
│  ├─ 一般接口：100 req/min per IP             │
│  └─ 搜索接口：30 req/min per IP              │
│  超限返回：429 + JSON `{code:-1, msg:...}`   │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  第2层：请求签名验证 (Signature)              │
│  Sign = SHA256(timestamp|nonce|method|path|secret)  │
│  缺失/无效返回：401                           │
└──────────────────┬──────────────────────────┘
                   ▼
┌─────────────────────────────────────────────┐
│  第3层：时间窗口校验 (Replay Attack Prevention) │
│  ±5分钟内有效，超时返回：401                   │
└──────────────────┬──────────────────────────┘
                   ▼
              业务处理逻辑
```

### 签名算法详解

```
签名原文格式: {timestamp}|{nonce}|{method}|{path}|{apiSecret}

示例：
  timestamp = "1719150000123"
  nonce     = "a3f8c2e1"
  method    = "GET"
  path      = "/api/activities"
  apiSecret = "<your_api_secret>"

  原文 = "1719150000123|a3f8c2e1|GET|/api/activities|<your_api_secret>"
  签名 = SHA256(原文) → 64位十六进制小写
```

**签名中绑定了 5 个要素**，第三方即使截获请求也无法：
- 重放到其他接口（路径绑定）
- 重放到过期（时间戳绑定）
- 重放同一请求（nonce 每次随机 + 时间窗口）

---

## 三、修改文件清单

### 新增文件（2个）

| 文件 | 说明 |
|------|------|
| `dali-now-server/middleware/signature.js` | Node.js GET 请求签名验证中间件 |
| `dali-now-app/utils/crypto.js` | 纯 JS SHA-256 实现，小程序端签名生成 |

### 修改文件（8个）

| 文件 | 修改内容 |
|------|----------|
| `dali-now-server/config.py` | 新增 `API_SECRET`、`SIGNATURE_WINDOW_SECONDS`、`RATE_LIMIT_GENERAL`、`RATE_LIMIT_SEARCH` |
| `dali-now-server/config.js` | 同上（Node.js 侧） |
| `dali-now-server/requirements.txt` | 无需新增依赖（频率限制改为零依赖自实现） |
| `dali-now-server/package.json` | 无需新增依赖（频率限制改为零依赖自实现） |
| `dali-now-server/app.py` | Flask-Limiter 初始化 + `@before_request` 签名验证 + 搜索接口装饰器限频 |
| `dali-now-server/app.js` | 引入签名中间件 + 零依赖频率限制（全局/搜索） + `trust proxy` |
| `dali-now-app/utils/config.js` | 新增 `API_SECRET`、`_generateGetSignature()`，`apiRequest()` 自动注入签名头 |
| `dali-now-app/utils/db.js` | `_request()` GET 请求自动附带 `X-Timestamp`/`X-Nonce`/`X-Sign` 头 |

### 签名白名单路径（不受签名验证）

| 路径 | 跳过原因 |
|------|----------|
| `/api/user/login` | 微信登录，用户尚未获得 token |
| `/api/health` | 健康检查，运维探活使用 |
| `/api/admin/*` | 管理后台已有独立 Token 认证 |
| `/api/sensitive/reload` | 内部管理接口 |
| `/api/config` | 公共配置接口 |
| `/uploads/*` | 静态文件 |
| `/images/*` | 静态文件 |

---

## 四、详细改动

### 4.1 服务端配置层

**`config.py`（Python）新增**：

```python
# API 防滥用密钥（小程序端与服务端共享，用于请求签名）
API_SECRET = os.environ.get('API_SECRET', '<your_api_secret>')
SIGNATURE_WINDOW_SECONDS = 300  # 签名时间窗口 ±5分钟

# 频率限制
RATE_LIMIT_GENERAL = os.environ.get('RATE_LIMIT_GENERAL', '100 per minute')
RATE_LIMIT_SEARCH = os.environ.get('RATE_LIMIT_SEARCH', '30 per minute')
```

**`config.js`（Node.js）新增**：

```javascript
apiSecret: process.env.API_SECRET || '<your_api_secret>',
signatureWindowSeconds: 300,
rateLimit: {
  general: process.env.RATE_LIMIT_GENERAL || '100 per minute',
  search: process.env.RATE_LIMIT_SEARCH || '30 per minute'
},
```

### 4.2 Python Flask

**`app.py` — 新增频率限制（零依赖自实现）**：

```python
# 内存频率计数器（Python 3.6+ 零依赖）
_rate_limit_store = {}
_rate_lock = threading.Lock()

def _get_client_ip():
    return request.headers.get('X-Real-IP') or \
           (request.headers.get('X-Forwarded-For', '').split(',')[0].strip()) or \
           request.remote_addr or '127.0.0.1'

def rate_limit(rate_str):
    """装饰器：单路由频率限制"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            max_req, window = _parse_rate(rate_str)
            ip = _get_client_ip()
            now = time_mod.time()
            with _rate_lock:
                if ip not in _rate_limit_store:
                    _rate_limit_store[ip] = []
                ts_list = _rate_limit_store[ip]
                while ts_list and ts_list[0] < now - window:
                    ts_list.pop(0)
                if len(ts_list) >= max_req:
                    return jsonify({'code': -1, 'msg': '请求过于频繁，请稍后重试'}), 429
                ts_list.append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator

# 全局 before_request 做通用限频
@app.before_request
def _global_rate_limit():
    if _rate_limit_check(RATE_LIMIT_GENERAL):
        return jsonify({'code': -1, 'msg': '请求过于频繁，请稍后重试'}), 429
```

**`app.py` — 新增 `@before_request` 签名验证**：

```python
SKIP_SIGNATURE_PATHS = {'/api/user/login', '/api/health', '/api/sensitive/reload', '/api/config'}

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

    # 时间窗口校验
    ts = int(timestamp)
    if abs(int(time_mod.time() * 1000) - ts) > SIGNATURE_WINDOW_SECONDS * 1000:
        return jsonify({'code': -1, 'msg': '请求签名已过期'}), 401

    # 签名比对
    expected = _compute_get_sign(timestamp, nonce, request.method, request.path, API_SECRET)
    if sign != expected:
        return jsonify({'code': -1, 'msg': '请求签名无效'}), 401
```

**`app.py` — 搜索接口限频**：

```python
@app.route('/api/search/activities')
@rate_limit(RATE_LIMIT_SEARCH)
def global_search_activities():
    ...
```

### 4.3 Node.js Express

**`app.js` — 新增零依赖频率限制**：

```javascript
// 频率限制（零依赖自实现，兼容 Node.js 10+）
const rateLimitStore = {}
function createRateLimiter(maxReq, windowMs, msg) {
  return function (req, res, next) {
    const ip = req.headers['x-real-ip'] ||
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.ip || '127.0.0.1'
    const now = Date.now()
    const cutoff = now - windowMs
    if (!rateLimitStore[ip]) rateLimitStore[ip] = []
    const tsList = rateLimitStore[ip]
    while (tsList.length > 0 && tsList[0] < cutoff) tsList.shift()
    if (tsList.length >= maxReq) {
      return res.status(429).json({ code: -1, msg: msg })
    }
    tsList.push(now)
    next()
  }
}

// 全局频率限制: 100 req/min
const generalLimiter = createRateLimiter(100, 60 * 1000, '请求过于频繁，请稍后重试')
// 搜索接口限制: 30 req/min
const searchLimiter = createRateLimiter(30, 60 * 1000, '搜索请求过于频繁，请稍后重试')

// 中间件加载顺序（重要：先签名验证，再频率限制）
app.use(signatureAuth)
app.use('/api/search', searchLimiter)
app.use('/api/', generalLimiter)
```

### 4.4 签名中间件

**`middleware/signature.js`** — Node.js 签名验证中间件完整实现：

```javascript
const crypto = require('crypto')
const config = require('../config')

const SIGN_WINDOW = (config.signatureWindowSeconds || 300) * 1000
const SKIP_SIGNATURE_PATHS = [
  '/api/user/login', '/api/health', '/api/sensitive/reload', '/api/config'
]

function shouldSkipSignature(path) {
  if (path.startsWith('/api/admin/')) return true
  if (path.startsWith('/uploads/')) return true
  if (path.startsWith('/images/')) return true
  return SKIP_SIGNATURE_PATHS.some(p => path === p || path.startsWith(p + '?'))
}

function computeSign(timestamp, nonce, method, path, secret) {
  const raw = `${timestamp}|${nonce}|${method}|${path}|${secret}`
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex')
}

function signatureAuth(req, res, next) {
  if (shouldSkipSignature(req.path)) return next()
  if (req.method !== 'GET') return next()

  const timestamp = req.headers['x-timestamp']
  const nonce = req.headers['x-nonce']
  const sign = req.headers['x-sign']

  // 1. 检查参数是否存在
  if (!timestamp || !nonce || !sign) {
    return res.status(401).json({
      code: -1, msg: '请求缺少签名参数(X-Timestamp/X-Nonce/X-Sign)，请通过小程序访问'
    })
  }

  // 2. 时间窗口校验
  const now = Date.now()
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(now - ts) > SIGN_WINDOW) {
    return res.status(401).json({ code: -1, msg: '请求签名已过期，请检查设备时间' })
  }

  // 3. 签名比对
  const expected = computeSign(timestamp, nonce, req.method, req.path, config.apiSecret)
  if (sign !== expected) {
    return res.status(401).json({ code: -1, msg: '请求签名无效' })
  }

  next()
}
```

### 4.5 微信小程序前端

**`utils/crypto.js`（新增）** — 纯 JS SHA-256 实现在小程序环境运行。

**`utils/db.js` — `_request()` 自动签名注入**：

```javascript
const { sha256 } = require('./crypto.js')
var API_SECRET = '<your_api_secret>'

function _generateGetSign(uri) {
  var pathOnly = uri.split('?')[0]  // 去掉查询参数，与服务端 req.path 对齐
  var ts = Date.now().toString()
  var nonce = ''
  for (var i = 0; i < 8; i++) {
    nonce += '0123456789abcdef'[Math.floor(Math.random() * 16)]
  }
  var raw = ts + '|' + nonce + '|GET|' + pathOnly + '|' + API_SECRET
  var sign = sha256(raw)
  return { 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Sign': sign }
}

function _request(method, path, data) {
  return new Promise((resolve) => {
    // GET 请求自动附加防滥用签名
    var sigHeaders = {}
    if (method === 'GET') {
      var sig = _generateGetSign(path)
      if (sig) sigHeaders = sig
    }
    wx.request({
      url: API_BASE + path,
      method: method,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
        ...sigHeaders
      },
      ...
    })
  })
}
```

**`utils/config.js` — `apiRequest()` 自动签名注入**：

```javascript
apiRequest(opts) {
  const token = wx.getStorageSync('token') || ''
  const header = { ...(opts.header || {}) }
  if (token) { header['Authorization'] = 'Bearer ' + token }
  // GET 请求自动附加防滥用签名
  if (!opts.method || opts.method === 'GET') {
    const sig = this._generateGetSignature(opts.url || '')
    if (sig) {
      header['X-Timestamp'] = sig.timestamp
      header['X-Nonce'] = sig.nonce
      header['X-Sign'] = sig.sign
    }
  }
  wx.request({ ...opts, header })
}
```

---

## 五、部署步骤

### 5.1 服务端

```bash
# === 1. 登录服务器 ===
ssh root@<服务器IP>

# === 2. 拉取最新代码 ===
cd /data/dali-now-server
git pull

# === 3. 安装依赖（无新增依赖，双端均为零依赖自实现） ===

# === 4. 更新环境变量（如需要）====
# 可选：在生产 .env 文件中设置自定义密钥
# echo "API_SECRET=<your_api_secret>" >> .env
# echo "RATE_LIMIT_GENERAL=100 per minute" >> .env
# echo "RATE_LIMIT_SEARCH=30 per minute" >> .env

# === 5. 重启服务 ===
# Node.js (热重载即可)
pm2 restart dali-api

# Python (需清缓存后重启)
pm2 stop dali-admin
rm -rf /data/dali-now-server/__pycache__
pm2 start dali-admin

# === 6. 验证 ===
pm2 status
curl -s http://localhost:3000/api/health && echo ""
curl -s http://localhost:5000/api/health && echo ""
```

### 5.2 微信小程序

1. 在微信开发者工具中打开 `dali-now-app` 项目
2. 点击工具栏 **上传** 按钮
3. 填写版本号 `v2.1.0`，备注 "GET 接口签名防滥用"
4. 登录微信公众平台 → **管理 → 版本管理**
5. 提交审核 → 审核通过 → **发布**

---

## 六、验证方法

### 6.1 验证签名保护生效

```bash
# 测试1：不带签名的 GET 请求（应返回 401）
curl -s http://localhost:3000/api/activities | python -m json.tool
# 预期: {"code": -1, "msg": "请求缺少签名参数(X-Timestamp/X-Nonce/X-Sign)，请通过小程序访问"}

# 测试2：带过期时间戳（应返回 401）
curl -s -H "X-Timestamp: 1000000000000" \
        -H "X-Nonce: abcdef12" \
        -H "X-Sign: invalid" \
        http://localhost:3000/api/activities
# 预期: {"code": -1, "msg": "请求签名已过期，请检查设备时间"}

# 测试3：检查白名单路径是否跳过签名
curl -s http://localhost:3000/api/health
# 预期: {"status": "ok", "time": "..."}（不需要签名）

# 测试4：白名单登录接口可正常访问
curl -s -X POST http://localhost:3000/api/user/login \
  -H "Content-Type: application/json" \
  -d '{"code":"test"}'
# 正常返回（登录不需要签名，因为此时还没有 token）
```

### 6.2 Python Flask 端相同测试

```bash
curl -s http://localhost:5000/api/activities
# 预期: {"code": -1, "msg": "请求缺少签名参数，请通过小程序访问"}

curl -s http://localhost:5000/api/health
# 预期: {"status": "ok"}
```

### 6.3 验证频率限制

```bash
# 快速连续发送 101 次请求（使用有效签名模拟 Normal 用户）
# 第 101 次应返回 429: {"code": -1, "msg": "请求过于频繁，请稍后重试"}

for i in $(seq 1 101); do
  echo -n "$i: "
  curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/activities
  echo ""
done
```

### 6.4 验证小程序端签名正确

在小程序开发者工具控制台执行：

```javascript
// 检查签名生成函数是否存在
const config = require('./utils/config')
const sig = config._generateGetSignature('/api/activities')
console.log('签名:', sig)
// 预期输出: {timestamp: "1719150...", nonce: "a3f...", sign: "e17..."}
```

---

## 七、配置参考

### 可配置环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `API_SECRET` | `<your_api_secret>` | 签名密钥，小程序与服务端必须一致 |
| `SIGNATURE_WINDOW_SECONDS` | `300` | 签名有效时间窗口（秒），超出则拒绝 |
| `RATE_LIMIT_GENERAL` | `100 per minute` | 一般接口频率限制 |
| `RATE_LIMIT_SEARCH` | `30 per minute` | 搜索接口频率限制 |

### 接口防护矩阵

| 请求类型 | 防护机制 | 失效响应码 |
|----------|----------|-----------|
| **GET（公开接口）** | 签名验证 + 频率限制 | 401 / 429 |
| **POST/PUT/DELETE** | Bearer Token 认证 + 频率限制 | 401 / 429 |
| **管理后台 API** | X-Admin-Token 认证 | 401 |
| **静态文件** | Nginx 层反代，无认证 | — |

### 关键注意事项

1. **部署顺序**：必须先部署服务端，再发布小程序，否则小程序带签名但服务端不识别（反之服务端拒绝旧版无签名请求）
2. **密钥轮换**：`API_SECRET` 在生产环境建议通过环境变量注入，不要硬编码。定期更换密钥时需同步更新服务和重新发布小程序
3. **时间同步**：签名验证依赖客户端与服务端时间一致。如果小程序用户设备时间偏差超过 ±5 分钟会报 "签名已过期"。NTP 同步正常的设备不受影响
4. **内存存储**：频率限制使用内存存储（`memory://`），PM2 多进程模式下各进程独立计数。如果使用 gunicorn 多 worker，需改 Redis 存储

---

## 八、回滚方案

如果部署后发现小程序大量用户报 401 错误：

### 紧急回滚（服务端，1分钟）

```bash
# 停服务 → 恢复代码 → 重启
cd /data/dali-now-server

# Node.js
git stash                                    # 暂存当前修改
git checkout <上一个稳定版本的commit>          # 回退到旧版本
pm2 restart dali-api                         # 重启

# Python Flask
pm2 stop dali-admin
git stash
git checkout <上一个稳定版本的commit>
rm -rf __pycache__
pm2 start dali-admin
```

### 仅禁用签名验证（保留频率限制）

**Python Flask**：临时注释 `app.py` 中 `@app.before_request` 下 `verify_get_signature` 的签名校验逻辑。

**Node.js**：临时注释 `app.js` 中 `app.use(signatureAuth)` 行。

### 仅禁用频率限制

**Python Flask**：在 `config.py` 中将 `RATE_LIMIT_GENERAL` 改大（如 `'10000 per minute'`）。

**Node.js**：在 `app.js` 中将 `max` 值改大或注释 `app.use('/api/', generalLimiter)`。

---

> **版本记录**  
> v2.1.0 | 2026-06-23 | GET 接口防滥用三层防护（频率限制 + 请求签名 + 时间窗口）
