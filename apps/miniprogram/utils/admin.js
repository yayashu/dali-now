/**
 * 管理后台 API 工具
 * 使用 X-Admin-Token header 认证，与用户 API 分离
 */
const { API_BASE } = require('./config')

/**
 * 管理员 API 请求
 */
function adminRequest(method, path, data) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('admin_token') || ''
    wx.request({
      url: API_BASE + '/admin' + path,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'X-Admin-Token': token
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          if (res.data.code === 0) {
            resolve(res.data.data)
          } else if (res.data.code === -1 && (res.data.msg || '').includes('登录')) {
            // token 过期，清除并跳转登录
            wx.removeStorageSync('admin_token')
            wx.redirectTo({ url: '/pages/admin/login/login' })
            reject(new Error('登录已过期'))
          } else {
            reject(new Error(res.data.msg || '请求失败'))
          }
        } else if (res.statusCode === 401) {
          wx.removeStorageSync('admin_token')
          wx.redirectTo({ url: '/pages/admin/login/login' })
          reject(new Error('未登录'))
        } else {
          reject(new Error('服务器错误'))
        }
      },
      fail: (err) => {
        reject(new Error('网络错误'))
      }
    })
  })
}

function adminGet(path, params) {
  const queryStr = params ? '?' + Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&') : ''
  return adminRequest('GET', path + queryStr)
}

function adminPost(path, data) {
  return adminRequest('POST', path, data)
}

function adminPut(path, data) {
  return adminRequest('PUT', path, data)
}

function adminDelete(path, data) {
  return adminRequest('DELETE', path, data || {})
}

module.exports = {
  adminGet,
  adminPost,
  adminPut,
  adminDelete,
  adminRequest
}
