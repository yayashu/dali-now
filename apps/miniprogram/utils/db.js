/**
 * 大理此刻 - 数据库管理模块 (db.js) - MySQL 版
 * ============================================================
 * 通过 HTTP API 连接远程 MySQL 数据库。
 * 前端 API 接口保持不变，底层由 wx.Storage 切换为网络请求。
 *
 * 设计原则:
 * 1. 保持与旧版完全一致的调用接口，所有页面无需修改
 * 2. 基于 wx.request 封装，返回 Promise
 * 3. Query 类在本地内存中操作数据（从 API 获取全量后本地筛选）
 * ============================================================
 */

// ============================================================
// API 配置
// ============================================================

const { compressImage, compressByType } = require('./image-compress.js')

const { API_BASE, STATIC_BASE } = require('./config.js')

// 请求签名（防滥用）
const { sha256 } = require('./crypto.js')
var API_SECRET = 'your_api_secret_here'  // 必须与服务端环境变量 API_SECRET 一致

function _generateGetSign(uri) {
  try {
    // 补上 /api 前缀 + 去掉查询参数，与服务端 req.path 对齐
    var pathOnly = '/api' + uri.split('?')[0]
    var ts = Date.now().toString()
    var nonce = ''
    for (var i = 0; i < 8; i++) {
      nonce += '0123456789abcdef'[Math.floor(Math.random() * 16)]
    }
    var raw = ts + '|' + nonce + '|GET|' + pathOnly + '|' + API_SECRET
    var sign = sha256(raw)
    return { 'X-Timestamp': ts, 'X-Nonce': nonce, 'X-Sign': sign }
  } catch (e) { return null }
}

// 表名常量（保持不变）
const TABLES = {
  DISTRICTS: 'districts',
  ACTIVITIES: 'activities',
  ACTIVITY_TAGS: 'activity_tags',
  ACTIVITY_IMAGES: 'activity_images',
  CHECKIN_POINTS: 'checkin_points',
  LIVE_POSTS: 'live_posts',
  LIVE_POST_IMAGES: 'live_post_images',
  COMMUNITY_POSTS: 'community_posts',
  COMMUNITY_TAGS: 'community_tags',
  CHECKIN_PHOTOS: 'checkin_photos',
  HOMEPAGE_PHOTOS: 'homepage_photos',
  LOCAL_LIFE_CATEGORIES: 'local_life_categories',
  LOCAL_LIFE_ITEMS: 'local_life_items',
  SCENIC_SPOTS: 'scenic_spots',
  USERS: 'users',
  USER_BOOKINGS: 'user_bookings',
  USER_CHECKINS: 'user_checkins',
  USER_FAVORITES: 'user_favorites',
  USER_LIKES: 'user_likes',
  SEARCH_HISTORY: 'search_history',
  APP_CONFIG: 'app_config'
}

// ============================================================
// 网络请求封装
// ============================================================

/**
 * 发起 API 请求
 */
// 请求超时时间（毫秒）
const REQUEST_TIMEOUT = 3000
const UPLOAD_TIMEOUT = 30000

function _request(method, path, data) {
  return new Promise((resolve) => {
    const token = wx.getStorageSync('token') || ''
    // 生成 GET 请求防滥用签名
    var sigHeaders = {}
    if (method === 'GET') {
      var sig = _generateGetSign(path)
      if (sig) sigHeaders = sig
    }
    wx.request({
      url: API_BASE + path,
      method: method,
      data: data,
      timeout: REQUEST_TIMEOUT,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? 'Bearer ' + token : '',
        ...sigHeaders
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.code === 0) {
          resolve(res.data.data)
        } else {
          resolve(method === 'GET' ? [] : null)
        }
      },
      fail: () => {
        resolve(method === 'GET' ? [] : null)
      }
    })
  })
}

function _get(path, params) {
  const queryStr = params ? '?' + Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&') : ''
  return _request('GET', path + queryStr)
}

function _post(path, data) {
  return _request('POST', path, data)
}

function _put(path, data) {
  return _request('PUT', path, data)
}

