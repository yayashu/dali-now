/**
 * 大理此刻 - 全局配置（小程序前端）
 * ============================================================
 * 所有可配置项统一管理，其他文件通过 require 引用。
 */

// 部署自己的服务后，把下面两处替换为实际值
const SERVER_HOST = 'your-domain.com'
const SERVER_PORT = 443
const SERVER_ORIGIN = `https://${SERVER_HOST}`
const API_SECRET = 'your_api_secret_here'   // 必须与服务端环境变量 API_SECRET 一致

module.exports = {
  // ====== 服务连接 ======
  SERVER_HOST,
  SERVER_PORT,
  SERVER_ORIGIN,
  API_BASE: `${SERVER_ORIGIN}/api`,
  STATIC_BASE: `${SERVER_ORIGIN}/`,

  // ====== 图片压缩档位 ======
  imageProfiles: {
    avatar: { maxWidth: 400,  maxHeight: 800,  quality: 75 },
    thumb:  { maxWidth: 600,  maxHeight: 1200, quality: 78 },
    full:   { maxWidth: 1200, maxHeight: 2400, quality: 82 }
  },

  // ====== 图片压缩旧版兼容常量 ======
  imageMaxWidth: 1080,
  imageQuality: 80,

  // ====== 交互行为 ======
  debounceDelay: 300,
  throttleDelay: 300,
  backTopThreshold: 400,
  locationTimeout: 2000,
  apiTimeout: 3000,

  // ====== 热度等级阈值 ======
  heatLevels: {
    boom: 15000,   // 爆火
    hot:  8000     // 热门
  },

  // ====== 默认值 ======
  defaults: {
    nickname: '旅行者·大理'
  },

  // ====== API 请求封装（自动附带认证 Token + 请求签名） ======
  /**
   * 发起带认证的 API 请求
   * @param {object} opts - 同 wx.request 参数，自动注入 Authorization 头和签名
   */
  apiRequest(opts) {
    const token = wx.getStorageSync('token') || ''
    const header = { ...(opts.header || {}) }
    if (token) {
      header['Authorization'] = 'Bearer ' + token
    }
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
  },

  // ====== API 防滥用密钥（与服务端 config.py / config.js 一致） ======
  API_SECRET,

  /**
   * 生成 GET 请求签名
   * Sign = SHA256(timestamp|nonce|GET|path|API_SECRET)
   */
  _generateGetSignature(uri) {
    try {
      var sha256 = require('./crypto.js').sha256
      var ts = Date.now().toString()
      var nonce = ''
      for (var i = 0; i < 8; i++) {
        nonce += '0123456789abcdef'[Math.floor(Math.random() * 16)]
      }
      // 提取路径部分（去掉 http://xxx 前缀和查询参数）
      var path = uri
      if (path.indexOf('://') !== -1) {
        path = path.substring(path.indexOf('/', path.indexOf('://') + 3))
      }
      path = path.split('?')[0]  // 去掉查询参数，与服务端 req.path 对齐
      var raw = ts + '|' + nonce + '|GET|' + path + '|' + API_SECRET
      var sign = sha256(raw)
      return { timestamp: ts, nonce: nonce, sign: sign }
    } catch (e) { return null }
  }
}
