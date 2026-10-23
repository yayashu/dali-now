const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    statusBarHeight: 44,
    quickTab: 'scenic',   // 快捷入口当前选中
    lifeTab: 'food',
    localLife: {
      food: [],
      hotel: [],
      shop: []
    },
    scenicSpots: []
  },

  async onLoad() {
    const sys = wx.getWindowInfo()
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
    await Promise.all([this.loadScenicSpots(), this.loadLocalLife()])
    this._loaded = true
  },

  onShow() {
    // Tab 切换回服务页时刷新数据
    if (this._loaded) {
      this.loadScenicSpots()
      this.loadLocalLife()
    }
  },

  async loadScenicSpots() {
    try {
      const spots = await db.table(db.TABLES.SCENIC_SPOTS).getAsync()
      const formatted = spots.map(spot => {
        let price = ''
        if (spot.ticket_type === 'free') {
          price = '免费'
        } else if (spot.ticket_price) {
          price = '¥' + spot.ticket_price
        } else if (spot.ticket_note) {
          price = spot.ticket_note
        }
        let time = ''
        if (spot.open_time && spot.close_time) {
          time = spot.open_time + '-' + spot.close_time
        } else if (spot.open_time) {
          time = spot.open_time
        } else {
          time = '全天开放'
        }
        return {
          id: spot.id,
          name: spot.name,
          cover: db.toAbsoluteUrl(spot.cover),
          desc: spot.description || '',
          price,
          time
        }
      })
      this.setData({ scenicSpots: formatted.slice(0, 8) })
    } catch (e) {
      console.error('加载景区数据失败:', e)
    }
  },

  async loadLocalLife() {
    try {
      // 只请求一次 API 获取全量数据，然后在内存中按分类筛选
      const allItems = await db.table(db.TABLES.LOCAL_LIFE_ITEMS).getAsync()
      // cover 字段转绝对 URL（与其他页面保持一致）
      const processCover = (item) => {
        item.cover = db.toAbsoluteUrl(item.cover)
        return item
      }
      const food  = allItems.filter(i => i.category === 'food').sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)).map(processCover)
      const hotel = allItems.filter(i => i.category === 'hotel').sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)).map(processCover)
      const shop  = allItems.filter(i => i.category === 'shop').sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0)).map(processCover)
      this.setData({ localLife: { food, hotel, shop } })
    } catch (e) {
      console.error('加载本地生活数据失败:', e)
    }
  },

  // 返回顶部时刷新数据
  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      await Promise.all([this.loadScenicSpots(), this.loadLocalLife()])
    } finally {
      wx.hideLoading()
    }
  },

  // 快捷入口分类切换
  onQuickTab(e) {
    wx.vibrateShort({ type: 'light' })
    this.setData({ quickTab: e.currentTarget.dataset.tab })
    // 切换到对应内容区域
    if (['food', 'hotel', 'shop'].includes(this.data.quickTab)) {
      this.setData({ lifeTab: this.data.quickTab })
    }
  },

  // 本地生活 Tab 切换
  onLifeTab(e) {
    wx.vibrateShort({ type: 'light' })
    this.setData({ lifeTab: e.currentTarget.dataset.tab })
  },

  // 景点卡片点击 → 跳转景点详情页
  onScenicTap(e) {
    const id = e.currentTarget.dataset.id
    wx.vibrateShort({ type: 'light' })
    wx.navigateTo({ url: '/pages/scenic-detail/scenic-detail?id=' + id })
  },

  // 全部景点
  onViewAllScenic() {
    wx.navigateTo({ url: '/pages/search/search?tab=scenic' })
  },

  // 跳转搜索页
  onGoSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    })
  }
}, { mode: 'scroll-view', refreshOnTop: true })))