function _delete(path, data) {
  return _request('DELETE', path, data)
}

/**
 * 上传单张图片到服务器（分场景压缩）
 * 使用 wx.request + base64 方式（避免 wx.uploadFile 引入的兼容性问题）
 * @param {string} filePath - 图片本地临时路径
 * @param {'avatar'|'thumb'|'full'} [type='thumb'] - 压缩类型
 *   avatar: 宽≤400px, 质量75 → ~10-25KB  用于头像
 *   thumb:  宽≤600px, 质量78 → ~20-45KB  用于列表缩略图
 *   full:   宽≤1200px,质量82 → ~80-180KB 用于大图浏览
 * @returns {Promise<object>} { url, full_url }
 */
function uploadImage(filePath, type = 'thumb') {
  return new Promise((resolve, reject) => {
    // 按类型分档压缩
    compressByType(filePath, type).then((compressedPath) => {
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath: compressedPath,
        success: (readRes) => {
          const base64 = wx.arrayBufferToBase64(readRes.data)
            const token = wx.getStorageSync('token') || ''
            wx.request({
            url: API_BASE + '/upload/image_base64',
            method: 'POST',
            header: { 
              'Content-Type': 'application/json',
              'Authorization': token ? 'Bearer ' + token : ''
            },
            data: { data: base64, ext: 'jpg' },
            timeout: UPLOAD_TIMEOUT,
            success: (res) => {
              try {
                if (res.data && res.data.code === 0) {
                  const result = res.data.data
                  // 补全 full_url（服务端只返回相对路径 url）
                  result.full_url = STATIC_BASE + result.url
                  resolve(result)
                } else {
                  reject(new Error((res.data && res.data.msg) || '上传失败'))
                }
              } catch (e) { reject(new Error('解析响应失败')) }
            },
            fail: (err) => reject(new Error(err.errMsg || '上传失败'))
          })
        },
        fail: (err) => reject(new Error(err.errMsg || '读取文件失败'))
      })
    }).catch((err) => reject(new Error(err.message || '压缩失败')))
  })
}

/**
 * 将相对路径转换为完整静态文件 URL（用于 image 组件显示）
 * 当路径已是完整 URL 或本地临时文件时原样返回
 */
function toAbsoluteUrl(path) {
  if (!path) return ''
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('wxfile://') || path.startsWith('cloud://')) {
    return path
  }
  // 避免 STATIC_BASE 末尾和 path 开头都有 / 导致双斜杠
  if (path.startsWith('/') && STATIC_BASE.endsWith('/')) {
    path = path.substring(1)
  }
  return STATIC_BASE + path
}

// ============================================================
// 本地内存缓存（作为 API 数据的本地镜像，减少请求次数）
// ============================================================

const _cache = {}
const CACHE_PREFIX = 'dln_api_'
const CACHE_VERSION = 2  // 递增此值可在数据结构变更时强制刷新缓存

function _checkCacheVersion() {
  try {
    const ver = wx.getStorageSync('dln_cache_version')
    if (ver !== CACHE_VERSION) {
      // 版本不匹配，清空所有 API 缓存
      const info = wx.getStorageInfoSync()
      for (const key of (info.keys || [])) {
        if (key.startsWith(CACHE_PREFIX)) {
          wx.removeStorageSync(key)
        }
      }
      wx.setStorageSync('dln_cache_version', CACHE_VERSION)
    }
  } catch (e) { /* ignore */ }
}
_checkCacheVersion()

function _cacheGet(key) {
  try {
    const raw = wx.getStorageSync(CACHE_PREFIX + key)
    return raw ? JSON.parse(raw) : null
  } catch (e) { return null }
}

function _cacheSet(key, data) {
  try {
    wx.setStorageSync(CACHE_PREFIX + key, JSON.stringify(data))
  } catch (e) { /* ignore */ }
}

// ============================================================
// 核心存储引擎（API 版本）
// ============================================================

/**
 * 从 API 读取整张表（带缓存）
 */
