const db = require('../../utils/db.js')
const { API_BASE, _generateGetSignature } = require('../../utils/config.js')
const { getCrowdLevelText, withTheme } = require('../../utils/util')

// 格式化人气数值：9600 → "9.6k"，12500 → "1.3w"
function formatPopularity(val) {
  if (!val && val !== 0) return ''
  if (val < 1000) return String(val)
  if (val < 10000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return (val / 10000).toFixed(1).replace(/\.0$/, '') + 'w'
}

Page(withTheme({
  data: {
    pointId: '',
    point: {},
    crowdInfo: {},
    // 照片 - 仅展示最新6张缩略图
    photos: [],
    displayPhotos: [],
    // 天气数据
    weather: {
      icon: '☀️',
      temp: '26°C',
      desc: '晴',
      humidity: '45%',
      wind: '东南风 3级',
      sunrise: '06:28',
      sunset: '20:02'
    },
    weatherIcons: {
      '晴': '☀️',
      '多云': '⛅',
      '多云转晴': '⛅',
      '晴间多云': '⛅',
      '晴转多云': '⛅',
      '阴': '☁️',
      '小雨': '🌧️',
      '大雨': '🌧️'
    },
    inlineToast: ''
  },

  async onLoad(options) {
    let id = options.id || ''
    // 防御：id 为空或为 'undefined' 字符串时回退到第一个打卡点
    if (!id || id === 'undefined' || id === 'null') {
      wx.showToast({ title: '打卡点信息异常，请重试', icon: 'none' })
      wx.navigateBack()
      return
    }
    this.setData({ pointId: id })
    await this.loadPoint(id)
    await this.loadPhotos(id)
    this._initialized = true
  },

  onShow() {
    if (this._initialized && this.data.pointId) {
      const pointId = this.data.pointId

      // 优先使用 live-post 直接写入页面实例的标记，fallback 到 storage
      let showToast = !!this._publishSuccess
      this._publishSuccess = false

      if (!showToast) {
        const ps = wx.getStorageSync('__publish_success')
        showToast = ps && Date.now() - ps.time < 15000
        if (showToast) wx.removeStorageSync('__publish_success')
      }

      // 用数据驱动内联 Toast（不用 wx.showToast，避免原生浮层 + setData 渲染冲突崩溃）
      if (showToast) {
        this.setData({ inlineToast: '已发布！' })
        setTimeout(() => {
          this.setData({ inlineToast: '' })
        }, 2000)
      }

      // 刷新照片列表
      wx.nextTick(() => {
        this.loadPhotos(pointId).catch(() => {})
      })
    }
  },

  async loadPoint(id) {
    // 优先从 API 获取完整数据（含 checkin_photos）
    const pointUrl = db.STATIC_BASE + 'api/checkin/points/' + id
    const pointSig = _generateGetSignature(pointUrl)
    let point = await new Promise((resolve) => {
      wx.request({
        url: pointUrl,
        method: 'GET',
        header: pointSig ? { 'X-Timestamp': pointSig.timestamp, 'X-Nonce': pointSig.nonce, 'X-Sign': pointSig.sign } : {},
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
    if (!point) {
      point = db.getById(db.TABLES.CHECKIN_POINTS, id) || {}
    }

    // 字段映射：数据库 snake_case -> WXML 使用的字段
    point.crowdLevel = point.crowd_level || point.crowdLevel
    point.crowdPeak = point.crowd_peak || point.crowdPeak
    point.crowdData = {
      morning: point.crowd_morning || '舒适',
      noon: point.crowd_noon || '舒适',
      afternoon: point.crowd_afternoon || '舒适',
      evening: point.crowd_evening || '舒适'
    }
    point.popularityText = formatPopularity(point.popularity)
    point.chargeType = point.charge_type || point.chargeType || 'free'
    if (point.chargeType === 'charge') point.chargeType = 'paid'  // 兼容旧数据
    point.chargePrice = point.charge_price || point.chargePrice || ''
    if (point.chargeType === 'free') {
      point.chargeText = '免费'
    } else {
      point.chargeText = point.chargePrice || '收费'
    }
    point.bestTime = point.best_time || point.bestTime || ''
    // 封面图转绝对 URL
    point.cover = db.toAbsoluteUrl(point.cover)
    // checkin_photos 的 image_url 转绝对 URL
    if (point.photos) {
      point.photos = point.photos.map(p => ({
        ...p,
        image_url: db.toAbsoluteUrl(p.image_url)
      }))
    }
    const crowdInfo = getCrowdLevelText(point.crowdLevel)
    this.setData({ point, crowdInfo })
  },

  async loadPhotos(id) {
    try {
      const { point } = this.data
      let photos = []

      // 优先取 loadPoint 中 detail API 返回的官方 checkin_photos（含绝对 URL）
      if (point && point.photos && point.photos.length > 0) {
        photos = photos.concat(point.photos.map(p => ({
          id: p.id,
          checkin_id: p.checkin_id || id,
          image_url: p.image_url,
          shoot_date: p.shoot_date || p.created_at || '',
          shoot_time: p.shoot_time || '',
          like_count: p.like_count || 0,
          is_liked: !!p.is_liked,
          user_name: p.user_name || '',
          user_avatar: p.user_avatar || ''
        })))
      }

      // 再补充 LIVE_POSTS 中按打卡点名称匹配的图片
      if (point && point.name) {
        const allMatchedPosts = db.table(db.TABLES.LIVE_POSTS)
          .where('location', point.name)
          .orderBy('post_date', 'desc')
          .orderBy('post_time', 'desc')
          .get()

        let takenCount = 0
        for (const post of allMatchedPosts) {
          if (takenCount >= 3) break
          const images = db.table(db.TABLES.LIVE_POST_IMAGES)
            .where('post_id', post.id)
            .orderBy('sort_order', 'asc')
            .get()
          if (images.length === 0) continue
          takenCount++
          images.forEach((img, idx) => {
            photos.push({
              id: 'live_' + post.id + '_' + idx,
              checkin_id: id,
              image_url: db.toAbsoluteUrl(img.image_url),
              shoot_date: post.post_date || '',
              shoot_time: post.post_time || '',
              like_count: post.like_count || 0,
              is_liked: false,
              user_name: post.user_name || '',
              user_avatar: post.user_avatar || ''
            })
          })
        }
      }

      this.setData({
        photos: photos,
        displayPhotos: photos.slice(0, 3)
      })
    } catch (e) {}  // 静默失败，不阻断用户操作
  },

  // ==================== 我要打卡 → 跳转极速状态 ====================
  onDoCheckin() {
    const { point } = this.data
    if (!point.name) {
      wx.showToast({ title: '打卡点信息不完整', icon: 'none' })
      return
    }

    // 记录打卡到本地缓存
    try {
      const user = db.getCurrentUser()
      if (user) {
        // 防止重复记录（同一用户同一点位当天已打卡则不重复写）
        const existing = db.table(db.TABLES.USER_CHECKINS)
          .where('user_id', user.id)
          .where('point_id', this.data.pointId)
          .get()
        const today = new Date().toISOString().split('T')[0]
        const todayChecked = existing.some(r => (r.created_at || '').startsWith(today))
        if (!todayChecked) {
          db.insert(db.TABLES.USER_CHECKINS, {
            user_id: user.id,
            point_id: this.data.pointId,
            status: 'completed'
          })
          // 异步同步到服务端
          const token = wx.getStorageSync('token') || ''
          wx.request({
            url: API_BASE + '/user/' + user.id + '/checkins',
            method: 'POST',
            data: { point_id: this.data.pointId },
            header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
            timeout: 5000,
            fail: () => {}
          })
        }
      }
    } catch (e) { /* ignore */ }

    const lat = point.latitude || ''
    const lng = point.longitude || ''
    const name = encodeURIComponent(point.name)
    wx.navigateTo({
      url: `/pages/live-post/live-post?mode=quick&lat=${lat}&lng=${lng}&locationName=${name}&pointId=${this.data.pointId}&pointName=${name}`
    })
  },

  // 缩略图预览
  onPreviewMiniPhoto(e) {
    const { index } = e.currentTarget.dataset
    const urls = this.data.displayPhotos.map(p => p.image_url)
    wx.previewImage({ current: urls[index], urls })
  },

  // 跳转到全部照片列表页
  onGoPhotoList() {
    const { pointId, point } = this.data
    wx.navigateTo({
      url: `/pages/checkin-photos/checkin-photos?id=${pointId}&name=${point.name}`
    })
  },

  onBack() {
    if (getCurrentPages().length === 1) {
      wx.switchTab({ url: '/pages/index/index' })
    } else {
      wx.navigateBack()
    }
  },

  onNavigate() {
    const { point } = this.data
    if (point.latitude && point.longitude) {
      wx.openLocation({
        latitude: point.latitude,
        longitude: point.longitude,
        name: point.name,
        address: point.landmark,
        scale: 18
      })
    } else {
      wx.showToast({ title: '暂未获取到位置信息', icon: 'none' })
    }
  },

  onShareAppMessage() {
    const { point, pointId } = this.data
    const id = (point && point.id) || pointId
    const name = (point && point.name) || '打卡点'
    const cover = (point && point.cover) || ''
    const desc = (point && point.description) ? point.description.slice(0, 30) : ''
    return {
      title: `大理此刻｜${name}${desc ? ' · ' + desc : ''}`,
      path: `/pages/checkin-detail/checkin-detail?id=${id}`,
      imageUrl: cover
    }
  },

  onShareTimeline() {
    const { point, pointId } = this.data
    const id = (point && point.id) || pointId
    const name = (point && point.name) || '打卡点'
    const cover = (point && point.cover) || ''
    return {
      title: `大理此刻｜${name} — 官方推荐打卡机位`,
      query: `id=${id}`,
      imageUrl: cover
    }
  }
}))
