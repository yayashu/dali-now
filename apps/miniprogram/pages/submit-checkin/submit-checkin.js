const app = getApp()
const db = require('../../utils/db.js')
const { API_BASE } = require('../../utils/config.js')
const { withTheme, checkUserMuted } = require('../../utils/util.js')

Page(withTheme({
  data: {
    form: {
      name: '',
      type: 'scenic',
      cover: '',
      location: '',
      latitude: null,
      longitude: null,
      description: '',
      tips: '',
      best_time: '',
      crowd_peak: '',
      review_status: 'pending'
    },
    submitting: false
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  onTypeSelect(e) {
    this.setData({ 'form.type': e.currentTarget.dataset.value })
  },

  // 选择封面图
  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        // 先显示临时预览
        this.setData({ 'form.cover': tempPath })
        // 异步上传，上传成功后替换为服务端 URL
        db.uploadImage(tempPath, 'full').then(result => {
          if (result && result.full_url) this.setData({ 'form.cover': result.full_url })
        }).catch(() => {
          wx.showToast({ title: '图片上传失败，请重试', icon: 'none' })
          this.setData({ 'form.cover': '' })
        })
      }
    })
  },

  // 选择位置
  onChooseLocation() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          'form.location': res.name || res.address,
          'form.latitude': res.latitude,
          'form.longitude': res.longitude
        })
      }
    })
  },

  // 表单校验
  checkForm() {
    const f = this.data.form
    if (!f.name.trim()) {
      wx.showToast({ title: '请输入点位名称', icon: 'none' })
      return false
    }
    if (!f.location) {
      wx.showToast({ title: '请选择位置', icon: 'none' })
      return false
    }
    return true
  },

  // 提交
  onSubmit() {
    if (!app.globalData.isLoggedIn) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const banCheck = checkUserMuted()
    if (banCheck.banned) {
      wx.showModal({ title: '无法提交', content: banCheck.msg, showCancel: false })
      return
    }
    if (!this.checkForm()) return

    this.setData({ submitting: true })

    const data = { ...this.data.form }
    // 如果封面是临时路径，最后再尝试上传一次
    if (data.cover && (data.cover.startsWith('wxfile://') || data.cover.startsWith('http://tmp/'))) {
      data.cover = ''
    }

    const token = wx.getStorageSync('token') || ''
    wx.request({
      url: API_BASE + '/checkin/points/submit',
      method: 'POST',
      header: { 'Content-Type': 'application/json', 'Authorization': token ? 'Bearer ' + token : '' },
      data: data,
      timeout: 10000,
      success: (res) => {
        if (res.data && res.data.code === 0) {
          wx.showToast({ title: '提交成功，等待审核', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          wx.showToast({ title: res.data.msg || '提交失败', icon: 'none' })
        }
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请重试', icon: 'none' })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  }
}))