/**
 * 数据获取策略：getAsync 调用时优先从 API 拉取最新数据，失败时回退缓存
 * forceRefresh 参数控制是否跳过缓存强制刷新（默认 true，每次获取最新数据）
 */
async function _readTable(tableName, forceRefresh = true, extraParams = {}) {
  // 缓存作为兜底
  const cached = _cacheGet(tableName)

  if (!forceRefresh) {
    // 非强制刷新：有缓存直接返回（用于 get 同步调用等场景）
    if (cached && cached.length > 0) return cached
  }

  try {
    let rows = []
    switch (tableName) {
      case TABLES.DISTRICTS:
        rows = await _get('/districts')
        break
      case TABLES.ACTIVITIES:
        rows = await _get('/activities', { size: 9999 })
        break
      case TABLES.ACTIVITY_TAGS:
        // 确保主表已缓存后才处理关联，关联表不单独请求 API
        await _readTable(TABLES.ACTIVITIES, true)
        rows = _cacheGet('activity_tags') || []
        break
      case TABLES.ACTIVITY_IMAGES:
        await _readTable(TABLES.ACTIVITIES, true)
        rows = _cacheGet('activity_images') || []
        break
      case TABLES.CHECKIN_POINTS:
        rows = await _get('/checkin/points', { size: 9999, ...extraParams })
        break
      case TABLES.LIVE_POSTS:
        rows = await _get('/live/posts', { size: 9999 })
        break
      case TABLES.LIVE_POST_IMAGES:
        await _readTable(TABLES.LIVE_POSTS, true)
        rows = _cacheGet('live_post_images') || []
        break
      case TABLES.COMMUNITY_POSTS:
        rows = await _get('/community/posts', { size: 9999 })
        break
      case TABLES.COMMUNITY_TAGS:
        await _readTable(TABLES.COMMUNITY_POSTS, true)
        rows = _cacheGet('community_tags') || []
        break
      case TABLES.CHECKIN_PHOTOS:
        rows = await _get('/photos/checkin')
        break
      case TABLES.HOMEPAGE_PHOTOS:
        rows = await _get('/photos/homepage', { limit: 20 })
        break
      case TABLES.LOCAL_LIFE_CATEGORIES:
        rows = await _get('/locallife/categories')
        break
      case TABLES.LOCAL_LIFE_ITEMS:
        rows = await _get('/locallife/items', { size: 9999 })
        break
      case TABLES.SCENIC_SPOTS:
        rows = await _get('/scenic-spots', { size: 9999 })
        break
      case TABLES.USERS:
        rows = _cacheGet('users') || []
        break
      case TABLES.USER_BOOKINGS:
        rows = _cacheGet('user_bookings') || []
        break
      case TABLES.USER_CHECKINS:
        rows = _cacheGet('user_checkins') || []
        break
      case TABLES.USER_FAVORITES:
        rows = _cacheGet('user_favorites') || []
        break
      case TABLES.USER_LIKES:
        rows = _cacheGet('user_likes') || []
        break
      case TABLES.SEARCH_HISTORY:
        rows = _cacheGet('search_history') || []
        break
      case TABLES.APP_CONFIG:
        rows = _cacheGet('app_config') || []
        break
      default:
        rows = []
    }
    // 兼容服务端分页格式 { list, total, page, size } → 提取 list 数组
    if (rows && Array.isArray(rows.list)) {
      rows = rows.list
    }

    // 数据归一化 + 缓存
    if (rows.length > 0) {
      if (tableName === TABLES.LIVE_POSTS) {
        rows = rows.map(p => {
          const copy = { ...p }
          if (copy.point_id === undefined) { copy.point_id = '' }
          if (copy.point_name === undefined) { copy.point_name = '' }
          if (copy.activity_id === undefined) { copy.activity_id = '' }
          if (copy.activity_name === undefined) { copy.activity_name = '' }
          if (copy.latitude === undefined) { copy.latitude = null }
          if (copy.longitude === undefined) { copy.longitude = null }
          return copy
        })
      }
      if (tableName === TABLES.ACTIVITIES) {
        rows = rows.map(a => {
          const copy = { ...a }
          if (copy.tags === undefined || copy.tags === null) { copy.tags = [] }
          if (copy.images === undefined || copy.images === null) { copy.images = [] }
          return copy
        })
      }
      _cacheSet(tableName, rows)
    } else {
      // API 返回空数组时回退缓存（不更新空数据到缓存）
      rows = cached || []
    }
    // 主表加载后，提取关联数据写入二级缓存
    if (rows.length > 0 && (tableName === TABLES.ACTIVITIES || tableName === TABLES.LIVE_POSTS || tableName === TABLES.COMMUNITY_POSTS)) {
      _processRelatedData()
    }
    return rows
  } catch (e) {
    // API 请求失败，回退缓存
    return cached || []
  }
}

