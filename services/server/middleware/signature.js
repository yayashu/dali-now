/**
 * API 请求签名验证中间件
 * ============================================================
 * 防止第三方恶意调用 GET 接口。
 *
 * 签名算法:
 *   Sign = SHA256(timestamp + nonce + method + path + apiSecret)
 *   Client 发送: X-Timestamp, X-Nonce, X-Sign
 *   Server 验证: 时间窗口 ±5分钟, 签名匹配
 *
 * 白名单路径（跳过签名验证）:
 *   /api/user/login — 微信登录
 *   /api/health      — 健康检查
 *   /api/admin/*     — 管理后台(已有独立认证)
 */
const crypto = require('crypto')
const config = require('../config')

const SIGN_WINDOW = (config.signatureWindowSeconds || 300) * 1000
const SKIP_SIGNATURE_PATHS = [
  '/api/user/login',
  '/api/health',
  '/api/sensitive/reload',
  '/api/config'
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

/**
 * GET 请求签名验证中间件
 * 仅对 GET 方法进行签名校验；POST/PUT/DELETE 已有 Bearer Token 认证
 */
function signatureAuth(req, res, next) {
  // 白名单跳过
  if (shouldSkipSignature(req.path)) return next()

  // 仅 GET 请求需要签名（POST/PUT/DELETE 已用 Bearer Token）
  if (req.method !== 'GET') return next()

  const timestamp = req.headers['x-timestamp']
  const nonce = req.headers['x-nonce']
  const sign = req.headers['x-sign']

  if (!timestamp || !nonce || !sign) {
    return res.status(401).json({
      code: -1,
      msg: '请求缺少签名参数(X-Timestamp/X-Nonce/X-Sign)，请通过小程序访问'
    })
  }

  // 验证时间窗口
  const now = Date.now()
  const ts = parseInt(timestamp, 10)
  if (isNaN(ts) || Math.abs(now - ts) > SIGN_WINDOW) {
    return res.status(401).json({
      code: -1,
      msg: '请求签名已过期，请检查设备时间'
    })
  }

  // 验证签名
  const expected = computeSign(timestamp, nonce, req.method, req.path, config.apiSecret)
  if (sign !== expected) {
    return res.status(401).json({
      code: -1,
      msg: '请求签名无效'
    })
  }

  next()
}

module.exports = { signatureAuth }
