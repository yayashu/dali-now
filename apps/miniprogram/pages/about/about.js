const { PRIVACY_CONTENT, APP_INTRO_CONTENT } = require('../../utils/privacy.js')
const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    statusBarHeight: 44,
    appIntro: '',
    showPrivacyModal: false,
    privacyContent: ''
  },

  onLoad() {
    const sys = wx.getWindowInfo()
    this.setData({
      statusBarHeight: sys.statusBarHeight || 44,
      appIntro: APP_INTRO_CONTENT
    })
  },

  onNavBack() {
    wx.navigateBack({ delta: 1 })
  },

  onShowPrivacy() {
    this.setData({
      showPrivacyModal: true,
      privacyContent: PRIVACY_CONTENT
    })
  },

  onHidePrivacy() {
    this.setData({ showPrivacyModal: false })
  }
}))
