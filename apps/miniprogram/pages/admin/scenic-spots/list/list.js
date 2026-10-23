const { adminGet, adminDelete } = require('../../../../utils/admin')

Page({
  data: {
    list: [],
    total: 0,
    page: 1,
    size: 20,
    hasMore: false,
    keyword: '',
    loading: true,
    showSearch: false
  },

  onLoad() {
    this.loadList()
  },

  onShow() {
    // 每次显示时刷新
    if (this._initialized) {
      this.loadList()
    }
    this._initialized = true
  },

  async loadList(reset = true) {
    if (reset) this.setData({ page: 1, list: [] })
    const { page, size, keyword } = this.data
    this.setData({ loading: true })
    try {
      const params = { page, size }
      if (keyword) params.keyword = keyword
      const result = await adminGet('/scenic-spots', params)
      const newList = reset ? result.list : [...this.data.list, ...result.list]
      this.setData({
        list: newList,
        total: result.total,
        hasMore: newList.length < result.total,
        loading: false
      })
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
      this.setData({ loading: false })
    }
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value })
  },

  onSearch() {
    this.loadList(true)
  },

  onClearSearch() {
    this.setData({ keyword: '', showSearch: false })
    this.loadList(true)
  },

  onToggleSearch() {
    if (this.data.showSearch) {
      this.setData({ showSearch: false, keyword: '' })
      this.loadList(true)
    } else {
      this.setData({ showSearch: true })
    }
  },

  onLoadMore() {
    if (!this.data.hasMore || this.data.loading) return
    this.setData({ page: this.data.page + 1 })
    this.loadList(false)
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/admin/scenic-spots/edit/edit' })
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/admin/scenic-spots/edit/edit?id=${id}` })
  },

  async onDelete(e) {
    const { id, name } = e.currentTarget.dataset
    const confirm = await new Promise(resolve => {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除景区"${name}"吗？此操作不可恢复。`,
        success: res => resolve(res.confirm)
      })
    })
    if (!confirm) return
    try {
      await adminDelete(`/scenic-spots/${id}`)
      wx.showToast({ title: '已删除', icon: 'success' })
      this.loadList(true)
    } catch (e) {
      wx.showToast({ title: e.message, icon: 'none' })
    }
  },

  onLogout() {
    wx.removeStorageSync('admin_token')
    wx.redirectTo({ url: '/pages/admin/login/login' })
  }
})
