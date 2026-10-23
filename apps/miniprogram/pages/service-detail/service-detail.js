const { withTheme } = require('../../utils/util')
const { API_BASE } = require('../../utils/config.js')

Page(withTheme({
  data: {
    type: '',
    title: '',
    loading: true,
    // 天气
    weather: null,
    // 交通路况
    traffic: [],
    // 出行查询
    busRoutes: []
  },

  onLoad(options) {
    const type = options.type || ''
    const title = options.title || '详情'
    this.setData({ type, title })
    wx.setNavigationBarTitle({ title })

    switch (type) {
      case 'weather':
        this.loadWeather()
        break
      case 'traffic':
        this.loadTraffic()
        break
      case 'bus':
        this.loadBusRoutes()
        break
      default:
        this.setData({ loading: false })
    }
  },

  // ==================== 实时天气 ====================
  async loadWeather() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: API_BASE + '/weather/current',
          method: 'GET',
          timeout: 8000,
          success: resolve,
          fail: reject
        })
      })
      if (res.statusCode === 200 && res.data && res.data.code === 0) {
        this.setData({ weather: res.data.data, loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('获取天气失败:', e)
      // 降级：使用本地缓存或展示默认信息
      this.setData({ loading: false })
    }
  },

  // ==================== 交通路况 ====================
  async loadTraffic() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: API_BASE + '/traffic/status',
          method: 'GET',
          timeout: 8000,
          success: resolve,
          fail: reject
        })
      })
      if (res.statusCode === 200 && res.data && res.data.code === 0) {
        this.setData({ traffic: res.data.data || [], loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('获取路况失败:', e)
      this.setData({ loading: false })
    }
  },

  // ==================== 出行查询 ====================
  async loadBusRoutes() {
    try {
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: API_BASE + '/bus/routes',
          method: 'GET',
          timeout: 8000,
          success: resolve,
          fail: reject
        })
      })
      if (res.statusCode === 200 && res.data && res.data.code === 0) {
        this.setData({ busRoutes: res.data.data || [], loading: false })
      } else {
        this.setData({ loading: false })
      }
    } catch (e) {
      console.error('获取出行信息失败:', e)
      this.setData({ loading: false })
    }
  },

  // 返回
  onBack() {
    wx.navigateBack({ delta: 1 })
  }
}))
