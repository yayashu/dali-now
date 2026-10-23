const db = require('../../utils/db.js')
const { formatNumber, withTheme, withBackTop, getHotLevel } = require('../../utils/util')
const { SVG_ICONS } = require('../../utils/svg-icons')

// 活动颜色映射（模块级常量，避免 Page 实例 this 绑定问题）
const ACTIVITY_COLORS = [
  { bg: '#8e44ad', light: '#f3e5f5' },  // 紫色
  { bg: '#e8a838', light: '#fef5e7' },  // 金色
  { bg: '#27ae60', light: '#e8f8f0' },  // 绿色
  { bg: '#e74c3c', light: '#fdecea' },  // 红色
  { bg: '#1a6b4b', light: '#e8f0ec' },  // 深绿
  { bg: '#3498db', light: '#ebf5fb' },  // 蓝色
  { bg: '#9b59b6', light: '#f3e5f5' },  // 浅紫
  { bg: '#0f4d35', light: '#e0ece7' }   // 墨绿
]

function getActivityColorById(activityId) {
  if (!activityId || typeof activityId !== 'string') {
    return ACTIVITY_COLORS[0]
  }
  const hash = activityId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return ACTIVITY_COLORS[hash % ACTIVITY_COLORS.length]
}

Page(withTheme(withBackTop({
  data: {
    // 状态栏
    statusBarHeight: 44,

    // 区域
    districts: [],
    currentDistrict: '大理全域',
    selectedDistrict: 'all',
    showDistrictPopup: false,

    // 活动统计
    totalCount: 0,

    // 分类
    activeTab: 'all',

    // 排序
    sortBy: 'time',
    filterFree: false,

    // 列表
    allActivities: [],
    filteredList: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true,  // 骨架屏状态

    // 日历
    showCalendar: false,
    calendarYear: 2026,
    calendarMonth: 6,
    calendarWeekLabels: ['日', '一', '二', '三', '四', '五', '六'],
    calendarDays: [],

    // 底部导航
    showBottomNav: true,

    // 下拉刷新
    refresherTriggered: false,

    // 图标（替代 emoji）
    icons: SVG_ICONS
  },

  async onLoad() {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 44 })

    await new Promise(resolve => {
      const check = () => {
        const app = getApp()
        if (app.globalData.appReady) {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      check()
    })
    await Promise.all([
      this.loadDistricts(),
      this._fetchActivities()
    ])
    this.initCalendar()
    this._loaded = true
  },

  onShow() {
    const app = getApp()
    if (!app.globalData.appReady || !this._loaded) return
    this._fetchActivities()
  },

  // 从数据库加载区域列表
  async loadDistricts() {
    const districts = await db.table(db.TABLES.DISTRICTS).orderBy('sort_order', 'asc').getAsync()
    this.setData({ districts })
  },

  // 统一获取活动数据
  async _fetchActivities() {
    this.setData({ loading: !this._loaded })
    const list = await db.table(db.TABLES.ACTIVITIES)
      .where('status', 'active')
      .orderBy('date', 'desc')
      .getAsync()
    // 本地兜底：确保 price_text 不为空
    list.forEach(item => {
      if (item.is_free) {
        item.price_text = item.price_text || '免费'
      } else {
        item.price_text = item.price_text || (item.price ? '¥' + item.price : '收费')
      }
    })
    this.setData({
      allActivities: list,
      totalCount: list.length,
      loading: false
    })
    this.applyFilters()
  },

  // 分类切换
  onTabChange(e) {
    wx.vibrateShort({ type: 'light' })
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, page: 1 })
    this.applyFilters()
  },

  // 排序切换
  onSortChange(e) {
    wx.vibrateShort({ type: 'light' })
    const sort = e.currentTarget.dataset.sort
    this.setData({ sortBy: sort, page: 1 })
    this.applyFilters()
  },

  // 免费优先
  onToggleFree() {
    wx.vibrateShort({ type: 'light' })
    this.setData({ filterFree: !this.data.filterFree, page: 1 })
    this.applyFilters()
  },

  // 综合筛选排序
  applyFilters() {
    let list = [...this.data.allActivities]

    // 区域过滤（数据库字段为 district_code）
    if (this.data.selectedDistrict !== 'all') {
      list = list.filter(item => item.district_code === this.data.selectedDistrict)
    }

    // 分类过滤
    if (this.data.activeTab !== 'all') {
      list = list.filter(item => item.type === this.data.activeTab)
    }

    // 免费优先
    if (this.data.filterFree) {
      list = list.filter(item => item.is_free)
    }

    // 排序
    switch (this.data.sortBy) {
      case 'time':
        list.sort((a, b) => {
          const dateCmp = b.date.localeCompare(a.date)
          if (dateCmp !== 0) return dateCmp
          return (b.time || '').localeCompare(a.time || '')
        })
        break
      case 'hot':
        list.sort((a, b) => b.hot_value - a.hot_value)
        break
      case 'distance':
        list.sort((a, b) => (a.distance || 999) - (b.distance || 999))
        break
    }

    // 预处理显示文本 + 图片 URL 转绝对路径
    list = list.map(item => {
      const rawDesc = item.description || ''
      const hotInfo = getHotLevel(item.hot_value)
      return {
        ...item,
        cover: db.toAbsoluteUrl(item.cover),
        hotValueText: formatNumber(item.hot_value) + '热度',
        hotLevel: hotInfo.level,
        hotLevelClass: hotInfo.class,
        descText: rawDesc.length > 25 ? rawDesc.substring(0, 25) + '...' : rawDesc
      }
    })

    // 分页切片
    const page = this.data.page
    const pageSize = this.data.pageSize
    const displayList = list.slice(0, page * pageSize)

    this.setData({
      filteredList: displayList,
      hasMore: displayList.length < list.length
    })
  },

  // 加载更多（触底）
  onLoadMore() {
    if (!this.data.hasMore) return
    this.setData({ page: this.data.page + 1 })
    this.applyFilters()
  },

  // 页面触底（页面级滚动）
  onReachBottom() {
    this.onLoadMore()
  },

  // 点击已激活的 Tab 时刷新数据并回到顶部
  onTabItemTap() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    this._fetchActivities()
  },

  // 返回顶部时刷新数据
  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      await this._fetchActivities()
      this.setData({ page: 1 })
      this.applyFilters()
    } finally {
      wx.hideLoading()
    }
  },

  // 下拉刷新（页面级）
  async onPullDownRefresh() {
    await this._fetchActivities()
    this.setData({ page: 1 })
    this.applyFilters()
    wx.stopPullDownRefresh()
  },

  // 跳转活动详情
  onActivityTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/activity-detail/activity-detail?id=${id}`
    })
  },

  // 跳转搜索
  onGoSearch() {
    wx.navigateTo({
      url: '/pages/search/search'
    })
  },

  // 区域选择
  onSelectDistrict() {
    this.setData({ showDistrictPopup: true })
  },

  onCloseDistrict() {
    this.setData({ showDistrictPopup: false })
  },

  onDistrictSelect(e) {
    const { code, name } = e.currentTarget.dataset
    this.setData({
      selectedDistrict: code,
      currentDistrict: name,
      showDistrictPopup: false,
      page: 1
    })
    this.applyFilters()
  },

  stopPropagation() {},

  // 重置筛选
  onClearFilters() {
    this.setData({
      selectedDistrict: 'all',
      currentDistrict: '大理全域',
      activeTab: 'all',
      sortBy: 'time',
      filterFree: false,
      page: 1
    })
    this.applyFilters()
  },

  // ========== 日历功能 ==========
  initCalendar() {
    // 直接使用已加载的缓存数据，避免重复请求
    const activities = db.table(db.TABLES.ACTIVITIES).where('status', 'active').get()
    const data = (activities && activities.length > 0) ? activities : this.data.allActivities
    this.buildCalendar(data)
  },

  // 切换日历显示
  onToggleCalendar() {
    const newShow = !this.data.showCalendar
    this.setData({ showCalendar: newShow })
    if (newShow) {
      this.buildCalendar()
    }
  },

  // 构建标准日历月视图 + 活动列表
  buildCalendar(activities) {
    const { calendarYear, calendarMonth } = this.data
    const daysInMonth = new Date(calendarYear, calendarMonth, 0).getDate()
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

    const monthStart = new Date(calendarYear, calendarMonth - 1, 1)
    const monthEnd = new Date(calendarYear, calendarMonth, 0)

    // 1. 收集本月有交集的活动（使用传入数据或已缓存数据）
    const allActivities = activities || this.data.allActivities
    const monthActivities = []
    ;(allActivities || []).forEach(a => {
      if (!a || a.status !== 'active') return
      const range = (a.date_range_start && a.date_range_end) ? [a.date_range_start, a.date_range_end] : [a.date, a.date]
      const startDate = new Date(range[0])
      const endDate = new Date(range[1])
      if (endDate < monthStart || startDate > monthEnd) return

      const visibleStart = startDate < monthStart ? 1 : startDate.getDate()
      const visibleEnd = endDate > monthEnd ? daysInMonth : endDate.getDate()
      const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
      const colorInfo = getActivityColorById(a.id)

      monthActivities.push({
        id: a.id,
        name: a.name,
        bgColor: colorInfo.bg,
        startDay: visibleStart,
        endDay: visibleEnd,
        durationDays: totalDays
      })
    })

    // 2. 构建日历格子（含前置空白补齐到周日）
    const firstDayOfWeek = new Date(calendarYear, calendarMonth - 1, 1).getDay() // 0=周日
    const calendarDays = []

    // 前置空白
    for (let i = 0; i < firstDayOfWeek; i++) {
      calendarDays.push({ day: '', dateStr: '', isEmpty: true })
    }

    // 日期格子
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2,'0')}-${String(d).padStart(2,'0')}`
      const isToday = dateStr === todayStr

      // 找出这一天有哪些活动
      const actOnThisDay = monthActivities.filter(a => d >= a.startDay && d <= a.endDay)

      calendarDays.push({
        day: d,
        dateStr,
        isToday,
        isEmpty: false,
        hasActivity: actOnThisDay.length > 0,
        activityNames: actOnThisDay.map(a => a.name),
        bgColors: actOnThisDay.map(a => a.bgColor)
      })
    }

    this.setData({ calendarDays })
  },

  // 上个月
  onPrevMonth() {
    let { calendarYear, calendarMonth } = this.data
    if (calendarMonth === 1) {
      calendarMonth = 12
      calendarYear--
    } else {
      calendarMonth--
    }
    this.setData({ calendarYear, calendarMonth })
    this.buildCalendar()
  },

  // 下个月
  onNextMonth() {
    let { calendarYear, calendarMonth } = this.data
    if (calendarMonth === 12) {
      calendarMonth = 1
      calendarYear++
    } else {
      calendarMonth++
    }
    this.setData({ calendarYear, calendarMonth })
    this.buildCalendar()
  },

  // 返回今日
  onTodayTap() {
    const today = new Date()
    this.setData({
      calendarYear: today.getFullYear(),
      calendarMonth: today.getMonth() + 1
    })
    this.buildCalendar()
    this._fetchActivities()
  },


  // ========== 底部导航 ==========

  // 精准指引
  onGuidanceTap() {
    // 跳转到打卡页面，提供精准指引
    wx.switchTab({
      url: '/pages/checkin/checkin'
    })
  },

  // 一键导航
  onNavigateTap() {
    const app = getApp()
    const location = app.globalData.location
    // 默认导航到大理古城
    wx.openLocation({
      latitude: location.latitude || 25.6756,
      longitude: location.longitude || 100.1623,
      name: '大理古城',
      address: '大理白族自治州大理市',
      scale: 16
    })
  },

  // 切换主题
  onToggleTheme() {
    const app = getApp()
    const newTheme = app.globalData.theme === 'green' ? 'ocean' : 'green'
    app.switchTheme(newTheme)
    wx.showToast({
      title: newTheme === 'ocean' ? '已切换海洋主题' : '已切换苍山主题',
      icon: 'none',
      duration: 1200
    })
  }
}, { refreshOnTop: true })))
