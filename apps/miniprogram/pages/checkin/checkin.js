const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

// 格式化人气数值：9600 → "9.6k"，12500 → "1.3w"
function formatPopularity(val) {
  if (!val && val !== 0) return ''
  if (val < 1000) return String(val)
  if (val < 10000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return (val / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
}

Page(withTheme(withBackTop({
  data: {
    statusBarHeight: 44,
    activeTab: 'all',
    allPoints: [],
    filteredList: [],
    // 分页
    page: 1,
    pageSize: 10,
    hasMore: true,
    // 搜索
    searchKeyword: '',
    showSearchInput: false,
    // 人流映射
    crowdMap: {
      '空旷': { class: 'success' },
      '舒适': { class: 'primary' },
      '较多': { class: 'warning' },
      '拥堵': { class: 'danger' }
    },
    crowdStats: {
      empty: 0,
      busy: 0,
      crowded: 0
    },
    // 用户定位
    userLocation: {
      latitude: 25.6756,
      longitude: 100.1623
    }
  },

  async onLoad() {
    const windowInfo = wx.getWindowInfo()
    this.setData({ statusBarHeight: windowInfo.statusBarHeight || 44 })
    this.getUserLocation()
    await this.loadPoints()
  },

  onShow() {
    // 接收从活动详情页传入的搜索关键词（活动位置）
    const app = getApp()
    const keyword = app.globalData.checkinSearchKeyword
    if (keyword) {
      // 清除标记，避免重复触发
      app.globalData.checkinSearchKeyword = ''
      this.setData({ searchKeyword: keyword, showSearchInput: true })
      // 等待数据就绪后再搜索
      if (this.data.allPoints.length > 0) {
        this.applyFilter()
      } else {
        // 数据未加载完则延迟搜索
        this._pendingKeyword = keyword
      }
    }
  },

  // 获取用户定位
  getUserLocation() {
    const that = this
    wx.getLocation({
      type: 'gcj02',
      success(res) {
        that.setData({
          userLocation: {
            latitude: res.latitude,
            longitude: res.longitude
          }
        })
        // 获取位置后重新按距离排序
        that.sortByDistance()
      },
      fail() {
        // 使用默认定位（大理古城）
        that.sortByDistance()
      }
    })
  },

  async loadPoints(keyword) {
    const params = {}
    if (keyword) {
      params.keyword = keyword
      // 附带用户坐标，供服务端无结果时按距离回退
      const loc = this.data.userLocation
      if (loc && loc.latitude) {
        params.latitude = loc.latitude
        params.longitude = loc.longitude
      }
    }
    const allPoints = await db.table(db.TABLES.CHECKIN_POINTS).getAsync(params)
    // 字段映射 + 计算距离
    allPoints.forEach(p => {
      p.cover = db.toAbsoluteUrl(p.cover)
      p.crowdLevel = p.crowd_level || p.crowdLevel || '舒适'
      p.crowdPeak = p.crowd_peak || p.crowdPeak || ''
      p.chargeType = p.charge_type || p.chargeType || 'free'
      if (p.chargeType === 'charge') p.chargeType = 'paid'  // 兼容旧数据
      p.chargePrice = p.charge_price || p.chargePrice || ''
      if (p.chargeType === 'free') {
        p.chargeText = '免费'
      } else {
        p.chargeText = p.chargePrice || '收费'
      }
      p.popularityText = formatPopularity(p.popularity)
      p.bestTime = p.best_time || p.bestTime || ''
      if (!p.distance && p.latitude && p.longitude) {
        p.distance = this.calcDistance(
          this.data.userLocation.latitude,
          this.data.userLocation.longitude,
          p.latitude,
          p.longitude
        )
      }
    })
    this.setData({ allPoints })
    this.calcCrowdStats(allPoints)
    // 搜索模式下服务端已按相关性排序，不再按距离重排
    if (keyword) {
      this.applyFilter([...allPoints])
    } else {
      this.sortByDistance()
    }
    // 若有从活动详情页传来的待搜索关键词，执行搜索
    if (this._pendingKeyword) {
      const kw = this._pendingKeyword
      this._pendingKeyword = ''
      this.setData({ searchKeyword: kw, showSearchInput: true })
      this.applyFilter()
    }
  },

  // 计算两点距离（km）
  calcDistance(lat1, lng1, lat2, lng2) {
    const R = 6371
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return Math.round(R * c * 10) / 10
  },

  // 按距离排序
  sortByDistance() {
    let list = [...this.data.allPoints]
    list.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    this.applyFilter(list)
  },

  calcCrowdStats(points) {
    let empty = 0, busy = 0, crowded = 0
    points.forEach(p => {
      if (p.crowdLevel === '空旷') empty++
      else if (p.crowdLevel === '较多') busy++
      else if (p.crowdLevel === '拥堵') crowded++
    })
    this.setData({ crowdStats: { empty, busy, crowded } })
  },

  // 搜索
  onToggleSearch() {
    const show = !this.data.showSearchInput
    this.setData({ showSearchInput: show, searchKeyword: '', page: 1 })
    if (!show) {
      this.loadPoints()  // 重新加载全部数据
    }
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({ searchKeyword: keyword, page: 1 })
    // 防抖 300ms 后触发服务端分词模糊搜索
    if (this._searchTimer) clearTimeout(this._searchTimer)
    const kw = keyword.trim()
    this._searchTimer = setTimeout(() => {
      if (kw) {
        this.loadPoints(kw)
      } else {
        this.loadPoints()
      }
    }, 300)
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', page: 1 })
    this.loadPoints()  // 重新加载全部数据
  },

  // 分类切换
  onTabChange(e) {
    this.setData({ activeTab: e.currentTarget.dataset.tab, page: 1 })
    this.applyFilter()
  },

  // 综合筛选
  applyFilter(preSortedList) {
    let list = preSortedList || [...this.data.allPoints]

    // 按距离排序（如果还未排序）
    if (!preSortedList) {
      list.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    }

    // 距离最近模式：总是按距离升序，不限制类型
    if (this.data.activeTab === 'nearest') {
      list.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    }

    // 分类过滤（nearest 和 all 不限制类型）
    if (this.data.activeTab !== 'all' && this.data.activeTab !== 'nearest') {
      list = list.filter(p => p.type === this.data.activeTab)
    }

    // 搜索过滤：分词模糊匹配（全词 + 首尾 bigram）
    const kw = this.data.searchKeyword.trim().toLowerCase()
    if (kw) {
      const patterns = [kw]
      if (kw.length >= 2) patterns.push(kw.substring(0, 2))
      if (kw.length >= 4) patterns.push(kw.substring(kw.length - 2))
      const uniquePatterns = [...new Set(patterns)]
      list = list.filter(p => {
        const target = ((p.name || '') + ' ' + (p.description || '') + ' ' + (p.landmark || '')).toLowerCase()
        return uniquePatterns.some(pat => target.includes(pat))
      })
    }

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
    this.applyFilter()
  },

  // 页面触底（页面级滚动）
  onReachBottom() {
    this.onLoadMore()
  },

  // 点击已激活的 Tab 时刷新数据并回到顶部
  onTabItemTap() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    this.loadPoints()
  },

  // 下拉刷新（页面级）
  async onPullDownRefresh() {
    await this.loadPoints()
    this.setData({ page: 1 })
    this.applyFilter()
    wx.stopPullDownRefresh()
  },

  // 返回顶部时刷新数据
  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      await this.loadPoints()
      this.setData({ page: 1 })
      this.applyFilter()
    } finally {
      wx.hideLoading()
    }
  },

  onPointTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/checkin-detail/checkin-detail?id=${id}`
    })
  },

  // 直接导航到打卡点（从卡片底部导航按钮触发）
  onNavigateToPoint(e) {
    const id = e.currentTarget.dataset.id
    const point = this.data.allPoints.find(p => p.id === id)
    if (point && point.latitude && point.longitude) {
      wx.openLocation({
        latitude: point.latitude,
        longitude: point.longitude,
        name: point.name,
        address: point.landmark || point.name,
        scale: 18
      })
    } else {
      // 无坐标时跳到详情页
      wx.navigateTo({
        url: `/pages/checkin-detail/checkin-detail?id=${id}`
      })
    }
  }
}, { refreshOnTop: true })))
