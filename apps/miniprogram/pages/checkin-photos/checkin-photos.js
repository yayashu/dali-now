const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    statusBarHeight: 44,
    pointId: '',
    pointName: '',
    allPhotos: [],
    displayPhotos: [],
    filteredAllPhotos: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    // 搜索
    searchKeyword: '',
    showSearch: false,
    // 筛选
    filterDate: '',
    filterTime: '',
    // 可选列表
    dateOptions: [],
    timeOptions: []
  },

  async onLoad(options) {
    const sys = wx.getWindowInfo()
    this.setData({ statusBarHeight: sys.statusBarHeight || 44 })

    const id = options.id || ''
    const name = options.name || '该点位'
    this.setData({ pointId: id, pointName: name })
    await this.loadPhotos(id)
  },

  onNavBack() {
    if (getCurrentPages().length === 1) {
      wx.switchTab({ url: '/pages/index/index' })
    } else {
      wx.navigateBack({ delta: 1 })
    }
  },

  // 统一数据来源：我在现场 (LIVE_POSTS)，按打卡点名称关联
  async loadPhotos(id) {
    const point = db.getById(db.TABLES.CHECKIN_POINTS, id)
    let photos = []

    if (point && point.name) {
      const allMatchedPosts = db.table(db.TABLES.LIVE_POSTS)
        .where('location', point.name)
        .orderBy('post_date', 'desc')
        .orderBy('post_time', 'desc')
        .get()

      for (const post of allMatchedPosts) {
        const images = db.table(db.TABLES.LIVE_POST_IMAGES)
          .where('post_id', post.id)
          .orderBy('sort_order', 'asc')
          .get()
        if (images.length === 0) continue  // 跳过纯文字帖
        images.forEach((img, idx) => {
          photos.push({
            id: 'live_' + post.id + '_' + idx,
            image_url: db.toAbsoluteUrl(img.image_url),
            shoot_date: post.post_date || '',
            shoot_time: post.post_time || '',
            user_name: post.user_name || '',
            user_avatar: post.user_avatar || '',
            description: post.content || '',
            location: post.location || '',
            like_count: post.like_count || 0,
            is_liked: false
          })
        })
      }
    }

    // 收集筛选选项
    const dateSet = new Set()
    const timeSet = new Set()
    photos.forEach(p => {
      if (p.shoot_date) dateSet.add(p.shoot_date)
      if (p.shoot_time) timeSet.add(p.shoot_time.substring(0, 2))
    })

    this.setData({
      allPhotos: photos,
      displayPhotos: photos,
      dateOptions: Array.from(dateSet).sort().reverse(),
      timeOptions: Array.from(timeSet).sort((a, b) => a - b)
    })
  },

  // 搜索
  onSearchInput(e) {
    const val = e.detail.value
    this.setData({ searchKeyword: val, page: 1 })
    this.applyFilters()
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', showSearch: false, page: 1 })
    this.applyFilters()
  },

  onToggleSearch() {
    const show = !this.data.showSearch
    this.setData({ showSearch: show })
    if (!show) {
      this.setData({ searchKeyword: '' })
      this.applyFilters()
    }
  },

  // 日期筛选
  onDateFilter(e) {
    const { date } = e.currentTarget.dataset
    const val = this.data.filterDate === date ? '' : date
    this.setData({ filterDate: val, page: 1 })
    this.applyFilters()
  },

  // 时段筛选
  onTimeFilter(e) {
    const { time } = e.currentTarget.dataset
    const val = this.data.filterTime === time ? '' : time
    this.setData({ filterTime: val, page: 1 })
    this.applyFilters()
  },

  // 加载更多
  onReachBottom() {
    if (!this.data.hasMore) return
    const { page, pageSize, filteredAllPhotos } = this.data
    const newPage = page + 1
    const displayList = filteredAllPhotos.slice(0, newPage * pageSize)
    this.setData({
      page: newPage,
      displayPhotos: displayList,
      hasMore: displayList.length < filteredAllPhotos.length
    })
  },

  // 返回顶部时刷新数据
  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      await this.loadPhotos(this.data.pointId)
      this.setData({ page: 1 })
    } finally {
      wx.hideLoading()
    }
  },

  // 应用筛选
  applyFilters() {
    let photos = [...this.data.allPhotos]
    const { searchKeyword, filterDate, filterTime } = this.data

    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase()
      photos = photos.filter(p =>
        (p.description || '').toLowerCase().includes(kw) ||
        (p.user_name || '').toLowerCase().includes(kw) ||
        (p.location || '').toLowerCase().includes(kw)
      )
    }
    if (filterDate) {
      photos = photos.filter(p => p.shoot_date === filterDate)
    }
    if (filterTime) {
      photos = photos.filter(p => (p.shoot_time || '').startsWith(filterTime))
    }

    // 按日期+时间降序
    photos.sort((a, b) => {
      const da = a.shoot_date || ''
      const db_ = b.shoot_date || ''
      if (da !== db_) return db_.localeCompare(da)
      return (b.shoot_time || '').localeCompare(a.shoot_time || '')
    })

    // 分页切片
    const page = this.data.page
    const pageSize = this.data.pageSize
    const displayList = photos.slice(0, page * pageSize)

    this.setData({
      filteredAllPhotos: photos,
      displayPhotos: displayList,
      hasMore: displayList.length < photos.length
    })
  },

  // 重置筛选
  onReset() {
    this.setData({
      searchKeyword: '',
      filterDate: '',
      filterTime: '',
      showSearch: false
    })
    this.loadPhotos(this.data.pointId)
    this.setData({ page: 1 })
  },

  // 点赞
  onLikePhoto(e) {
    const { id } = e.currentTarget.dataset
    const { displayPhotos } = this.data
    const idx = displayPhotos.findIndex(p => p.id === id)
    if (idx < 0) return
    displayPhotos[idx].is_liked = !displayPhotos[idx].is_liked
    displayPhotos[idx].like_count += displayPhotos[idx].is_liked ? 1 : -1
    this.setData({ displayPhotos })
  },

  // 大图预览
  onPreviewPhoto(e) {
    const { index } = e.currentTarget.dataset
    const urls = this.data.displayPhotos.map(p => p.image_url)
    wx.previewImage({ current: urls[index], urls })
  },

  // 分享
  onSharePhoto() {
    wx.showToast({ title: '分享功能开发中', icon: 'none' })
  }
}, { refreshOnTop: true })))
