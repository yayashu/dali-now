const db = require('../../utils/db.js')
const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    spot: null,
    loading: true,
    galleryCurrent: 0,
    images: []
  },

  async onLoad(options) {
    const id = options.id
    if (!id) {
      wx.showToast({ title: '参数错误', icon: 'none' })
      wx.navigateBack()
      return
    }
    await this.loadDetail(id)
  },

  async loadDetail(id) {
    try {
      wx.showLoading({ title: '加载中...' })
      // 始终调详情 API 获取完整字段（列表 API 只有精简字段）
      const found = await this.fetchFromApi(id)
      if (!found) {
        wx.showToast({ title: '景区不存在', icon: 'none' })
        wx.navigateBack()
        return
      }
      // 处理图片画廊
      let images = []
      if (found.images) {
        try {
          const parsed = typeof found.images === 'string' ? JSON.parse(found.images) : found.images
          images = (Array.isArray(parsed) ? parsed : []).map(u => db.toAbsoluteUrl(u))
        } catch (e) { images = [] }
      }
      if (images.length === 0 && found.cover) {
        images = [db.toAbsoluteUrl(found.cover)]
      }
      // 处理标签
      let tags = []
      if (found.tags) {
        tags = typeof found.tags === 'string' ? found.tags.split(/[,，、]/) : found.tags
      }
      // 处理设施
      let facilities = []
      if (found.facilities) {
        facilities = typeof found.facilities === 'string' ? found.facilities.split(/[,，、]/) : found.facilities
      }
      // 票价格式化
      let priceText = ''
      if (found.ticket_type === 'free') {
        priceText = '免费'
      } else if (found.ticket_price) {
        priceText = '¥' + found.ticket_price
      } else {
        priceText = found.ticket_note || '详见景区公告'
      }
      // 时间
      let timeText = ''
      if (found.open_time && found.close_time) {
        timeText = found.open_time + ' - ' + found.close_time
      } else if (found.open_time) {
        timeText = found.open_time
      } else {
        timeText = '全天开放'
      }

      this.setData({
        spot: {
          ...found,
          cover: db.toAbsoluteUrl(found.cover),
          priceText,
          timeText,
          tags,
          facilities,
          levelText: this.getLevelText(found.level)
        },
        images,
        loading: false
      })
    } catch (e) {
      console.error('加载景区详情失败:', e)
      wx.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      wx.hideLoading()
    }
  },

  async fetchFromApi(id) {
    try {
      const { API_BASE, _generateGetSignature } = require('../../utils/config.js')
      const url = API_BASE + '/scenic-spots/' + id
      const sig = _generateGetSignature(url)
      const res = await new Promise((resolve, reject) => {
        wx.request({
          url,
          method: 'GET',
          header: sig ? { 'X-Timestamp': sig.timestamp, 'X-Nonce': sig.nonce, 'X-Sign': sig.sign } : {},
          timeout: 8000,
          success: resolve,
          fail: reject
        })
      })
      if (res.statusCode === 200 && res.data && res.data.code === 0) {
        return res.data.data
      }
      return null
    } catch (e) {
      return null
    }
  },

  getLevelText(level) {
    const map = { '5A': 'AAAAA 级景区', '4A': 'AAAA 级景区', '3A': 'AAA 级景区' }
    return map[level] || (level || '')
  },

  onGalleryChange(e) {
    this.setData({ galleryCurrent: e.detail.current })
  },

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url
    wx.previewImage({ urls: this.data.images, current: url })
  },

  // 复制地址
  onCopyAddress() {
    if (!this.data.spot || !this.data.spot.address) return
    wx.setClipboardData({ data: this.data.spot.address })
    wx.showToast({ title: '地址已复制', icon: 'success' })
  },

  // 拨打景区电话
  onCallPhone() {
    if (!this.data.spot || !this.data.spot.phone) return
    wx.makePhoneCall({ phoneNumber: this.data.spot.phone })
  },

  // 导航到景区
  onNavigate() {
    const spot = this.data.spot
    if (!spot || !spot.latitude || !spot.longitude) {
      wx.showToast({ title: '暂无定位信息', icon: 'none' })
      return
    }
    wx.openLocation({
      latitude: parseFloat(spot.latitude),
      longitude: parseFloat(spot.longitude),
      name: spot.name,
      address: spot.address || '',
      scale: 15
    })
  }
}))
