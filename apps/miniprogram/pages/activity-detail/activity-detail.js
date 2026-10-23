const db = require('../../utils/db.js')
const { _generateGetSignature } = require('../../utils/config.js')
const { withTheme, getHotLevel } = require('../../utils/util')
const { SVG_ICONS } = require('../../utils/svg-icons')

Page(withTheme({
  data: {
    activityId: '',
    activity: {},
    livePosts: [],
    isFavorited: false,
    reminderEnabled: false,
    inlineToast: '',

    // 弹幕
    danmakuOn: true,
    danmakuItems: [],

    // 二维码弹窗
    showQrModal: false,
    qrCodeUrl: '',

    // SVG 图标（替代 emoji）
    icons: SVG_ICONS
  },

  async onLoad(options) {
    const id = options.id || 'act_001'
    this.setData({ activityId: id })
    await this.loadActivity(id)
    await this.loadLivePosts(id)
    this._initialized = true
    this._startDanmaku()
  },

  onShow() {
    if (!this._initialized || !this.data.activityId) return
    const activityId = this.data.activityId

    // 检测从发文页返回的发布成功标记
    const ps = wx.getStorageSync('__publish_success')
    const showToast = ps && Date.now() - ps.time < 15000
    if (showToast) {
      wx.removeStorageSync('__publish_success')
      this.setData({ inlineToast: '已发布！' })
      setTimeout(() => { this.setData({ inlineToast: '' }) }, 2000)
    }

    // 刷新现场动态列表
    wx.nextTick(() => {
      this.loadLivePosts(activityId).then(() => {
        this._refreshDanmakuPool()
        this._resumeDanmaku()
      }).catch(() => {})
    })
  },

  onHide() {
    this._pauseDanmaku()
  },

  onUnload() {
    this._stopDanmaku()
  },

  async loadActivity(id) {
    // 优先从 API 获取完整活动数据（list API 不含 images，单活动 API 才有）
    const actUrl = db.STATIC_BASE + 'api/activities/' + id
    const actSig = _generateGetSignature(actUrl)
    let activity = await new Promise((resolve) => {
      wx.request({
        url: actUrl,
        method: 'GET',
        header: actSig ? { 'X-Timestamp': actSig.timestamp, 'X-Nonce': actSig.nonce, 'X-Sign': actSig.sign } : {},
        success: (res) => {
          if (res.statusCode === 200 && res.data && res.data.code === 0) {
            resolve(res.data.data)
          } else {
            resolve(null)
          }
        },
        fail: () => resolve(null)
      })
    })

    // API 失败时回退缓存
    if (!activity) {
      activity = db.getById(db.TABLES.ACTIVITIES, id)
      if (activity) {
        activity.tags = db.table(db.TABLES.ACTIVITY_TAGS)
          .where('activity_id', id).get().map(t => t.tag)
        activity.images = db.table(db.TABLES.ACTIVITY_IMAGES)
          .where('activity_id', id).orderBy('sort_order', 'asc').get().map(img => db.toAbsoluteUrl(img.image_url))
      }
    }

    if (activity) {
      // API 返回的 images 是字符串数组，统一转绝对 URL
      activity.images = (activity.images || []).map(url =>
        typeof url === 'string' ? db.toAbsoluteUrl(url) : db.toAbsoluteUrl(url.image_url || '')
      )
      activity.cover = db.toAbsoluteUrl(activity.cover)
      // 根据热度值自动计算热度等级
      const hotInfo = getHotLevel(activity.hot_value)
      activity.hotLevel = hotInfo.level
      activity.hotLevelClass = hotInfo.class
      // 本地兜底：确保 price_text 不为空
      if (activity.is_free) {
        activity.price_text = activity.price_text || '免费'
      } else {
        activity.price_text = activity.price_text || (activity.price ? '¥' + activity.price : '收费')
      }
      this.setData({ activity })

      // 检查收藏状态
      try {
        const user = db.getCurrentUser()
        if (user) {
          const isFav = db.isFavorited(user.id, 'activity', id)
          this.setData({ isFavorited: isFav })
        }
      } catch (e) { /* ignore */ }

      // 检查提醒状态
      try {
        const reminders = wx.getStorageSync('__activity_reminders') || {}
        this.setData({ reminderEnabled: !!reminders[id] })
      } catch (e) { /* ignore */ }
    }
  },

  async loadLivePosts(activityId) {
    const posts = await db.table(db.TABLES.LIVE_POSTS)
      .where('activity_id', activityId)
      .orderBy('post_date', 'desc').orderBy('post_time', 'desc')
      .getAsync()
    // 附带图片，转为完整URL（与 live-square 逻辑一致）
    for (const post of posts) {
      post.images = db.table(db.TABLES.LIVE_POST_IMAGES)
        .where('post_id', post.id).orderBy('sort_order', 'asc').get().map(img => db.toAbsoluteUrl(img.image_url))
      post.user_avatar = post.user_avatar && !post.user_avatar.startsWith('wxfile://') && !post.user_avatar.startsWith('http://tmp/')
        ? db.toAbsoluteUrl(post.user_avatar)
        : '/images/avatar-default.png'
      post.cover = db.toAbsoluteUrl(post.cover)
      if (post.post_date || post.post_time) {
        post.time = (post.post_date || '') + ' ' + (post.post_time || '')
      }
    }
    this.setData({ livePosts: posts })
  },

  // 返回
  onBack() {
    if (getCurrentPages().length === 1) {
      wx.switchTab({ url: '/pages/index/index' })
    } else {
      wx.navigateBack()
    }
  },

  // 弹出报名二维码（仅收费活动）
  onOpenQrModal() {
    const { activity } = this.data
    // 优先使用活动自带的二维码，否则使用占位地址
    const qrUrl = activity.qr_code_url || 'https://via.placeholder.com/400x400/27AE60/FFFFFF?text=' + encodeURIComponent(activity.name || '活动报名')
    this.setData({
      showQrModal: true,
      qrCodeUrl: qrUrl
    })
  },

  // 关闭二维码弹窗
  onCloseQrModal() {
    this.setData({ showQrModal: false })
  },

  // 收藏
  onToggleFavorite() {
    const user = db.getCurrentUser()
    if (!user) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const newState = !this.data.isFavorited
    this.setData({ isFavorited: newState })

    if (newState) {
      db.addFavorite(user.id, 'activity', this.data.activityId)
    } else {
      db.removeFavorite(user.id, 'activity', this.data.activityId)
    }

    wx.showToast({
      title: newState ? '已收藏' : '已取消收藏',
      icon: 'none'
    })
  },

  // 活动提醒
  onSetReminder() {
    const newState = !this.data.reminderEnabled
    const { activityId, activity } = this.data
    this.setData({ reminderEnabled: newState })

    try {
      const reminders = wx.getStorageSync('__activity_reminders') || {}
      if (newState) {
        reminders[activityId] = {
          name: activity.name,
          date: activity.date,
          time: activity.time,
          setAt: Date.now()
        }
      } else {
        delete reminders[activityId]
      }
      wx.setStorageSync('__activity_reminders', reminders)
    } catch (e) { /* ignore */ }

    wx.showToast({
      title: newState ? '已设置活动提醒' : '已取消提醒',
      icon: 'none'
    })
  },

  // 导航
  onNavigate() {
    const { activity } = this.data
    wx.openLocation({
      name: activity.location,
      address: activity.location,
      scale: 15
    })
  },

  // 咨询
  onConsult() {
    wx.showToast({ title: '咨询功能开发中', icon: 'none' })
  },

  // 跳转打卡 — 带活动位置作为搜索关键词
  onGoCheckin() {
    const app = getApp()
    app.globalData.checkinSearchKeyword = this.data.activity.location || ''
    wx.switchTab({
      url: '/pages/checkin/checkin'
    })
  },

  // 跳转现场发文
  onGoLivePost() {
    const activityId = this.data.activityId || ''
    const activityName = this.data.activity ? (this.data.activity.name || '') : ''
    const url = `/pages/live-post/live-post?activityId=${activityId}&activityName=${activityName}`
    wx.navigateTo({
      url,
      fail: (err) => {
        console.error('navigateTo live-post failed:', err)
        wx.showToast({ title: '页面跳转失败，请重试', icon: 'none' })
      }
    })
  },

  // 查看全部现场
  onViewAllLive() {
    wx.navigateTo({
      url: `/pages/live-square/live-square?activityId=${this.data.activityId}&activityName=${this.data.activity.name}`
    })
  },

  // ==================== 弹幕 ====================
  onToggleDanmaku() {
    const next = !this.data.danmakuOn
    this.setData({ danmakuOn: next })
    if (next) {
      this._startDanmaku()
    } else {
      this._stopDanmaku()
    }
  },

  _startDanmaku() {
    if (!this.data.danmakuOn) return
    this._stopDanmaku()
    this._danmakuPool = (this.data.livePosts || []).slice(0, 30)
    this._danmakuIdx = 0
    this._danmakuUsedRows = []
    this._dkidSeq = 0

    if (this._danmakuPool.length === 0) return

    // 立即发射第一条
    this._spawnDanmaku()
    // 定时发射
    this._danmakuTimer = setInterval(() => {
      this._spawnDanmaku()
    }, 2200)
  },

  _stopDanmaku() {
    if (this._danmakuTimer) {
      clearInterval(this._danmakuTimer)
      this._danmakuTimer = null
    }
    this.setData({ danmakuItems: [] })
    this._danmakuUsedRows = []
  },

  _pauseDanmaku() {
    if (this._danmakuTimer) {
      clearInterval(this._danmakuTimer)
      this._danmakuTimer = null
    }
  },

  _resumeDanmaku() {
    if (this._danmakuTimer || !this.data.danmakuOn) return
    if (!this._danmakuPool || this._danmakuPool.length === 0) return
    this._spawnDanmaku()
    this._danmakuTimer = setInterval(() => {
      this._spawnDanmaku()
    }, 2200)
  },

  _refreshDanmakuPool() {
    this._danmakuPool = (this.data.livePosts || []).slice(0, 30)
    this._danmakuIdx = 0
  },

  _spawnDanmaku() {
    const pool = this._danmakuPool
    if (!pool || pool.length === 0) return

    const post = pool[this._danmakuIdx % pool.length]
    this._danmakuIdx++

    // 分配轨道（共 8 条轨道，避免与最近使用的 3 条重复）
    const usedRows = this._danmakuUsedRows
    const available = [0, 1, 2, 3, 4, 5, 6, 7].filter(r => !usedRows.includes(r))
    const row = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : Math.floor(Math.random() * 8)

    // 更新最近使用轨道记录（保留最近 3 条）
    usedRows.push(row)
    if (usedRows.length > 3) usedRows.shift()
    this._danmakuUsedRows = usedRows

    // 截取内容（最多 18 字）
    const maxLen = 18
    const rawText = (post.content || '').replace(/\n/g, ' ')
    const text = rawText.length > maxLen ? rawText.slice(0, maxLen) + '…' : rawText

    const item = {
      _dkid: 'dk_' + (this._dkidSeq++),
      _row: row,
      _dur: 6 + Math.random() * 4,  // 6~10 秒
      _text: text,
      _leaving: false,
      user_avatar: post.user_avatar || '/images/avatar-default.png',
      user_name: post.user_name || '匿名'
    }

    const items = [...this.data.danmakuItems, item]
    // 最多保留 15 条 DOM
    const maxItems = 15
    while (items.length > maxItems) {
      items.shift()
    }
    this.setData({ danmakuItems: items })

    // 动画结束后移除
    const dkid = item._dkid
    setTimeout(() => {
      const cur = this.data.danmakuItems
      const idx = cur.findIndex(it => it._dkid === dkid)
      if (idx >= 0) {
        const updated = [...cur]
        updated.splice(idx, 1)
        this.setData({ danmakuItems: updated })
      }
    }, (item._dur + 0.5) * 1000)
  },

  onShareAppMessage() {
    const { activity, activityId } = this.data
    const id = (activity && activity.id) || activityId
    const name = (activity && activity.name) || '精彩活动'
    const cover = (activity && activity.cover) || ''
    return {
      title: `大理此刻｜${name}`,
      path: `/pages/activity-detail/activity-detail?id=${id}`,
      imageUrl: cover
    }
  },

  onShareTimeline() {
    const { activity, activityId } = this.data
    const id = (activity && activity.id) || activityId
    const name = (activity && activity.name) || '精彩活动'
    const cover = (activity && activity.cover) || ''
    return {
      title: `大理此刻｜${name}`,
      query: `id=${id}`,
      imageUrl: cover
    }
  }
}))
