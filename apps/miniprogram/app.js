const db = require('./utils/db.js')

App({
  globalData: {
    userInfo: null,
    userStatus: 'active',   // 用户封禁状态
    banUntil: null,          // 禁闭截止时间
    banReason: '',           // 封禁原因
    location: {
      region: '大理全域',
      district: ''
    },
    isLoggedIn: false,
    dbReady: false,
    appReady: false,
    theme: 'green'
  },

  onLaunch() {
    this.checkLoginStatus()
    this.restoreUserInfo()

    // 恢复主题设置
    const savedTheme = wx.getStorageSync('theme')
    if (savedTheme === 'ocean' || savedTheme === 'green') {
      this.globalData.theme = savedTheme
    }

    // 并行执行初始化任务，全部完成后标记 appReady
    const initTasks = [
      // 获取用户位置（不阻塞初始化）
      new Promise((resolve) => {
        this.getUserLocation()
        resolve()
      }),
      // 初始化数据库
      db.initDatabase().then(() => {
        this.globalData.dbReady = true
      }).catch(() => {
        this.globalData.dbReady = true
      })
    ]

    Promise.all(initTasks).then(() => {
      this.globalData.appReady = true
    }).catch(() => {
      // 即使部分失败也标记为可用（有缓存兜底）
      this.globalData.appReady = true
    })
  },

  onShow() {
    // 每次小程序切回前台时，重新验证已登录用户的封禁状态
    if (this.globalData.isLoggedIn) {
      this.verifyUserStatus()
    }
  },

  getUserLocation() {
    // 先尝试从缓存读取位置
    const cachedLocation = wx.getStorageSync('userLocation')
    if (cachedLocation) {
      this.globalData.location = cachedLocation
    }
    // 异步获取位置，短超时避免触发框架 timeout
    wx.getLocation({
      type: 'gcj02',
      timeout: 2000,
      success: (res) => {
        const loc = {
          latitude: res.latitude,
          longitude: res.longitude,
          region: '大理全域'
        }
        this.globalData.location = loc
        wx.setStorageSync('userLocation', loc)
      },
      fail: () => {
        // 模拟器/无权限时静默回退
      }
    })
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.isLoggedIn = true
      // 恢复用户ID（避免每次重启后 getCurrentUser 回退到本地假数据）
      const userId = wx.getStorageSync('_userId')
      if (userId) {
        this.globalData._userId = userId
      }
      // 异步向服务端验证封禁状态
      this.verifyUserStatus()
    }
  },

  // 向服务端验证当前用户的封禁状态
  verifyUserStatus() {
    const { API_BASE, _generateGetSignature } = require('./utils/config.js')
    const userId = this.globalData._userId || wx.getStorageSync('_userId')
    if (!userId) return

    const url = API_BASE + '/user/' + userId + '/status'
    const sig = _generateGetSignature(url)
    const header = sig ? { 'X-Timestamp': sig.timestamp, 'X-Nonce': sig.nonce, 'X-Sign': sig.sign } : {}

    wx.request({
      url: url,
      method: 'GET',
      header: header,
      timeout: 5000,
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          const info = res.data.data || {}
          const status = info.status || 'active'

          if (status === 'disabled') {
            // 禁用：强制清除登录状态
            this._clearLoginState()
            wx.showModal({
              title: '账号已被禁用',
              content: info.ban_reason || '您的账号已被禁用，无法使用小程序。如有疑问请联系管理员。',
              showCancel: false,
              confirmText: '知道了'
            })
          } else if (status === 'muted') {
            // 禁闭：保持登录，更新禁闭信息供各页面展示
            this.globalData.userStatus = 'muted'
            this.globalData.banUntil = info.ban_until || null
            this.globalData.banReason = info.ban_reason || ''
          } else {
            // 正常状态（含禁闭到期自动恢复）
            this.globalData.userStatus = 'active'
            this.globalData.banUntil = null
            this.globalData.banReason = ''
          }
        }
      },
      fail: () => {
        // 网络失败不处理，保持当前登录状态
      }
    })
  },

  // 清除登录状态（内部使用）
  _clearLoginState() {
    wx.removeStorageSync('token')
    wx.removeStorageSync('_userId')
    wx.removeStorageSync('userAvatar')
    wx.removeStorageSync('userNickname')
    wx.removeStorageSync('userPhone')
    this.globalData.isLoggedIn = false
    this.globalData.userInfo = null
    this.globalData._userId = null
    this.globalData.userStatus = 'active'
    this.globalData.banUntil = null
    this.globalData.banReason = ''
  },

  // 从缓存恢复用户信息
  restoreUserInfo() {
    const avatar = wx.getStorageSync('userAvatar') || ''
    const nickname = wx.getStorageSync('userNickname') || ''
    const phone = wx.getStorageSync('userPhone') || ''
    if (avatar || nickname) {
      this.globalData.userInfo = {
        avatar,
        nickname: nickname || '旅行者·大理',
        name: nickname || '旅行者·大理',
        phone
      }
    }
  },

  // 获取用户信息（供其他页面调用）
  getUserInfo() {
    if (this.globalData.userInfo) {
      return this.globalData.userInfo
    }
    const avatar = wx.getStorageSync('userAvatar') || ''
    const nickname = wx.getStorageSync('userNickname') || ''
    const phone = wx.getStorageSync('userPhone') || ''
    if (avatar || nickname) {
      this.globalData.userInfo = {
        avatar,
        nickname: nickname || '旅行者·大理',
        name: nickname || '旅行者·大理',
        phone
      }
    }
    return this.globalData.userInfo
  },

  login(privacyAgreed = false) {
    const { API_BASE } = require('./utils/config.js')
    return new Promise((resolve, reject) => {
      // 第1步：wx.login 获取临时 code
      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) {
            return reject(new Error('wx.login 失败'))
          }
          const code = loginRes.code

          // 第2步：尝试获取微信用户信息（头像+昵称）
          const doLogin = (userInfo) => {
            wx.request({
              url: API_BASE + '/user/login',
              method: 'POST',
              data: {
                code,
                nickname: userInfo ? userInfo.nickname : '',
                avatar: userInfo ? userInfo.avatar : '',
                privacy_agreed: privacyAgreed ? 1 : 0
              },
              success: (apiRes) => {
                if (apiRes.statusCode === 200 && apiRes.data && apiRes.data.code === 0) {
                  const { token, user, is_new_user } = apiRes.data.data
                  // 存储真实 token 和用户信息
                  wx.setStorageSync('token', token)
                  this.globalData.isLoggedIn = true
                  this.globalData.userInfo = {
                    id: user.id,
                    openid: user.openid,
                    avatar: user.avatar || '',
                    nickname: user.nickname || '旅行者·大理',
                    name: user.nickname || '旅行者·大理',
                    phone: user.phone || ''
                  }
                  this.globalData._userId = user.id
                  // 存储封禁状态
                  this.globalData.userStatus = user.status || 'active'
                  this.globalData.banUntil = user.ban_until || null
                  this.globalData.banReason = user.ban_reason || ''
                  wx.setStorageSync('_userId', user.id)
                  wx.setStorageSync('userAvatar', user.avatar || '')
                  wx.setStorageSync('userNickname', user.nickname || '')
                  wx.setStorageSync('userPhone', user.phone || '')
                  resolve({ token, user, is_new_user })
                } else {
                  // 登录被拒绝（如被禁用）
                  const errMsg = apiRes.data && apiRes.data.msg || '服务端登录失败'
                  wx.showModal({ title: '登录失败', content: errMsg, showCancel: false })
                  reject(new Error(errMsg))
                }
              },
              fail: (err) => {
                reject(err)
              }
            })
          }

          // 尝试获取用户头像昵称（新版微信可能不支持，静默回退）
          if (wx.getUserProfile) {
            wx.getUserProfile({
              desc: '用于完善个人资料',
              success: (profileRes) => {
                const info = profileRes.userInfo || {}
                doLogin({
                  nickname: info.nickName || '',
                  avatar: info.avatarUrl || ''
                })
              },
              fail: () => {
                // getUserProfile 失败（用户拒绝或新版不支持），用 code 静默登录
                doLogin(null)
              }
            })
          } else {
            // 旧版或基础库不支持，直接 code 登录
            doLogin(null)
          }
        },
        fail: reject
      })
    })
  },

  // 切换主题并即时生效
  switchTheme(theme) {
    if (theme !== 'green' && theme !== 'ocean') return
    this.globalData.theme = theme
    wx.setStorageSync('theme', theme)
    const pages = getCurrentPages()
    if (pages.length > 0) {
      const page = pages[pages.length - 1]
      page.setData({ themeClass: theme === 'ocean' ? 'theme-ocean' : '' })
    }
  }
})
