const db = require('../../utils/db.js')
const { API_BASE } = require('../../utils/config.js')
const sensitiveFilter = require('../../utils/sensitive-filter.js')
const { withTheme } = require('../../utils/util')

Page(withTheme({
  data: {
    activityId: '',
    activityName: '',
    price: 0,
    isFree: true,
    formData: {
      name: '',
      phone: '',
      count: 1
    },
    agreed: false,
    canSubmit: false
  },

  onLoad(options) {
    this.setData({
      activityId: options.id || '',
      activityName: options.name || '',
      price: Number(options.price) || 0,
      isFree: options.isFree === 'true'
    })
  },

  onInput(e) {
    const { field } = e.currentTarget.dataset
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
    this.checkCanSubmit()
  },

  onDecrease() {
    if (this.data.formData.count <= 1) return
    this.setData({
      'formData.count': this.data.formData.count - 1
    })
  },

  onIncrease() {
    this.setData({
      'formData.count': this.data.formData.count + 1
    })
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed })
    this.checkCanSubmit()
  },

  checkCanSubmit() {
    const { name, phone } = this.data.formData
    const canSubmit = name && phone && phone.length === 11 && this.data.agreed
    this.setData({ canSubmit })
  },

  async onSubmit() {
    if (!this.data.canSubmit) return

    // 敏感词自动替换为 *（静默处理，不弹窗）
    const safeName = await sensitiveFilter.clean(this.data.formData.name)
    this.setData({ 'formData.name': safeName })

    const { isFree, activityId, activityName, formData } = this.data

    if (!isFree) {
      // 模拟支付
      wx.showModal({
        title: '确认支付',
        content: `确认支付 ¥${this.data.price * formData.count}？`,
        success: (res) => {
          if (res.confirm) {
            this.doBooking()
          }
        }
      })
    } else {
      this.doBooking()
    }
  },

  doBooking() {
    wx.showLoading({ title: '提交中...' })

    // 写入预约记录到本地缓存
    try {
      const user = db.getCurrentUser()
      if (user) {
        db.insert(db.TABLES.USER_BOOKINGS, {
          user_id: user.id,
          activity_id: this.data.activityId,
          status: 'confirmed',
          count: this.data.formData.count,
          name: this.data.formData.name,
          phone: this.data.formData.phone
        })
        // 异步同步到服务端
        const token = wx.getStorageSync('token') || ''
        wx.request({
          url: API_BASE + '/user/' + user.id + '/bookings',
          method: 'POST',
          data: {
            activity_id: this.data.activityId,
            name: this.data.formData.name,
            phone: this.data.formData.phone,
            count: this.data.formData.count
          },
          header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
          timeout: 5000,
          fail: () => {}
        })
      }
    } catch (e) { /* 不影响主流程 */ }

    setTimeout(() => {
      wx.hideLoading()
      wx.redirectTo({
        url: `/pages/booking-confirm/booking-confirm?name=${this.data.activityName}&isFree=${this.data.isFree}`
      })
    }, 1000)
  }
}))