/**
 * 写入整张表到缓存（并同步 API）
 */
function _writeTable(tableName, rows) {
  _cacheSet(tableName, rows)
}

// ============================================================
// 查询构造器（类 SQL 链式查询 - 在内存中操作）
// ============================================================

class Query {
  constructor(tableName) {
    this._table = tableName
    this._conditions = []
    this._orders = []
    this._limitVal = null
    this._offsetVal = 0
  }

  where(field, value) {
    if (typeof field === 'function') {
      this._conditions.push(field)
    } else if (value !== undefined) {
      const strVal = String(value)
      this._conditions.push(row => String(row[field]) === strVal)
    }
    return this
  }

  like(field, keyword) {
    if (keyword) {
      const kw = keyword.toLowerCase()
      this._conditions.push(row => {
        const val = row[field]
        return val && String(val).toLowerCase().includes(kw)
      })
    }
    return this
  }

  inWhere(field, values) {
    if (values && values.length > 0) {
      this._conditions.push(row => values.includes(row[field]))
    }
    return this
  }

  dateBetween(field, start, end) {
    if (start && end) {
      this._conditions.push(row => row[field] >= start && row[field] <= end)
    } else if (start) {
      this._conditions.push(row => row[field] >= start)
    } else if (end) {
      this._conditions.push(row => row[field] <= end)
    }
    return this
  }

  orderBy(field, direction = 'asc') {
    this._orders.push({ field, direction })
    return this
  }

  limit(n) {
    this._limitVal = n
    return this
  }

  offset(n) {
    this._offsetVal = n
    return this
  }

  /**
   * 执行查询（同步版本，从缓存读取）
   */
  get() {
    // 从缓存同步读取（页面初始化时已预加载）
    const cacheKey = CACHE_PREFIX + this._table
    let rows = []
    try {
      const raw = wx.getStorageSync(cacheKey)
      rows = raw ? JSON.parse(raw) : []
    } catch (e) { rows = [] }

    // 应用条件
    for (const cond of this._conditions) {
      rows = rows.filter(cond)
    }

    // 应用排序
    if (this._orders.length > 0) {
      rows.sort((a, b) => {
        for (const { field, direction } of this._orders) {
          const va = a[field] ?? 0
          const vb = b[field] ?? 0
          if (va < vb) return direction === 'asc' ? -1 : 1
          if (va > vb) return direction === 'asc' ? 1 : -1
        }
        return 0
      })
    }

    // 应用分页
    if (this._offsetVal > 0) {
      rows = rows.slice(this._offsetVal)
    }
    if (this._limitVal !== null) {
      rows = rows.slice(0, this._limitVal)
    }

    return rows
  }

  /**
   * 异步执行查询（从 API 获取），支持传递额外查询参数
   */
  async getAsync(params = {}) {
    await _readTable(this._table, true, params)
    return this.get()
  }

  first() {
    const results = this.limit(1).get()
    return results.length > 0 ? results[0] : null
  }

  count() {
    return this.get().length
  }
}

// ============================================================
// CRUD 操作
// ============================================================

function table(name) {
  return new Query(name)
}

function getById(tableName, id) {
  return table(tableName).where('id', id).first()
}

