const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    keyword: '',
    results: [],
    allResults: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    hotTags: ['三道茶', '扎染', '洱海日落', '苍山徒步', '大本曲', '双廊', '免费活动', '非遗体验'],
    history: [],
    statusBarHeight: 0,
    searchTab: 'activity'   // 'activity' | 'scenic'
  },

  onLoad(options) {
    this.setData({
      statusBarHeight: wx.getWindowInfo().statusBarHeight || 20
    })
    if (options.tab === 'scenic') {
      this.setData({ searchTab: 'scenic' })
      this.loadAllScenicSpots()
    }
    this.loadHistory()
  },

  // Tab 切换
  onSearchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.searchTab) return
    this.setData({ searchTab: tab, keyword: '', results: [], allResults: [], hasMore: false, page: 1 })
    if (tab === 'scenic') {
      this.loadAllScenicSpots()
    }
  },

  // 加载全部景点
  async loadAllScenicSpots() {
    try {
      const spots = await db.table(db.TABLES.SCENIC_SPOTS).getAsync()
      const formatted = spots.map(s => ({
        id: s.id,
        name: s.name,
        cover: db.toAbsoluteUrl(s.cover),
        description: s.description || '',
        ticket_type: s.ticket_type,
        ticket_price: s.ticket_price,
        ticket_note: s.ticket_note,
        level: s.level,
        open_time: s.open_time,
        close_time: s.close_time
      }))
      this.setData({ allResults: formatted, results: formatted.slice(0, this.data.pageSize), hasMore: formatted.length > this.data.pageSize })
    } catch (e) {
      console.error('加载景点失败:', e)
    }
  },

  loadHistory() {
    const app = getApp()
    const user = db.getCurrentUser()
    if (user) {
      const history = db.getSearchHistory(user.id, 10)
      this.setData({ history: history.map(h => h.keyword) })
    }
  },

  saveHistory(keyword) {
    const user = db.getCurrentUser()
    if (user) {
      db.addSearchHistory(user.id, keyword)
    }
    let history = this.data.history
    history = history.filter(h => h !== keyword)
    history.unshift(keyword)
    if (history.length > 10) history = history.slice(0, 10)
    this.setData({ history })
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
    this.doSearch(e.detail.value)
  },

  onSearch(e) {
    const keyword = e.detail.value || this.data.keyword
    if (!keyword.trim()) return
    this.saveHistory(keyword)
    this.doSearch(keyword)
  },

  async doSearch(keyword) {
    if (!keyword.trim()) {
      this.setData({ results: [], allResults: [], hasMore: false })
      // 如果是景点 Tab 且清空关键词，恢复全部景点
      if (this.data.searchTab === 'scenic') {
        this.loadAllScenicSpots()
      }
      return
    }

    if (this.data.searchTab === 'scenic') {
      // 搜景点
      const spots = await db.table(db.TABLES.SCENIC_SPOTS).getAsync()
      const kw = keyword.toLowerCase()
      const allResults = spots.filter(s => {
        return (s.name && s.name.toLowerCase().includes(kw)) ||
          (s.description && s.description.toLowerCase().includes(kw)) ||
          (s.address && s.address.toLowerCase().includes(kw)) ||
          (s.tags && s.tags.toLowerCase().includes(kw))
      }).map(s => ({
        id: s.id,
        name: s.name,
        cover: db.toAbsoluteUrl(s.cover),
        description: s.description || '',
        ticket_type: s.ticket_type,
        ticket_price: s.ticket_price,
        ticket_note: s.ticket_note,
        level: s.level,
        open_time: s.open_time,
        close_time: s.close_time
      }))
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayResults = allResults.slice(0, page * pageSize)
      this.setData({
        allResults,
        results: displayResults,
        hasMore: displayResults.length < allResults.length
      })
    } else {
      // 搜活动
      const allActivities = await db.table(db.TABLES.ACTIVITIES).orderBy('date', 'desc').getAsync()
      const allResults = allActivities.filter(a => {
        const tags = db.table(db.TABLES.ACTIVITY_TAGS).where('activity_id', a.id).get().map(t => t.tag)
        return a.name.includes(keyword) ||
          a.location.includes(keyword) ||
          (a.type_name && a.type_name.includes(keyword)) ||
          tags.some(t => t.includes(keyword))
      }).map(a => ({
        ...a,
        cover: db.toAbsoluteUrl(a.cover)
      }))
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayResults = allResults.slice(0, page * pageSize)
      this.setData({
        allResults,
        results: displayResults,
        hasMore: displayResults.length < allResults.length
      })
    }
  },

  // 加载更多
  onReachBottom() {
    if (!this.data.hasMore) return
    // 景点 Tab 无需关键词也能加载更多
    if (this.data.searchTab !== 'scenic' && !this.data.keyword.trim()) return
    this.setData({ page: this.data.page + 1 }, () => {
      const { page, pageSize, allResults } = this.data
      const displayResults = allResults.slice(0, page * pageSize)
      this.setData({
        results: displayResults,
        hasMore: displayResults.length < allResults.length
      })
    })
  },

  // 返回顶部时刷新数据
  async refreshData() {
    this.setData({ page: 1 })
    if (this.data.searchTab === 'scenic') {
      // 有关键词则重新搜索，否则重载全部景点
      if (this.data.keyword.trim()) {
        await this.doSearch(this.data.keyword)
      } else {
        await this.loadAllScenicSpots()
      }
    } else {
      if (!this.data.keyword.trim()) return
      await this.doSearch(this.data.keyword)
    }
  },

  onHotTag(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({ keyword: tag, page: 1 })
    this.saveHistory(tag)
    this.doSearch(tag)
  },

  onHistoryTap(e) {
    const tag = e.currentTarget.dataset.tag
    this.setData({ keyword: tag, page: 1 })
    this.doSearch(tag)
  },

  onRemoveHistory(e) {
    const index = e.currentTarget.dataset.index
    let history = this.data.history
    history.splice(index, 1)
    this.setData({ history })
  },

  onClearHistory() {
    const user = db.getCurrentUser()
    if (user) {
      db.clearSearchHistory(user.id)
    }
    this.setData({ history: [] })
  },

  onClear() {
    this.setData({ keyword: '', results: [], allResults: [], hasMore: false, page: 1 })
    if (this.data.searchTab === 'scenic') {
      this.loadAllScenicSpots()
    }
  },

  onResultTap(e) {
    const id = e.currentTarget.dataset.id
    const url = this.data.searchTab === 'scenic'
      ? `/pages/scenic-detail/scenic-detail?id=${id}`
      : `/pages/activity-detail/activity-detail?id=${id}`
    wx.navigateTo({ url })
  },

  onBackTap() {
    wx.navigateBack()
  },

  onCancel() {
    wx.navigateBack()
  },

  // 图片加载失败时清空 cover 显示占位图
  onImageError(e) {
    const idx = e.currentTarget.dataset.index
    const results = this.data.results
    if (results[idx]) {
      results[idx].cover = ''
      this.setData({ results })
    }
  }
}, { refreshOnTop: true })))
