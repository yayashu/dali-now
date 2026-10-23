const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    activityId: '',
    activityName: '',
    posts: [],
    allPosts: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    stats: {
      postCount: 0,
      onlineCount: 0,
      totalLikes: 0
    }
  },

  onBack() {
    if (getCurrentPages().length === 1) {
      wx.switchTab({ url: '/pages/index/index' })
    } else {
      wx.navigateBack()
    }
  },

  async onLoad(options) {
    // 防御性解码，与 live-post 保持一致
    const activityId = options.activityId ? decodeURIComponent(options.activityId) : ''
    const activityName = options.activityName ? decodeURIComponent(options.activityName) : '活动现场'

    this.setData({ activityId, activityName })
    await this.loadPosts(activityId)
    this.calcStats()
    this.applyPagination()
  },

  async loadPosts(activityId) {
    let q = db.table(db.TABLES.LIVE_POSTS).orderBy('post_date', 'desc').orderBy('post_time', 'desc')
    if (activityId) {
      q = q.where('activity_id', activityId)
    }
    const posts = await q.getAsync()
    // 附带图片（从缓存读取，转为完整URL）
    for (const post of posts) {
      post.images = db.table(db.TABLES.LIVE_POST_IMAGES)
        .where('post_id', post.id).orderBy('sort_order', 'asc').get().map(img => db.toAbsoluteUrl(img.image_url))
      // 头像和封面 URL 转为完整路径，临时路径回退到默认头像
      post.user_avatar = post.user_avatar && !post.user_avatar.startsWith('wxfile://') && !post.user_avatar.startsWith('http://tmp/')
        ? db.toAbsoluteUrl(post.user_avatar)
        : '/images/avatar-default.png'
      post.cover = db.toAbsoluteUrl(post.cover)
      // 组装日期时间: post_date + post_time
      if (post.post_date || post.post_time) {
        post.time = (post.post_date || '') + ' ' + (post.post_time || '')
      }
    }
    this.setData({ posts })
  },

  // 加载更多
  onReachBottom() {
    if (!this.data.hasMore) return
    const { page, pageSize, allPosts } = this.data
    const newPage = page + 1
    const displayPosts = allPosts.slice(0, newPage * pageSize)
    this.setData({
      page: newPage,
      posts: displayPosts,
      hasMore: displayPosts.length < allPosts.length
    })
  },

  // 返回顶部时刷新数据
  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      await this.loadPosts(this.data.activityId)
      this.calcStats()
      this.setData({ page: 1 }, () => {
        this.applyPagination()
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 分页切片
  applyPagination() {
    const { page, pageSize, allPosts } = this.data
    const displayPosts = allPosts.slice(0, page * pageSize)
    this.setData({
      posts: displayPosts,
      hasMore: displayPosts.length < allPosts.length
    })
  },

  calcStats() {
    const { posts } = this.data
    const totalLikes = posts.reduce((sum, p) => sum + (p.like_count || 0), 0)
    this.setData({
      allPosts: posts,
      stats: {
        postCount: posts.length,
        onlineCount: Math.floor(Math.random() * 100) + 50,
        totalLikes
      }
    })
  },

  onShare() {
    wx.showToast({ title: '已生成分享海报', icon: 'none' })
  },

  onPreviewImage(e) {
    const urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.current || ''
    if (urls.length === 0) return
    wx.previewImage({ current, urls })
  },

  onShareAppMessage() {
    return {
      title: `大理此刻｜${this.data.activityName} 活动现场`,
      path: `/pages/live-square/live-square?activityId=${this.data.activityId}&activityName=${this.data.activityName}`
    }
  }
}, { refreshOnTop: true })))