function insert(tableName, row) {
  const rows = _readTableSync(tableName)
  if (!row.id) {
    row.id = _genId()
  }
  row.created_at = row.created_at || formatNow()
  row.updated_at = formatNow()
  rows.push(row)
  _writeTable(tableName, rows)
  return row
}

function insertBatch(tableName, newRows) {
  const rows = _readTableSync(tableName)
  const existingIds = new Set(rows.map(r => r.id))
  const toAdd = newRows.filter(r => !existingIds.has(r.id))
  if (toAdd.length === 0) return 0
  const now = formatNow()
  for (const row of toAdd) {
    row.created_at = row.created_at || now
    row.updated_at = now
  }
  _writeTable(tableName, [...rows, ...toAdd])
  return toAdd.length
}

function update(tableName, id, updates) {
  const rows = _readTableSync(tableName)
  const idx = rows.findIndex(r => r.id === id)
  if (idx === -1) return null
  updates.updated_at = formatNow()
  rows[idx] = { ...rows[idx], ...updates }
  _writeTable(tableName, rows)
  return rows[idx]
}

function remove(tableName, id) {
  const rows = _readTableSync(tableName)
  const filtered = rows.filter(r => r.id !== id)
  if (filtered.length === rows.length) return false
  _writeTable(tableName, filtered)
  return true
}

function removeWhere(tableName, predicate) {
  const rows = _readTableSync(tableName)
  const filtered = rows.filter(r => !predicate(r))
  const deleted = rows.length - filtered.length
  if (deleted > 0) _writeTable(tableName, filtered)
  return deleted
}

function upsert(tableName, row, idField = 'id') {
  const rows = _readTableSync(tableName)
  const idx = rows.findIndex(r => r[idField] === row[idField])
  const now = formatNow()
  if (idx >= 0) {
    row.updated_at = now
    rows[idx] = { ...rows[idx], ...row }
  } else {
    row.created_at = row.created_at || now
    row.updated_at = now
    rows.push(row)
  }
  _writeTable(tableName, rows)
  return row
}

// ============================================================
// 数据库初始化（从 API 预加载数据到本地缓存）
// ============================================================

let _initialized = false

let _initPromise = null

async function initDatabase() {
  if (_initialized) return
  // 防止重复初始化
  if (_initPromise) return _initPromise

  _initialized = true
  _initPromise = Promise.resolve()

  return _initPromise
}

/**
 * 处理活动/发文等的关联标签和图片数据
 */
function _processRelatedData() {
  try {
    // 处理活动关联数据
    const activities = _readTableSync(TABLES.ACTIVITIES)
    if (activities.length > 0) {
      const allTags = []
      const allImages = []
      for (const act of activities) {
        if (act.tags) {
          for (const tag of act.tags) {
            allTags.push({ activity_id: act.id, tag })
          }
        }
        if (act.images) {
          act.images.forEach((url, idx) => {
            allImages.push({ activity_id: act.id, image_url: url, sort_order: idx, is_cover: idx === 0 ? 1 : 0 })
          })
        }
      }
      _writeTable(TABLES.ACTIVITY_TAGS, allTags)
      _writeTable(TABLES.ACTIVITY_IMAGES, allImages)
    }

    // 处理现场发文关联图片
    const livePosts = _readTableSync(TABLES.LIVE_POSTS)
    if (livePosts.length > 0) {
      const lpImages = []
      for (const post of livePosts) {
        if (post.images) {
          post.images.forEach((url, idx) => {
            lpImages.push({ post_id: post.id, image_url: url, sort_order: idx })
          })
        }
      }
      _writeTable(TABLES.LIVE_POST_IMAGES, lpImages)
    }

    // 处理社区帖标签
    const communityPosts = _readTableSync(TABLES.COMMUNITY_POSTS)
    if (communityPosts.length > 0) {
      const commTags = []
      for (const post of communityPosts) {
        if (post.tags) {
          for (const tag of post.tags) {
            commTags.push({ post_id: post.id, tag })
          }
        }
      }
      _writeTable(TABLES.COMMUNITY_TAGS, commTags)
    }
  } catch (e) {
    // ignore
  }
}

