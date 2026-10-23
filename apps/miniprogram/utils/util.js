/**
 * 工具函数
 */
const config = require('./config.js')

// 格式化数字（万）
function formatNumber(num) {
  if (num == null) return '0'
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + 'w'
  }
  return num.toString()
}

// 格式化时间
function formatTime(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hour)}:${padZero(minute)}`
}

function padZero(n) {
  return n < 10 ? '0' + n : n
}

// 人流等级映射
function getCrowdLevelText(level) {
  const map = {
    '空旷': { text: '空旷', class: 'success', color: '#27ae60' },
    '舒适': { text: '舒适', class: 'primary', color: '#1a6b4b' },
    '较多': { text: '较多', class: 'accent', color: '#e8a838' },
    '拥堵': { text: '拥堵', class: 'danger', color: '#e74c3c' }
  }
  return map[level] || map['舒适']
}

/**
 * 根据热度值自动计算热度等级
 * @param {number} hotValue - 热度数值
 * @returns {{ level: string, class: string }} 等级名称和样式类
 */
function getHotLevel(hotValue) {
  const v = parseInt(hotValue) || 0
  const { boom, hot } = config.heatLevels
  let level, cls
  if (v >= boom) {
    level = '爆火'
    cls = 'tag-danger'
  } else if (v >= hot) {
    level = '热门'
    cls = 'tag-accent'
  } else {
    level = '普通'
    cls = 'tag-outline'
  }
  return { level, class: cls }
}

// 热门等级映射（保留兼容旧接口）
function getHotLevelClass(level) {
  const map = {
    '爆火': 'tag-danger',
    '热门': 'tag-accent',
    '普通': 'tag-outline'
  }
  return map[level] || 'tag-outline'
}

// 防抖
function debounce(fn, delay = config.debounceDelay) {
  let timer = null
  return function (...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

// 节流
function throttle(fn, delay = config.throttleDelay) {
  let last = 0
  return function (...args) {
    const now = Date.now()
    if (now - last >= delay) {
      last = now
      fn.apply(this, args)
    }
  }
}

// 获取当前日期字符串
function getTodayStr() {
  const d = new Date()
  const pad = n => n < 10 ? '0' + n : n
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * 为 Page 配置注入主题支持
 * 自动读取 app.globalData.theme 并注入 themeClass 到 data
 * 同时在 onLoad / onShow 中同步主题，保证 tab 页切回时也能更新
 */
function withTheme(cfg) {
  cfg.data = cfg.data || {}
  if (!('themeClass' in cfg.data)) {
    cfg.data.themeClass = ''
  }

  function syncTheme(ctx) {
    const app = getApp()
    if (!app || !app.globalData) return
    const themeClass = app.globalData.theme === 'ocean' ? 'theme-ocean' : ''
    ctx.setData({ themeClass })
  }

  const originalOnLoad = cfg.onLoad
  cfg.onLoad = function (options) {
    syncTheme(this)
    if (typeof originalOnLoad === 'function') {
      return originalOnLoad.call(this, options)
    }
  }

  const originalOnShow = cfg.onShow
  cfg.onShow = function () {
    syncTheme(this)
    if (typeof originalOnShow === 'function') {
      return originalOnShow.call(this)
    }
  }

  return cfg
}

/**
 * 为 Page 配置注入返回顶部支持
 * @param {object} config - Page 配置对象
 * @param {object} [options] - 选项
 * @param {number} [options.threshold=400] - 触发显示的滚动距离(px)
 * @param {string} [options.mode='page'] - 'page' 页面滚动 | 'scroll-view' 组件滚动
 * @param {boolean} [options.refreshOnTop=false] - 点击返回顶部时是否同时刷新数据
 */
function withBackTop(configPage, options = {}) {
  configPage.data = configPage.data || {}
  const threshold = options.threshold || config.backTopThreshold
  const refreshOnTop = options.refreshOnTop || false
  if (!('showBackTop' in configPage.data)) {
    configPage.data.showBackTop = false
  }

  if (options.mode === 'scroll-view') {
    // 用 null 作为默认值，WXML 中 {{null}} 渲染为空字符串，
    // scroll-view 的 scroll-top 为空时不会干涉正常滚动。
    // 注意：不能用 0 或 -1（两者都会被当作 0 拉回顶部）。
    if (!('scrollTop' in configPage.data)) {
      configPage.data.scrollTop = null
    }

    const originalOnScroll = configPage.onScroll
    configPage.onScroll = function (e) {
      const st = e.detail.scrollTop
      const show = st > threshold
      if (show !== this.data.showBackTop) {
        this.setData({ showBackTop: show })
      }
      if (typeof originalOnScroll === 'function') {
        return originalOnScroll.call(this, e)
      }
    }

    configPage.onBackTop = function () {
      // 先设置 scrollTop=0 让 scroll-view 回到顶部
      this.setData({ scrollTop: 0, showBackTop: false }, () => {
        // 回到顶部后立即重置为 null，释放 scroll-top 绑定
        this.setData({ scrollTop: null })
        if (refreshOnTop && typeof this.refreshData === 'function') {
          this.refreshData()
        }
      })
    }
  } else {
    const originalOnPageScroll = configPage.onPageScroll
    configPage.onPageScroll = function (e) {
      const show = e.scrollTop > threshold
      if (show !== this.data.showBackTop) {
        this.setData({ showBackTop: show })
      }
      if (typeof originalOnPageScroll === 'function') {
        return originalOnPageScroll.call(this, e)
      }
    }

    configPage.onBackTop = function () {
      wx.pageScrollTo({ scrollTop: 0, duration: 300 })
      this.setData({ showBackTop: false })
      if (refreshOnTop && typeof this.refreshData === 'function') {
        this.refreshData()
      }
    }
  }

  return configPage
}

/**
 * 检查当前用户是否被禁闭（不可发布）
 * @returns {{ banned: boolean, msg: string }} 
 */
function checkUserMuted() {
  const app = getApp()
  const status = app.globalData.userStatus || 'active'
  if (status === 'muted') {
    const reason = app.globalData.banReason || '您的账号已被禁闭'
    const until = app.globalData.banUntil
    let msg = reason
    if (until) msg += '，预计 ' + until.slice(0, 16) + ' 解除'
    msg += '。禁闭期间仅可浏览，不可发布任何内容。'
    return { banned: true, msg }
  }
  return { banned: false, msg: '' }
}

module.exports = {
  formatNumber,
  formatTime,
  getCrowdLevelText,
  getHotLevel,
  getHotLevelClass,
  debounce,
  throttle,
  getTodayStr,
  withTheme,
  withBackTop,
  checkUserMuted
}
