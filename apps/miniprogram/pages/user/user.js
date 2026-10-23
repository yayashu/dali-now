const app = getApp()
const db = require('../../utils/db.js')
const { API_BASE, _generateGetSignature } = require('../../utils/config.js')
const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    isLoggedIn: false,
    userInfo: {
      avatar: '',
      name: '',
      id: ''
    },
    stats: {
      activityCount: 0,
      postCount: 0,
      favCount: 0
    },
    // 封禁状态
    isMuted: false,
    banMessage: ''
  },

  onShow() {
    this.checkLogin()
    this.checkBanStatus()
    this.loadStats()
  },

  checkBanStatus() {
    const app = getApp()
    // 先使用 globalData 即时显示
    this._applyBanStatus(app.globalData)
    // 同时从服务端拉取最新状态
    const userId = app.globalData._userId || wx.getStorageSync('_userId')
    if (!userId || !app.globalData.isLoggedIn) return
    const statusUrl = API_BASE + '/user/' + userId + '/status'
    const statusSig = _generateGetSignature(statusUrl)
    wx.request({
      url: statusUrl,
      method: 'GET',
      header: statusSig ? { 'X-Timestamp': statusSig.timestamp, 'X-Nonce': statusSig.nonce, 'X-Sign': statusSig.sign } : {},
      timeout: 5000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          const info = res.data.data || {}
          // 同步更新 globalData
          app.globalData.userStatus = info.status || 'active'
          app.globalData.banUntil = info.ban_until || null
          app.globalData.banReason = info.ban_reason || ''
          this._applyBanStatus(app.globalData)
        }
      }
    })
  },

  // 应用封禁状态到页面 data
  _applyBanStatus(globalData) {
    // 未登录时不显示任何封禁信息
    if (!globalData.isLoggedIn) {
      this.setData({ isMuted: false, banMessage: '' })
      return
    }
    const status = globalData.userStatus || 'active'
    const isMuted = status === 'muted'
    let banMessage = ''
    if (isMuted) {
      const reason = globalData.banReason || '您的账号已被禁闭'
      const until = globalData.banUntil
      banMessage = reason
      if (until) {
        banMessage += '，预计 ' + until.slice(0, 16) + ' 解除'
      }
      banMessage += '。禁闭期间仅可浏览，不可发布任何内容。'
    }
    this.setData({ isMuted, banMessage })
  },

  checkLogin() {
    const isLoggedIn = app.globalData.isLoggedIn

    let displayAvatar = ''
    let displayName = ''
    let displayId = ''

    if (isLoggedIn) {
      // 登录状态：从全局数据和缓存中读取用户信息
      const globalUser = app.globalData.userInfo || {}
      const storedAvatar = wx.getStorageSync('userAvatar') || ''
      const storedNickname = wx.getStorageSync('userNickname') || ''

      // 过滤掉临时路径（wxfile:// 等），这些路径重启后失效会导致头像空白
      displayAvatar = storedAvatar || globalUser.avatar || ''
      if (displayAvatar && (displayAvatar.startsWith('wxfile://') || displayAvatar.startsWith('http://tmp/'))) {
        displayAvatar = ''
      }

      displayName = storedNickname || globalUser.nickname || globalUser.name || '旅行者·大理'

      const userId = app.globalData._userId || globalUser.id || ''
      displayId = userId ? 'DL' + String(userId).padStart(6, '0') : 'DL20260602'
    }
    // 未登录时不读取任何 storage，确保头像/昵称清空为默认

    this.setData({
      isLoggedIn,
      userInfo: {
        avatar: displayAvatar,
        name: displayName,
        id: displayId
      }
    })
  },

  // 点击进入个人信息编辑页
  onGoProfile() {
    if (!this.data.isLoggedIn) return
    wx.navigateTo({
      url: '/pages/user-profile/user-profile'
    })
  },

  loadStats() {
    if (!app.globalData.isLoggedIn) return
    try {
      const user = db.getCurrentUser()
      if (user) {
        const stats = db.getUserStats(user.id)
        this.setData({ stats })
        // 异步从服务端拉取更准确的数据
        const statsUrl = API_BASE + '/user/' + user.id + '/stats'
        const statsSig = _generateGetSignature(statsUrl)
        wx.request({
          url: statsUrl,
          method: 'GET',
          header: statsSig ? { 'X-Timestamp': statsSig.timestamp, 'X-Nonce': statsSig.nonce, 'X-Sign': statsSig.sign } : {},
          timeout: 5000,
          success: (res) => {
            if (res.statusCode === 200 && res.data && res.data.code === 0) {
              const d = res.data.data
              this.setData({
                stats: {
                  activityCount: d.bookingCount || d.activityCount || 0,
                  postCount: d.postCount || 0,
                  favCount: d.favCount || 0
                }
              })
            }
          }
        })
      } else {
        this.setData({
          stats: { activityCount: 0, postCount: 0, favCount: 0 }
        })
      }
    } catch (e) {
      this.setData({
        stats: { activityCount: 0, postCount: 0, favCount: 0 }
      })
    }
  },

  onLogin() {
    if (this.data.isLoggedIn) return
    wx.navigateTo({ url: '/pages/register/register' })
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新注册/登录才能使用完整功能',
      confirmText: '退出',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (res.confirm) {
          // 清除登录状态
          wx.removeStorageSync('token')
          wx.removeStorageSync('_userId')
          wx.removeStorageSync('userAvatar')
          wx.removeStorageSync('userNickname')
          wx.removeStorageSync('userPhone')
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          app.globalData._userId = null
          // 清除封禁状态，防止下次未登录时显示残留禁闭信息
          app.globalData.userStatus = 'active'
          app.globalData.banUntil = null
          app.globalData.banReason = ''
          this.checkLogin()
          this.setData({
            stats: { activityCount: 0, postCount: 0, favCount: 0 },
            isMuted: false,
            banMessage: ''
          })
          wx.showToast({ title: '已退出登录', icon: 'none' })
        }
      }
    })
  },

  onNavTo(e) {
    const url = e.currentTarget.dataset.url
    // 关于页不需要登录
    if (url === '/pages/about/about') {
      wx.navigateTo({ url })
      return
    }
    if (!this.data.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    // 禁闭状态不可访问提交类页面
    const submitPages = ['/pages/submit-checkin/submit-checkin', '/pages/submit-activity/submit-activity']
    if (this.data.isMuted && submitPages.includes(url)) {
      wx.showModal({ title: '无法操作', content: this.data.banMessage, showCancel: false })
      return
    }
    wx.navigateTo({ url })
  },


}))