function resetDatabase() {
  const allKeys = Object.values(TABLES)
  for (const tableName of allKeys) {
    try {
      wx.removeStorageSync(CACHE_PREFIX + tableName)
    } catch (e) { /* ignore */ }
  }
  _initialized = false
}

// ============================================================
// 用户相关操作
// ============================================================

function getCurrentUser() {
  // 优先从全局数据获取（微信登录后的真实用户数据）
  try {
    const app = getApp()
    if (app && app.globalData && app.globalData.isLoggedIn && app.globalData._userId) {
      const gu = app.globalData.userInfo || {}
      return {
        id: app.globalData._userId,
        openid: gu.openid || '',
        nickname: gu.nickname || wx.getStorageSync('userNickname') || '旅行者·大理',
        avatar: gu.avatar || wx.getStorageSync('userAvatar') || '',
        phone: gu.phone || wx.getStorageSync('userPhone') || '',
        is_logged_in: 1
      }
    }
  } catch (e) { /* ignore */ }

  let user = table(TABLES.USERS).where('is_logged_in', 1).first()
  if (!user) {
    const nickname = wx.getStorageSync('userNickname') || '旅行者·大理'
    const avatar = wx.getStorageSync('userAvatar') || ''
    const phone = wx.getStorageSync('userPhone') || ''
    user = insert(TABLES.USERS, {
      id: _genId('u_'),
      nickname,
      avatar,
      phone,
      is_logged_in: 1
    })
    // 延迟异步同步到服务端，避免与框架初始化冲突
    setTimeout(() => {
      _post('/user/login', {
        openid: user.id,
        nickname,
        avatar
      }).catch(() => {})
    }, 1000)
  }
  return user
}

function updateCurrentUser(updates) {
  const user = getCurrentUser()
  if (!user) return null
  const result = update(TABLES.USERS, user.id, updates)
  // 异步同步到服务端
  _put(`/user/${user.id}`, updates).catch(() => {})
  return result
}

// ============================================================
// 用户行为记录
// ============================================================

function addFavorite(userId, itemType, itemId) {
  const exists = table(TABLES.USER_FAVORITES)
    .where('user_id', userId)
    .where('item_type', itemType)
    .where('item_id', itemId)
    .first()
  if (exists) return exists
  const result = insert(TABLES.USER_FAVORITES, { user_id: userId, item_type: itemType, item_id: itemId })
  _post(`/user/${userId}/favorites`, { item_type: itemType, item_id: itemId }).catch(() => {})
  return result
}

function removeFavorite(userId, itemType, itemId) {
  const deleted = removeWhere(TABLES.USER_FAVORITES, r =>
    r.user_id === userId && r.item_type === itemType && r.item_id === itemId
  ) > 0
  _delete(`/user/${userId}/favorites`, { item_type: itemType, item_id: itemId }).catch(() => {})
  return deleted
}

function isFavorited(userId, itemType, itemId) {
  return table(TABLES.USER_FAVORITES)
    .where('user_id', userId)
    .where('item_type', itemType)
    .where('item_id', itemId)
    .count() > 0
}

function getUserFavorites(userId, itemType) {
  let q = table(TABLES.USER_FAVORITES).where('user_id', userId)
  if (itemType) q = q.where('item_type', itemType)
  return q.orderBy('created_at', 'desc').get()
}

function addLike(userId, itemType, itemId) {
  const exists = table(TABLES.USER_LIKES)
    .where('user_id', userId)
    .where('item_type', itemType)
    .where('item_id', itemId)
    .first()
  if (exists) return exists
  const result = insert(TABLES.USER_LIKES, { user_id: userId, item_type: itemType, item_id: itemId })
  _post(`/user/${userId}/likes`, { item_type: itemType, item_id: itemId }).catch(() => {})
  return result
}

function removeLike(userId, itemType, itemId) {
  const deleted = removeWhere(TABLES.USER_LIKES, r =>
    r.user_id === userId && r.item_type === itemType && r.item_id === itemId
  ) > 0
  _delete(`/user/${userId}/likes`, { item_type: itemType, item_id: itemId }).catch(() => {})
  return deleted
}

