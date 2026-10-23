const app = getApp()
const db = require('../../utils/db.js')
const { API_BASE } = require('../../utils/config.js')
const { withTheme, checkUserMuted } = require('../../utils/util.js')

Page(withTheme({
  data: {
    form: {
      name: '',
      type: 'folk',
      type_name: '',
      cover: '',
      date: '',
      time_range: '',
      location: '',
      latitude: null,
      longitude: null,
      organizer: '',
      description: '',
      notes: '',
      status: 'active',
      review_status: 'pending'
    },
    submitting: false
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  // 选择封面图
  onChooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempPath = res.tempFiles[0].tempFilePath
        this.setData({ 'form.cover': tempPath })
        db.uploadImage(tempPath, 'full').then(result => {
          if (result && result.full_url) this.setData({ 'form.cover': result.full_url })
        }).catch(() => {
          wx.showToast({ title: '图片上传失败，请重试', icon: 'none' })
          this.setData({ 'form.cover': '' })
        })
      }
    })
  },

  // 选择日期
  onPickDate() {
    wx.showModal({
      title: '选择日期',
      content: '请在下方的日期选择器中输入日期',
      showCancel: false,
      confirmText: '知道了',
      success: () => {
        // 使用简单的输入方式，避免复杂日期选择器
        wx.showModal({
          title: '输入日期',
          editable: true,
          placeholderText: '格式: 2026-06-15',
          success: (res) => {
            if (res.confirm && res.content) {
              const d = res.content.trim()
              if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                this.setData({ 'form.date': d })
              } else {
                wx.showToast({ title: '日期格式不正确', icon: 'none' })
              }
            }
          }
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
      wx.showToast({ title: '请输入活动名称', icon: 'none' })
      return false
    }
    if (!f.date) {
      wx.showToast({ title: '请选择活动日期', icon: 'none' })
      return false
    }
    if (!f.location) {
      wx.showToast({ title: '请选择活动地点', icon: 'none' })
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
    if (data.cover && (data.cover.startsWith('wxfile://') || data.cover.startsWith('http://tmp/'))) {
      data.cover = ''
    }
    // 自动推断 type 字段
    if (!data.type && data.type_name) {
      data.type = 'folk'
    }

    const token = wx.getStorageSync('token') || ''
    wx.request({
      url: API_BASE + '/activities/submit',
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
