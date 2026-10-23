const db = require('../../utils/db.js')
const { API_BASE } = require('../../utils/config.js')
const { withTheme, withBackTop } = require('../../utils/util')

// 经纬度距离计算（Haversine 公式，单位：km）
function calcDistance(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 999
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

Page(withTheme(withBackTop({
  data: {
    onlineCount: 2860,

    // ============ 三维检索状态 ============
    searchKeyword: '',               // 关键词搜索
    filterActivityId: '',            // 活动筛选ID
    filterActivityName: '',          // 活动筛选名称
    filterPointId: '',               // 打卡点筛选ID
    filterPointName: '',             // 打卡点筛选名称
    filterDistance: 0,               // 距离筛选(km)，0=不限
    sortType: 'latest',              // 排序: latest/hot/nearby

    // ============ 筛选项数据源 ============
    activityOptions: [],             // [{id, name}]
    pointOptions: [],                // [{id, name, latitude, longitude}]
    distanceOptions: [
      { value: 0, label: '不限距离' },
      { value: 1, label: '1km内' },
      { value: 3, label: '3km内' },
      { value: 5, label: '5km内' },
      { value: 10, label: '10km内' }
    ],
    sortOptions: [
      { value: 'latest', label: '最新发布' },
      { value: 'hot', label: '最多点赞' },
      { value: 'nearby', label: '离我最近' }
    ],

    // ============ UI 控制 ============
    showPublishSheet: false,         // 发布方式选择浮层
    hasActiveFilter: false,          // 是否有已激活的筛选条件
    searchFocused: false,            // 搜索框聚焦状态
    // 排序下拉
    showSortDropdown: false,         // 排序下拉展开
    sortChipText: '最新发布',        // 排序按钮显示文字
    // 搜索建议面板
    showSearchSuggest: false,        // 搜索建议面板
    searchSuggestActivities: [],     // 推荐活动 [{id, name}]
    searchSuggestPoints: [],         // 推荐打卡点 [{id, name, distance, distanceText}]

    // ============ 列表数据 ============
    livePosts: [],
    allPosts: [],                    // 全量原始数据（用于本地过滤）
    page: 1,
    pageSize: 10,
    hasMore: true,

    currentUserId: '',
    myLat: null,                     // 用户当前纬度
    myLng: null,                     // 用户当前经度
    statusBarHeight: 44              // px, 自动获取
  },

  async onLoad() {
    try {
      const sys = wx.getSystemInfoSync()
      this.setData({ statusBarHeight: sys.statusBarHeight || 44 })
      const user = db.getCurrentUser()
      this.setData({ currentUserId: user.id || '' })
      await this.loadPosts()
      await this.loadFilterOptions()
      this.getMyLocation()
    } catch(e) {
      // ignore
    }
  },

  onShow() {
    try {
      this.setData({
        onlineCount: 2800 + Math.floor(Math.random() * 300)
      })
      const user = db.getCurrentUser()
      this.setData({ currentUserId: user.id || '' })
      if (this._loaded) {
        this.loadPosts()
      }
      this._loaded = true
      if (wx.getStorageSync('__just_published')) {
        wx.removeStorageSync('__just_published')
        wx.showToast({ title: '发布成功', icon: 'success', duration: 1500 })
      }
    } catch(e) {
      // ignore
    }
  },

  // 点击已激活的 Tab 时刷新数据并回到顶部
  onTabItemTap() {
    wx.pageScrollTo({ scrollTop: 0, duration: 300 })
    this.loadPosts()
  },

  onRefresh() {
    this.loadPosts().then(() => {
      wx.stopPullDownRefresh()
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  },

  // ============ 获取用户位置 ============
  getMyLocation() {
    wx.getLocation({
      type: 'gcj02',
      timeout: 5000,
      success: (res) => {
        this.setData({ myLat: res.latitude, myLng: res.longitude })
        // 刷新距离计算
        this._recalcDistances()
      },
      fail: () => {}
    })
  },

  // ============ 加载筛选项数据源 ============
  async loadFilterOptions() {
    try {
      // 加载进行中的活动
      const activities = await db.table(db.TABLES.ACTIVITIES)
        .where('status', 'active').orderBy('date', 'desc').getAsync()
      const activityOptions = activities.map(a => ({ id: a.id, name: a.name }))

      // 加载打卡点
      const points = await db.table(db.TABLES.CHECKIN_POINTS).getAsync()
      const pointOptions = points.map(p => ({
        id: p.id, name: p.name,
        latitude: p.latitude, longitude: p.longitude
      }))

      this.setData({ activityOptions, pointOptions })
    } catch (e) { /* ignore */ }
  },

  // ============ 加载帖子 + 丰富元数据 ============
  async loadPosts() {
    try {
      const posts = await db.table(db.TABLES.LIVE_POSTS)
        .where(function(row) { return !row.is_hidden })
        .orderBy('post_date', 'desc')
        .orderBy('post_time', 'desc')
        .getAsync()
      posts.sort((a, b) => {
        const da = (a.post_date || '') + ' ' + (a.post_time || '')
        const db2 = (b.post_date || '') + ' ' + (b.post_time || '')
        return db2.localeCompare(da)
      })

      // 预加载打卡点数据，用于 point_name 回填（缓存清除后 API 可能缺少该字段）
      const allPoints = db.table(db.TABLES.CHECKIN_POINTS).get()
      const pointMap = {}
      for (const pt of allPoints) {
        pointMap[pt.id] = pt
      }

      const uid = this.data.currentUserId
      for (const post of posts) {
        // 图片
        const rawImages = db.table(db.TABLES.LIVE_POST_IMAGES)
          .where('post_id', post.id).orderBy('sort_order', 'asc').get()
        post.images = rawImages
          .map(img => img.image_url)
          .filter(url => url && String(url).trim().length > 0)
          .map(url => db.toAbsoluteUrl(url))
          .filter(url => !String(url).startsWith('wxfile://') && !String(url).startsWith('http://tmp/'))
        // 头像
        const rawAvatar = post.user_avatar
        post.user_avatar = rawAvatar && !String(rawAvatar).startsWith('wxfile://') && !String(rawAvatar).startsWith('http://tmp/')
          ? db.toAbsoluteUrl(rawAvatar)
          : '/images/avatar-default.png'
        // 封面
        const rawCover = post.cover
        if (rawCover && String(rawCover).trim().length > 0
            && !String(rawCover).startsWith('wxfile://')
            && !String(rawCover).startsWith('http://tmp/')) {
          post.cover = db.toAbsoluteUrl(rawCover)
        } else {
          post.cover = '/images/avatar-default.png'
        }
        // 时间
        if (post.post_date || post.post_time) {
          post.time = (post.post_date || '') + ' ' + (post.post_time || '')
        }
        // === 关联名称补全（缓存清除后 API 数据可能缺少这些字段） ===
        if (post.activity_id && !post.activity_name) {
          const act = db.getById(db.TABLES.ACTIVITIES, post.activity_id)
          post.activity_name = act ? act.name : ''
        }
        // 策略1：有 point_id 但缺 point_name → 从打卡点表查找
        if (post.point_id && !post.point_name) {
          const pt = pointMap[post.point_id] || db.getById(db.TABLES.CHECKIN_POINTS, post.point_id)
          post.point_name = pt ? pt.name : ''
        }
        // 策略2：point_id 和 point_name 都为空，但 location 匹配已知打卡点名称
        if (!post.point_name && post.location) {
          const loc = String(post.location).trim()
          if (loc) {
            const matched = allPoints.find(pt => pt.name === loc || loc.includes(pt.name) || pt.name.includes(loc))
            if (matched) {
              post.point_name = matched.name
              post.point_id = matched.id
            }
          }
        }
        // 点赞/我的标记
        post.isLiked = uid ? db.isLiked(uid, 'live_post', post.id) : false
        post.isMine = uid && String(post.user_id) === String(uid)
        // 距离（基于用户定位计算）
        post.distance = 999
      }

      // 计算距离
      this.setData({ allPosts: posts })
      this._recalcDistances()
      // 应用当前所有筛选条件
      this.applyAllFilters()
    } catch (e) {
      // ignore
    }
  },

  // ============ 重新计算所有帖子的距离 ============
  _recalcDistances() {
    const { myLat, myLng, allPosts } = this.data
    if (myLat == null || myLng == null) return

    const posts = allPosts.map(post => {
      const plat = post.latitude || 0
      const plng = post.longitude || 0
      post.distance = calcDistance(myLat, myLng, plat, plng)
      // 预计算距离显示文本，避免 WXML 模板表达式过于复杂
      if (post.distance < 999) {
        post.distanceText = post.distance < 1
          ? (post.distance * 1000).toFixed(0) + 'm'
          : post.distance.toFixed(1) + 'km'
      } else {
        post.distanceText = ''
      }
      return post
    })
    this.setData({ allPosts: posts }, () => {
      this.applyAllFilters()
    })
  },

  // ============ 关键词搜索 + 排序 ============
  applyAllFilters() {
    let posts = [...this.data.allPosts]

    // --- 关键词搜索（内容+地点+活动名+打卡点名+用户名） ---
    const kw = (this.data.searchKeyword || '').trim().toLowerCase()
    if (kw) {
      posts = posts.filter(p => {
        return (p.content && p.content.toLowerCase().includes(kw)) ||
               (p.location && p.location.toLowerCase().includes(kw)) ||
               (p.activity_name && p.activity_name.toLowerCase().includes(kw)) ||
               (p.point_name && p.point_name.toLowerCase().includes(kw)) ||
               (p.user_name && p.user_name.toLowerCase().includes(kw))
      })
    }

    // --- 排序 ---
    const sortType = this.data.sortType
    if (sortType === 'hot') {
      posts.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    } else if (sortType === 'nearby') {
      posts.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    } else {
      // latest: 按最新发布时间排序
      posts.sort((a, b) => {
        const ta = (a.post_date || '') + ' ' + (a.post_time || '')
        const tb = (b.post_date || '') + ' ' + (b.post_time || '')
        return tb.localeCompare(ta)
      })
    }

    const hasActive = !!kw

    // 分页切片
    const page = this.data.page
    const pageSize = this.data.pageSize
    const displayPosts = posts.slice(0, page * pageSize)

    this.setData({
      livePosts: displayPosts,
      hasMore: displayPosts.length < posts.length,
      hasActiveFilter: hasActive
    })
  },

  // 加载更多（触底）
  onReachBottom() {
    if (!this.data.hasMore) return
    this.setData({ page: this.data.page + 1 }, () => {
      this.applyAllFilters()
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

  // ============ 排序下拉 ============
  onToggleSortDropdown() {
    this.setData({ showSortDropdown: !this.data.showSortDropdown })
  },

  onCloseSortDropdown() {
    this.setData({ showSortDropdown: false })
  },

  onSelectSort(e) {
    const val = e.currentTarget.dataset.value
    const labelMap = { latest: '最新发布', hot: '最多点赞', nearby: '离我最近' }
    this.setData({
      sortType: val,
      sortChipText: labelMap[val] || '最新发布',
      showSortDropdown: false,
      page: 1
    }, () => {
      this.applyAllFilters()
    })
  },

  // ============ 发布方式浮层 ============
  onTogglePublishSheet() {
    this._checkLoginThen(() => {
      this.setData({ showPublishSheet: !this.data.showPublishSheet })
    })
  },
  onClosePublishSheet() {
    this.setData({ showPublishSheet: false })
  },
  onSelectQuickPublish() {
    this.setData({ showPublishSheet: false })
    wx.navigateTo({ url: '/pages/live-post/live-post?mode=quick' })
  },

  // ============ 搜索输入建议 ============
  _prepareSuggestions() {
    // 热门活动（取前5）
    const activities = (this.data.activityOptions || []).slice(0, 5)

    // 附近打卡点（按距离排序，取前5）
    const points = (this.data.pointOptions || []).map(p => ({ ...p }))
    const { myLat, myLng } = this.data
    if (myLat != null && myLng != null) {
      points.forEach(p => {
        const d = calcDistance(myLat, myLng, p.latitude || 0, p.longitude || 0)
        p.distance = d
        p.distanceText = d < 1 ? (d * 1000).toFixed(0) + 'm' : d.toFixed(1) + 'km'
      })
      points.sort((a, b) => (a.distance || 999) - (b.distance || 999))
    }

    this.setData({
      showSearchSuggest: true,
      searchSuggestActivities: activities,
      searchSuggestPoints: points.slice(0, 5)
    })
  },

  onSearchFocus() {
    this.setData({ searchFocused: true })
    if (this.data.searchKeyword) return
    this._prepareSuggestions()
  },

  onSearchBlur() {
    this.setData({ searchFocused: false })
    // 延迟关闭，允许点击建议项
    setTimeout(() => {
      this.setData({ showSearchSuggest: false })
    }, 200)
  },

  onTapSuggestion(e) {
    const name = e.currentTarget.dataset.name || ''
    this.setData({
      searchKeyword: name,
      showSearchSuggest: false
    }, () => {
      this.applyAllFilters()
    })
  },

  // ============ 搜索输入 ============
  onSearchInput(e) {
    const val = e.detail.value
    // 输入不为空时隐藏推荐面板；清空后重新显示推荐
    if (val) {
      this.setData({ searchKeyword: val, showSearchSuggest: false, page: 1 })
    } else {
      this.setData({ searchKeyword: val, showSearchSuggest: false, page: 1 })
      // 清空输入后重新显示建议
      this._prepareSuggestions()
    }
    // 实时过滤（150ms 防抖）
    clearTimeout(this._searchTimer)
    this._searchTimer = setTimeout(() => {
      this.applyAllFilters()
    }, 150)
  },

  onSearchConfirm(e) {
    const kw = (e.detail.value || '').trim()
    if (this._searchTimer) clearTimeout(this._searchTimer)
    this.setData({ searchKeyword: kw, page: 1 }, () => {
      this.applyAllFilters()
    })
  },

  onClearSearch() {
    this.setData({ searchKeyword: '', page: 1 }, () => {
      this.applyAllFilters()
    })
  },

  // 清除所有筛选
  onClearAllFilters() {
    this.setData({
      searchKeyword: '',
      filterActivityId: '',
      filterActivityName: '',
      filterPointId: '',
      filterPointName: '',
      filterDistance: 0,
      sortType: 'latest',
      sortChipText: '最新发布',
      showSortDropdown: false,
      showPublishSheet: false,
      showSearchSuggest: false,
      hasActiveFilter: false,
      page: 1
    }, () => {
      this.applyAllFilters()
    })
  },

  // ============ 登录校验 ============
  _checkLoginThen(action) {
    const app = getApp()
    if (app.globalData.isLoggedIn) {
      action()
      return
    }
    wx.showModal({
      title: '请先登录',
      content: '发布现场动态需要登录后才能操作',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          app.login().then(() => {
            const user = db.getCurrentUser()
            this.setData({ currentUserId: user.id || '' })
            action()
          }).catch(() => {
            wx.showToast({ title: '登录失败，请重试', icon: 'none' })
          })
        }
      }
    })
  },

  onQuickStatus() {
    this._checkLoginThen(() => {
      wx.navigateTo({ url: '/pages/live-post/live-post?mode=quick' })
    })
  },

  onComment(e) {
    wx.showToast({ title: '评论功能即将上线', icon: 'none' })
  },

  // 点击关联活动标签 → 跳转活动详情
  onTapActivity(e) {
    const id = e.currentTarget.dataset.activityId
    if (id) {
      wx.navigateTo({ url: `/pages/activity-detail/activity-detail?id=${id}` })
    }
  },

  // 点击关联打卡点标签 → 跳转打卡点详情
  onTapPoint(e) {
    const id = e.currentTarget.dataset.pointId
    if (id) {
      wx.navigateTo({ url: `/pages/checkin-detail/checkin-detail?id=${id}` })
    }
  },

  // ==================== 图片预览 ====================
  onPreviewImage(e) {
    const urls = e.currentTarget.dataset.urls || []
    const current = e.currentTarget.dataset.current || ''
    if (urls.length === 0) return
    wx.previewImage({ current, urls })
  },


  // ==================== 点赞 ====================
  onLike(e) {
    const id = e.currentTarget.dataset.id
    const posts = [...this.data.livePosts]
    const idx = posts.findIndex(p => p.id === id)
    if (idx === -1) return

    const post = posts[idx]
    const uid = this.data.currentUserId
    if (!uid) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (post.isLiked) {
      // 取消点赞
      db.removeLike(uid, 'live_post', id)
      post.like_count = Math.max(0, (post.like_count || 0) - 1)
      post.isLiked = false
      wx.showToast({ title: '已取消点赞', icon: 'none' })
    } else {
      // 点赞
      db.addLike(uid, 'live_post', id)
      post.like_count = (post.like_count || 0) + 1
      post.isLiked = true
      wx.showToast({ title: '已点赞', icon: 'none' })
    }
    posts[idx] = post
    this.setData({ livePosts: posts })

    // 异步同步到服务器
    const token = wx.getStorageSync('token') || ''
    wx.request({
      url: API_BASE + '/live/posts/' + id + '/like',
      method: 'POST',
      header: { 'Authorization': token ? 'Bearer ' + token : '' },
      timeout: 5000,
      fail: () => {}
    })
  },

  // ==================== 分享 ====================
  onSharePost(e) {
    const id = e.currentTarget.dataset.id
    const posts = this.data.livePosts
    const idx = posts.findIndex(p => p.id === id)
    if (idx === -1) return

    const post = posts[idx]

    // 分享计数 +1（本地即时更新）
    post.share_count = (post.share_count || 0) + 1
    posts[idx] = post
    this.setData({ livePosts: posts })

    // 构建跳转参数，传递海报所需数据
    const params = [
      'id=' + encodeURIComponent(post.id || ''),
      'avatar=' + encodeURIComponent(post.user_avatar || ''),
      'userName=' + encodeURIComponent(post.user_name || ''),
      'content=' + encodeURIComponent((post.content || '').slice(0, 200)),
      'images=' + encodeURIComponent((post.images || []).slice(0, 4).join(',')),
      'activityId=' + encodeURIComponent(post.activity_id || ''),
      'pointId=' + encodeURIComponent(post.point_id || ''),
      'location=' + encodeURIComponent(post.location || ''),
      'time=' + encodeURIComponent(post.time || '')
    ].join('&')

    wx.navigateTo({ url: '/pages/share-poster/share-poster?' + params })
  },

  // ==================== 分享到聊天 ====================
  onShareAppMessage() {
    return {
      title: '大理此刻 · 我在现场',
      path: '/pages/live/live',
      imageUrl: '/images/share-live.png'
    }
  },

  // ==================== 隐藏/删除自家发文 ====================
  onPostMore(e) {
    const id = e.currentTarget.dataset.id
    const post = this.data.livePosts.find(p => p.id === id)
    if (!post || !post.isMine) return

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
    // 更新本地缓存
    db.update(db.TABLES.LIVE_POSTS, id, { is_hidden: isHidden ? 1 : 0 })
    // 同步服务器
    const token = wx.getStorageSync('token') || ''
    wx.request({
      url: `${API_BASE}/live/posts/${id}/hide`,
      method: 'PUT',
      data: { is_hidden: isHidden ? 1 : 0 },
      header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      timeout: 5000,
      fail: () => {}
    })
    // 从当前列表移除
    const posts = this.data.livePosts.filter(p => p.id !== id)
    this.setData({ livePosts: posts })
    wx.showToast({ title: isHidden ? '已隐藏' : '已恢复显示', icon: 'success' })
  },

  deletePost(id) {
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这条发文吗？',
      confirmColor: '#e74c3c',
      success: (res) => {
        if (!res.confirm) return
        // 从本地缓存删除
        db.remove(db.TABLES.LIVE_POSTS, id)
        db.removeWhere(db.TABLES.LIVE_POST_IMAGES, r => r.post_id === id)
        // 同步服务器
        const token = wx.getStorageSync('token') || ''
        wx.request({
          url: `${API_BASE}/live/posts/${id}`,
          method: 'DELETE',
          header: { 'Authorization': token ? 'Bearer ' + token : '' },
          timeout: 5000,
          fail: () => {}
        })
        const posts = this.data.livePosts.filter(p => p.id !== id)
        this.setData({ livePosts: posts })
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  }
}, { refreshOnTop: true })))