function isLiked(userId, itemType, itemId) {
  return table(TABLES.USER_LIKES)
    .where('user_id', userId)
    .where('item_type', itemType)
    .where('item_id', itemId)
    .count() > 0
}

function addSearchHistory(userId, keyword) {
  if (!keyword || !keyword.trim()) return
  removeWhere(TABLES.SEARCH_HISTORY, r => r.user_id === userId && r.keyword === keyword)
  const result = insert(TABLES.SEARCH_HISTORY, { user_id: userId, keyword: keyword.trim() })
  _post('/search/history', { user_id: userId, keyword: keyword.trim() }).catch(() => {})
  return result
}

function getSearchHistory(userId, limit = 20) {
  return table(TABLES.SEARCH_HISTORY)
    .where('user_id', userId)
    .orderBy('created_at', 'desc')
    .limit(limit)
    .get()
}

function clearSearchHistory(userId) {
  const deleted = removeWhere(TABLES.SEARCH_HISTORY, r => r.user_id === userId)
  _delete(`/search/history/${userId}`).catch(() => {})
  return deleted
}

// ============================================================
// 数据统计
// ============================================================

function getUserStats(userId) {
  const bookingCount = table(TABLES.USER_BOOKINGS).where('user_id', userId).count()
  const favoriteCount = table(TABLES.USER_FAVORITES).where('user_id', userId).count()
  const postCount = table(TABLES.LIVE_POSTS).where('user_id', userId).count()

  return {
    activityCount: bookingCount,
    postCount,
    favCount: favoriteCount
  }
}

/**
 * 获取当前用户的所有现场发文
 */
function getUserPosts(userId, includeHidden = true) {
  let q = table(TABLES.LIVE_POSTS).where('user_id', userId).orderBy('post_date', 'desc').orderBy('post_time', 'desc')
  const posts = q.get()
  // 附带图片（转为完整URL，确保小程序 image 组件可展示）
  for (const post of posts) {
    post.images = table(TABLES.LIVE_POST_IMAGES)
      .where('post_id', post.id).orderBy('sort_order', 'asc').get().map(img => toAbsoluteUrl(img.image_url))
    // 头像和封面 URL 转为完整路径，临时路径回退到默认头像
    post.user_avatar = post.user_avatar && !post.user_avatar.startsWith('wxfile://') && !post.user_avatar.startsWith('http://tmp/')
      ? toAbsoluteUrl(post.user_avatar)
      : '/images/avatar-default.png'
    post.cover = toAbsoluteUrl(post.cover)
    if (post.post_date || post.post_time) {
      post.time = (post.post_date || '') + ' ' + (post.post_time || '')
    }
  }
  if (!includeHidden) {
    return posts.filter(p => !p.is_hidden)
  }
  return posts
}

// ============================================================
// 工具函数
// ============================================================

function _readTableSync(tableName) {
  const cacheKey = CACHE_PREFIX + tableName
  try {
    const raw = wx.getStorageSync(cacheKey)
    return raw ? JSON.parse(raw) : []
  } catch (e) { return [] }
}

function _genId(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2, 6)
}

function formatNow() {
  const d = new Date()
  const pad = n => n < 10 ? '0' + n : n
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ============================================================
// 导出（接口与旧版完全一致）
// ============================================================

module.exports = {
  TABLES,

  initDatabase,
  resetDatabase,

  table,
  getById,
  Query,

  insert,
  insertBatch,
  update,
  remove,
  removeWhere,
  upsert,

  uploadImage,
  toAbsoluteUrl,
  STATIC_BASE,

  getCurrentUser,
  updateCurrentUser,

  addFavorite,
  removeFavorite,
  isFavorited,
  getUserFavorites,
  addLike,
  removeLike,
  isLiked,
  addSearchHistory,
  getSearchHistory,
  clearSearchHistory,

  getUserStats,
  getUserPosts
}
