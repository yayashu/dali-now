/**
 * 前端敏感词过滤 — 调用服务端预检 API
 * ============================================================
 * 词库储存在 MySQL sensitive_words 表中，不在前端代码明文存放。
 *
 * 用法:
 *   const sensitiveFilter = require('./sensitive-filter.js')
 *
 *   // 方式1: 自动替换敏感词为 *（推荐，静默处理无弹窗）
 *   const cleaned = await sensitiveFilter.clean('用户输入的文字')
 *
 *   // 方式2: 仅检查是否通过
 *   const result = await sensitiveFilter.check('用户输入的文字')
 */

const { API_BASE, _generateGetSignature } = require('./config.js')

// 敏感词检查 URL 固定，签名可以预生成一次（每次调用重新签名以获取新时间戳）
function _getSensitiveCheckHeaders() {
  const sig = _generateGetSignature(`${API_BASE}/sensitive/check`)
  return sig ? { 'X-Timestamp': sig.timestamp, 'X-Nonce': sig.nonce, 'X-Sign': sig.sign } : {}
}

// 同步检查（用于已有网络环境的页面中，由调用方自行 await）
function check(text) {
  return new Promise((resolve) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      resolve({ passed: true, hits: [], message: '' })
      return
    }

    wx.request({
      url: `${API_BASE}/sensitive/check`,
      data: { text },
      method: 'GET',
      header: _getSensitiveCheckHeaders(),
      timeout: 3000,
      success(res) {
        if (res.statusCode === 200 && res.data) {
          const d = res.data
          resolve({
            passed: d.passed !== undefined ? d.passed : (d.code === 0),
            hits: d.hits || [],
            message: d.msg || ''
          })
        } else {
          // 服务异常时放行，避免阻塞用户发布
          resolve({ passed: true, hits: [], message: '' })
        }
      },
      fail() {
        // 网络异常时放行
        resolve({ passed: true, hits: [], message: '' })
      }
    })
  })
}

/**
 * 自动替换敏感词为 *，静默处理不弹窗
 * @param {string} text - 原始文本
 * @returns {string} 替换后的安全文本（服务异常/无敏感词时返回原文本）
 */
function clean(text) {
  return new Promise((resolve) => {
    if (!text || typeof text !== 'string' || !text.trim()) {
      resolve(text || '')
      return
    }

    wx.request({
      url: `${API_BASE}/sensitive/check`,
      data: { text },
      method: 'GET',
      header: _getSensitiveCheckHeaders(),
      timeout: 3000,
      success(res) {
        if (res.statusCode === 200 && res.data) {
          const d = res.data
          const hits = d.hits || []
          if (hits.length === 0) {
            resolve(text)
            return
          }
          // 按命中的敏感词从长到短排序，优先替换长的（避免短词先替换破坏长词）
          const sorted = [...hits].sort((a, b) => b.length - a.length)
          let result = text
          sorted.forEach(word => {
            // 用全局正则在原文本中替换所有出现位置
            const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            const regex = new RegExp(escaped, 'g')
            result = result.replace(regex, '*'.repeat(word.length))
          })
          resolve(result)
        } else {
          // 服务异常，返回原文本
          resolve(text)
        }
      },
      fail() {
        // 网络异常，返回原文本
        resolve(text)
      }
    })
  })
}

module.exports = { check, clean }
