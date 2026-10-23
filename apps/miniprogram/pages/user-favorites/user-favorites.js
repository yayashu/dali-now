const db = require('../../utils/db.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    favorites: [],
    allFavorites: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    loading: true,
    loaded: false
  },

  async onLoad() {
    await this.loadFavorites()
  },

  onShow() {
    if (this.data.loaded) {
      this.loadFavorites()
    }
  },

  async loadFavorites() {
    this.setData({ loading: true })

    try {
      const user = db.getCurrentUser()
      if (!user) {
        this.setData({ favorites: [], loading: false, loaded: true })
        return
      }

      const favRecords = db.table(db.TABLES.USER_FAVORITES)
        .where('user_id', user.id)
        .orderBy('created_at', 'desc')
        .get()

      // 根据 item_type 关联对应表的详情
      const enrichedList = favRecords.map(record => {
        let item = null
        let itemName = ''
        let itemCover = ''
        let itemDesc = ''
        let navPage = ''

        if (record.item_type === 'activity') {
          item = db.table(db.TABLES.ACTIVITIES).where('id', record.item_id).first()
          navPage = '/pages/activity-detail/activity-detail'
        } else if (record.item_type === 'checkin') {
          item = db.table(db.TABLES.CHECKIN_POINTS).where('id', record.item_id).first()
          navPage = '/pages/checkin-detail/checkin-detail'
        } else if (record.item_type === 'community') {
          item = db.table(db.TABLES.COMMUNITY_POSTS).where('id', record.item_id).first()
          navPage = '/pages/community-detail/community-detail'
        } else if (record.item_type === 'live') {
          item = db.table(db.TABLES.LIVE_POSTS).where('id', record.item_id).first()
          navPage = '/pages/live/live'
        }

        if (item) {
          itemName = item.name || item.title || ''
          itemCover = db.toAbsoluteUrl(item.cover || item.image_url || item.images?.[0] || '')
          itemDesc = item.description || item.subtitle || item.address || ''
        }

        return {
          ...record,
          itemName,
          itemCover,
          itemDesc,
          navPage: navPage + '?id=' + record.item_id
        }
      })

      // 分页切片
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayList = enrichedList.slice(0, page * pageSize)

      this.setData({
        allFavorites: enrichedList,
        favorites: displayList,
        hasMore: displayList.length < enrichedList.length,
        loading: false,
        loaded: true
      })
    } catch (e) {
      this.setData({ favorites: [], allFavorites: [], loading: false, loaded: true })
    }
  },

  onReachBottom() {
    if (!this.data.hasMore) return
    const { page, pageSize, allFavorites } = this.data
    const newPage = page + 1
    const displayList = allFavorites.slice(0, newPage * pageSize)
    this.setData({
      page: newPage,
      favorites: displayList,
      hasMore: displayList.length < allFavorites.length
    })
  },

  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      this.setData({ page: 1 })
      await this.loadFavorites()
    } finally {
      wx.hideLoading()
    }
  },

  onTapItem(e) {
    const url = e.currentTarget.dataset.url
    if (url) {
      wx.navigateTo({ url })
    }
  },

  // 长按取消收藏
  async onRemoveFav(e) {
    const { itemType, itemId } = e.currentTarget.dataset
    const user = db.getCurrentUser()
    if (!user) return

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '取消收藏',
        content: '确定要取消收藏吗？',
        success: (res) => resolve(res.confirm)
      })
    })

    if (confirmed) {
      db.removeFavorite(user.id, itemType, itemId)
      wx.showToast({ title: '已取消收藏', icon: 'none' })
      this.loadFavorites()
    }
  }
}, { refreshOnTop: true })))
