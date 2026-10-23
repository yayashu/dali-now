const { adminGet, adminPost, adminPut } = require('../../../../utils/admin')
const { uploadImage } = require('../../../../utils/db')

Page({
  data: {
    isEdit: false,
    editId: null,
    submitting: false,
    district_name: '',            // 所属区域显示名称
    // 区域
    districts: [],
    showDistrictPicker: false,
    // 表单
    form: {
      name: '',
      district_code: '',
      cover: '',
      images: [],        // [{url, desc}]
      description: '',
      overview: '',
      ticket_type: 'free',
      ticket_price: '',
      ticket_note: '',
      half_price_note: '',
      open_time: '',
      close_time: '',
      best_season: '',
      suggested_time: '',
      entrance: '',
      entrance_lat: '',
      entrance_lng: '',
      parking: '',
      parking_lat: '',
      parking_lng: '',
      parking_fee: '',
      address: '',
      latitude: '',
      longitude: '',
      phone: '',
      website: '',
      level: '',
      tags: '',
      facilities: '',
      transport: '',
      notice: '',
      tips: '',
      popularity: 0,
      status: 'active',
      sort_order: 0
    }
  },

  onLoad(options) {
    this.loadDistricts()
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      this.loadDetail(options.id)
    }
  },

  onBack() {
    wx.navigateBack()
  },

  async loadDistricts() {
    try {
      const rows = await adminGet('/districts', { size: 200 })
      this.setData({ districts: rows.list || [] })
    } catch (e) { /* 静默 */ }
  },

  async loadDetail(id) {
    try {
      const spot = await adminGet(`/scenic-spots/${id}`)
      const form = { ...this.data.form }
      for (const key of Object.keys(form)) {
        if (spot[key] !== undefined && spot[key] !== null) {
          if (key === 'images') {
            form[key] = typeof spot[key] === 'string' ? JSON.parse(spot[key] || '[]') : spot[key]
          } else if (['ticket_price', 'popularity', 'sort_order'].includes(key)) {
            form[key] = String(spot[key] || 0)
          } else {
            form[key] = String(spot[key])
          }
        }
      }
      this.setData({ form, 'form.ticket_type': spot.ticket_type || 'free' })
      this._updateDistrictName(form.district_code)
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },

  // 通用输入
  onFieldInput(e) {
    const { field } = e.currentTarget.dataset
    this.setData({ [`form.${field}`]: e.detail.value })
  },

  // 区域选择
  onToggleDistrict() {
    this.setData({ showDistrictPicker: !this.data.showDistrictPicker })
  },
  onDistrictSelect(e) {
    const { code, name } = e.currentTarget.dataset
    this.setData({
      'form.district_code': code,
      district_name: name,
      showDistrictPicker: false
    })
  },

  // 根据 district_code 查找区域名称
  _updateDistrictName(code) {
    if (!code) { this.setData({ district_name: '' }); return }
    const d = (this.data.districts || []).find(item => item.code === code)
    this.setData({ district_name: d ? d.name : code })
  },

  // 门票类型
  onTicketTypeChange(e) {
    this.setData({ 'form.ticket_type': e.currentTarget.dataset.value })
  },

  // 状态
  onStatusChange(e) {
    this.setData({ 'form.status': e.currentTarget.dataset.value })
  },

  // 上传封面
  async onChooseCover() {
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] })
      const tempPath = res.tempFiles[0].tempFilePath
      wx.showLoading({ title: '上传中...' })
      const url = await uploadImage(tempPath, 'full')
      wx.hideLoading()
      this.setData({ 'form.cover': url })
    } catch (e) {
      wx.hideLoading()
      if (e.errMsg && e.errMsg.includes('cancel')) return
      wx.showToast({ title: '上传失败', icon: 'none' })
    }
  },

  // 添加图片到 images
  async onAddImage() {
    try {
      const res = await wx.chooseMedia({ count: 1, mediaType: ['image'], sizeType: ['compressed'] })
      const tempPath = res.tempFiles[0].tempFilePath
      wx.showLoading({ title: '上传中...' })
      const url = await uploadImage(tempPath, 'full')
      wx.hideLoading()
      const images = [...this.data.form.images, { url, desc: '' }]
      this.setData({ 'form.images': images })
    } catch (e) {
      wx.hideLoading()
      if (e.errMsg && e.errMsg.includes('cancel')) return
    }
  },

  onRemoveImage(e) {
    const idx = e.currentTarget.dataset.index
    const images = [...this.data.form.images]
    images.splice(idx, 1)
    this.setData({ 'form.images': images })
  },

  onImageDescInput(e) {
    const idx = e.currentTarget.dataset.index
    this.setData({ [`form.images[${idx}].desc`]: e.detail.value })
  },

  // 地图选点（入口/停车场/景区位置）
  onChooseLocation(e) {
    const field = e.currentTarget.dataset.field
    wx.chooseLocation({
      success: (res) => {
        if (field === 'entrance') {
          this.setData({ 'form.entrance': res.name || res.address, 'form.entrance_lat': String(res.latitude), 'form.entrance_lng': String(res.longitude) })
        } else if (field === 'parking') {
          this.setData({ 'form.parking': res.name || res.address, 'form.parking_lat': String(res.latitude), 'form.parking_lng': String(res.longitude) })
        } else {
          this.setData({ 'form.address': res.name || res.address, 'form.latitude': String(res.latitude), 'form.longitude': String(res.longitude) })
        }
      }
    })
  },

  // 景区级别
  onLevelChange(e) {
    this.setData({ 'form.level': e.currentTarget.dataset.value })
  },

  // 提交
  async onSubmit() {
    const { form, isEdit, editId } = this.data
    if (!form.name.trim()) {
      wx.showToast({ title: '请输入景区名称', icon: 'none' })
      return
    }
    this.setData({ submitting: true })
    try {
      // 构建提交数据
      const data = { ...form }
      data.ticket_price = parseFloat(form.ticket_price) || 0
      data.popularity = parseInt(form.popularity) || 0
      data.sort_order = parseInt(form.sort_order) || 0
      data.entrance_lat = parseFloat(form.entrance_lat) || null
      data.entrance_lng = parseFloat(form.entrance_lng) || null
      data.parking_lat = parseFloat(form.parking_lat) || null
      data.parking_lng = parseFloat(form.parking_lng) || null
      data.latitude = parseFloat(form.latitude) || null
      data.longitude = parseFloat(form.longitude) || null

      if (isEdit) {
        await adminPut(`/scenic-spots/${editId}`, data)
        wx.showToast({ title: '更新成功', icon: 'success' })
      } else {
        await adminPost('/scenic-spots', data)
        wx.showToast({ title: '创建成功', icon: 'success' })
      }
      setTimeout(() => wx.navigateBack(), 800)
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
