const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

// 格式化数字（万）
function formatNumber(num) {
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return String(num)
}

Page(withTheme(withBackTop({
  data: {
    activeTab: 'hot',
    allPosts: [],
    posts: [],
    page: 1,
    pageSize: 10,
    hasMore: true
  },

  async onLoad() {
    await this.loadPosts()
  },

  async loadPosts() {
    const allPosts = (await db.table(db.TABLES.COMMUNITY_POSTS)
      .orderBy('like_count', 'desc')
      .getAsync())
      .map(p => ({
        ...p,
        viewCountText: formatNumber(p.view_count),
        likeCountText: formatNumber(p.like_count),
        // 兼容旧字段名
        viewCount: p.view_count,
        likeCount: p.like_count,
        commentCount: p.comment_count
      }))
    this.setData({ allPosts }, () => {
      this.applyPagination()
    })
  },

  // 分页切片
  applyPagination() {
    const { page, pageSize, allPosts } = this.data
    const displayList = allPosts.slice(0, page * pageSize)
    this.setData({
      posts: displayList,
      hasMore: displayList.length < allPosts.length
    })
  },

  // 加载更多（触底）
  onLoadMore() {
    if (!this.data.hasMore) return
    this.setData({ page: this.data.page + 1 }, () => {
      this.applyPagination()
    })
  },

  // 返回顶部时刷新数据
  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      await this.loadPosts()
      this.setData({ page: 1 })
    } finally {
      wx.hideLoading()
    }
  },

  async onTabChange(e) {
    wx.vibrateShort({ type: 'light' })
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab, page: 1 })
    let posts = await db.table(db.TABLES.COMMUNITY_POSTS).getAsync()
    if (tab === 'hot') {
      posts.sort((a, b) => b.like_count - a.like_count)
    } else if (tab === 'new') {
      posts.sort((a, b) => b.post_date.localeCompare(a.post_date))
    }
    posts = posts.map(p => ({
      ...p,
      viewCountText: formatNumber(p.view_count),
      likeCountText: formatNumber(p.like_count),
      viewCount: p.view_count,
      likeCount: p.like_count,
      commentCount: p.comment_count
    }))
    this.setData({ allPosts: posts }, () => {
      this.applyPagination()
    })
  },

  onPostTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/community-detail/community-detail?id=${id}`
    })
  },

  onPublish() {
    wx.showToast({ title: '发布功能开发中', icon: 'none' })
  }
}, { mode: 'scroll-view', refreshOnTop: true })))
