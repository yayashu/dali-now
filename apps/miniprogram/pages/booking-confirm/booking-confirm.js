const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    activityName: '',
    isFree: true,
    randomCode: ''
  },

  onLoad(options) {
    this.setData({
      activityName: options.name || '',
      isFree: options.isFree !== 'false',
      randomCode: Math.random().toString(36).substring(2, 10).toUpperCase()
    })
  },

  onViewActivity() {
    wx.navigateBack({ delta: 2 })
  },

  onGoLivePost() {
    wx.navigateTo({
      url: '/pages/live-post/live-post'
    })
  }
}))
