const app = getApp()
const { PRIVACY_CONTENT } = require('../../utils/privacy.js')
const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    statusBarHeight: 44,
    avatar: '',
    nickname: '',
    privacyAgreed: false,
    showPrivacyModal: false,
    privacyContent: '',
    isRegistering: false
  },

  onLoad() {
    const sys = wx.getWindowInfo()
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 })

    // 读取当前用户头像昵称
    const userInfo = app.globalData.userInfo || {}
    const storedAvatar = wx.getStorageSync('userAvatar') || ''
    const storedNickname = wx.getStorageSync('userNickname') || ''

    let avatar = storedAvatar || userInfo.avatar || ''
    if (avatar && (avatar.startsWith('wxfile://') || avatar.startsWith('http://tmp/'))) {
      avatar = ''
    }

    this.setData({
      avatar,
      nickname: storedNickname || userInfo.nickname || ''
    })
  },

  onNavBack() {
    wx.navigateBack({ delta: 1 })
  },

  onTogglePrivacy() {
    this.setData({ privacyAgreed: !this.data.privacyAgreed })
  },

  onShowPrivacy() {
    this.setData({
      showPrivacyModal: true,
      privacyContent: PRIVACY_CONTENT
    })
  },

  onHidePrivacy() {
    this.setData({ showPrivacyModal: false })
  },

  onAgreePrivacy() {
    this.setData({
      privacyAgreed: true,
      showPrivacyModal: false
    })
  },

  onRegister() {
    if (!this.data.privacyAgreed) {
      wx.showToast({ title: '请先阅读并同意隐私协议', icon: 'none' })
      return
    }
    if (this.data.isRegistering) return

    this.setData({ isRegistering: true })
    wx.showLoading({ title: '登录中...', mask: true })

    app.login(true).then((res) => {
      wx.hideLoading()
      // 后端根据 openid 判断：新用户则注册，已有用户则登录
      const isNewUser = res && res.is_new_user
      wx.showToast({
        title: isNewUser ? '注册成功，欢迎加入大理此刻' : '登录成功',
        icon: 'success',
        duration: 1500
      })
      this.setData({ isRegistering: false })
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    }).catch((err) => {
      wx.hideLoading()
      this.setData({ isRegistering: false })
      wx.showToast({
        title: (err && err.message) || '登录失败，请重试',
        icon: 'none'
      })
    })
  }
}))
