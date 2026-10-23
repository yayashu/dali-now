const db = require('../../utils/db.js')
const { API_BASE, _generateGetSignature } = require('../../utils/config.js')
const { withTheme, withBackTop } = require('../../utils/util')

Page(withTheme(withBackTop({
  data: {
    posts: [],
    allPosts: [],
    page: 1,
    pageSize: 10,
    hasMore: true,
    currentUserId: '',
    loading: true
  },

  onLoad() {
    const user = db.getCurrentUser()
    this.setData({ currentUserId: user.id || '' })
    this.loadMyPosts()
  },

  onShow() {
    const user = db.getCurrentUser()
    this.setData({ currentUserId: user.id || '' })
    this.loadMyPosts()
  },

  async loadMyPosts() {
    this.setData({ loading: true })
    const uid = this.data.currentUserId
    if (!uid) {
      this.setData({ posts: [], allPosts: [], loading: false })
      return
    }

    try {
      // 直接调用 API，按 user_id 过滤，不依赖本地缓存
      const postsUrl = `${API_BASE}/live/posts`
      const postsSig = _generateGetSignature(postsUrl)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url: postsUrl,
          data: { user_id: uid, size: 9999 },
          timeout: 8000,
          header: postsSig ? { 'X-Timestamp': postsSig.timestamp, 'X-Nonce': postsSig.nonce, 'X-Sign': postsSig.sign } : {},
          success: resolve,
          fail: reject
        })
      })

      let rows = []
      if (res.data && res.data.code === 0 && res.data.data) {
        rows = res.data.data.list || []
      }

      // 补充图片和字段映射（与 db.getUserPosts 一致的处理）
      const allPoints = db.table(db.TABLES.CHECKIN_POINTS).get()
      rows.forEach(post => {
        post.images = db.table(db.TABLES.LIVE_POST_IMAGES)
          .where('post_id', post.id).orderBy('sort_order', 'asc').get()
          .map(img => db.toAbsoluteUrl(img.image_url))
        post.user_avatar = post.user_avatar && !post.user_avatar.startsWith('wxfile://') && !post.user_avatar.startsWith('http://tmp/')
          ? db.toAbsoluteUrl(post.user_avatar)
          : '/images/avatar-default.png'
        post.cover = db.toAbsoluteUrl(post.cover)
        if (post.post_date || post.post_time) {
          post.time = (post.post_date || '') + ' ' + (post.post_time || '')
        }
        if (post.point_id && !post.point_name) {
          const pt = allPoints.find(p => p.id === post.point_id)
          if (pt) post.point_name = pt.name
        }
      })

      // 分页切片
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayList = rows.slice(0, page * pageSize)

      this.setData({
        allPosts: rows,
        posts: displayList,
        hasMore: displayList.length < rows.length,
        loading: false
      })
    } catch (e) {
      // API 失败时回退到本地缓存
      const allPosts = db.getUserPosts(uid, true)
      const page = this.data.page
      const pageSize = this.data.pageSize
      const displayList = allPosts.slice(0, page * pageSize)
      this.setData({
        allPosts,
        posts: displayList,
        hasMore: displayList.length < allPosts.length,
        loading: false
      })
    }
  },

  onReachBottom() {
    if (!this.data.hasMore) return
    const { page, pageSize, allPosts } = this.data
    const newPage = page + 1
    const displayList = allPosts.slice(0, newPage * pageSize)
    this.setData({
      page: newPage,
      posts: displayList,
      hasMore: displayList.length < allPosts.length
    })
  },

  async refreshData() {
    wx.showLoading({ title: '刷新中...', mask: true })
    try {
      this.setData({ page: 1 })
      await this.loadMyPosts()
    } finally {
      wx.hideLoading()
    }
  },

  // 查看详情 → 跳转现场广场
  onViewPost(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/live-square/live-square?postId=${id}` })
  },

  onPreviewImage(e) {
    const urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.current || ''
    if (urls.length === 0) return
    wx.previewImage({ current, urls })
  },

  // 操作菜单
  onPostAction(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.posts.find(p => p.id === id)
    if (!post) return

    const actionList = post.is_hidden ? ['恢复显示', '删除此文'] : ['隐藏此文', '删除此文']
    wx.showActionSheet({
      itemList: actionList,
      success: (res) => {
        const action = actionList[res.tapIndex]
        if (action === '隐藏此文') {
          this.hidePost(id, true)
        } else if (action === '恢复显示') {
          this.hidePost(id, false)
        } else if (action === '删除此文') {
          this.deletePost(id)
        }
      }
    })
  },

  hidePost(id, isHidden) {
    db.update(db.TABLES.LIVE_POSTS, id, { is_hidden: isHidden ? 1 : 0 })
    const token = wx.getStorageSync('token') || ''
    wx.request({
      url: `${API_BASE}/live/posts/${id}/hide`,
      method: 'PUT',
      data: { is_hidden: isHidden ? 1 : 0 },
      header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      timeout: 5000,
      fail: () => {}
    })
    this.loadMyPosts()
    wx.showToast({ title: isHidden ? '已隐藏' : '已恢复显示', icon: 'success' })
  },

  deletePost(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条发文吗？',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (!res.confirm) return
        db.remove(db.TABLES.LIVE_POSTS, id)
        db.removeWhere(db.TABLES.LIVE_POST_IMAGES, r => r.post_id === id)
        const token = wx.getStorageSync('token') || ''
        wx.request({
          url: `${API_BASE}/live/posts/${id}`,
          method: 'DELETE',
          header: { 'Authorization': token ? 'Bearer ' + token : '' },
          timeout: 5000,
          fail: () => {}
        })
        this.loadMyPosts()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
}, { refreshOnTop: true })))
