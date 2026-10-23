const { adminPost } = require('../../../utils/admin')

Page({
  data: {
    username: '',
    password: '',
    loading: false
  },

  onLoad() {
    // 已有 token 则直接跳转
    const token = wx.getStorageSync('admin_token')
    if (token) {
      wx.redirectTo({ url: '/pages/admin/scenic-spots/list/list' })
    }
  },

  onUsernameInput(e) {
    this.setData({ username: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  async onLogin() {
    const { username, password } = this.data
    if (!username || !password) {
      wx.showToast({ title: '请输入用户名和密码', icon: 'none' })
      return
    }
    this.setData({ loading: true })
    try {
      const result = await adminPost('/login', { username, password })
      wx.setStorageSync('admin_token', result.token)
      wx.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        wx.redirectTo({ url: '/pages/admin/scenic-spots/list/list' })
      }, 500)
    } catch (e) {
      wx.showToast({ title: e.message || '登录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
