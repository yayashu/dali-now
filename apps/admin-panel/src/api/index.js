import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const http = axios.create({
  baseURL: '/api/admin',
  timeout: 15000
})

// 请求拦截 - 自动带 token
http.interceptors.request.use(config => {
  const token = localStorage.getItem('admin_token')
  if (token) config.headers['X-Admin-Token'] = token
  return config
})

// 响应拦截 - 统一处理错误
http.interceptors.response.use(
  res => {
    const d = res.data
    if (d.code !== 0 && d.code !== undefined) {
      ElMessage.error(d.msg || '请求失败')
      return Promise.reject(d)
    }
    return d
  },
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      router.push('/login')
      ElMessage.error('登录已过期，请重新登录')
    } else {
      ElMessage.error('网络异常，请稍后重试')
    }
    return Promise.reject(err)
  }
)

export default http

// ========== API 接口 ==========
export const api = {
  // 认证
  login: (data) => http.post('/login', data),
  check: () => http.get('/check'),
  logout: () => http.post('/logout'),

  // Dashboard
  dashboard: () => http.get('/dashboard'),

  // 活动
  getActivities: (params) => http.get('/activities', { params }),
  getActivity: (id) => http.get(`/activities/${id}`),
  createActivity: (data) => http.post('/activities', data),
  updateActivity: (id, data) => http.put(`/activities/${id}`, data),
  deleteActivity: (id) => http.delete(`/activities/${id}`),
  approveActivity: (id, reviewStatus) => http.put(`/activities/${id}/approve`, { review_status: reviewStatus }),
  publishActivity: (id, publishStatus) => http.put(`/activities/${id}/publish`, { publish_status: publishStatus }),
  downloadActivityTemplate: () => http.get('/activities/template', { responseType: 'blob' }),
  importActivities: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/activities/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  // 活动类型字典
  getActivityTypes: () => http.get('/activity-types'),
  createActivityType: (data) => http.post('/activity-types', data),
  updateActivityType: (id, data) => http.put(`/activity-types/${id}`, data),
  deleteActivityType: (id) => http.delete(`/activity-types/${id}`),

  // 打卡点
  getCheckinPoints: (params) => http.get('/checkin-points', { params }),
  getCheckinPoint: (id) => http.get(`/checkin-points/${id}`),
  createCheckinPoint: (data) => http.post('/checkin-points', data),
  updateCheckinPoint: (id, data) => http.put(`/checkin-points/${id}`, data),
  deleteCheckinPoint: (id) => http.delete(`/checkin-points/${id}`),
  approveCheckinPoint: (id, reviewStatus) => http.put(`/checkin-points/${id}/approve`, { review_status: reviewStatus }),
  publishCheckinPoint: (id, publishStatus) => http.put(`/checkin-points/${id}/publish`, { publish_status: publishStatus }),
  downloadCheckinPointTemplate: () => http.get('/checkin-points/template', { responseType: 'blob' }),
  importCheckinPoints: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/checkin-points/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  // 景区管理
  getScenicSpots: (params) => http.get('/scenic-spots', { params }),
  getScenicSpot: (id) => http.get(`/scenic-spots/${id}`),
  searchScenicSpots: (keyword) => http.get('/scenic-spots/search', { params: { keyword, limit: 50 } }),
  createScenicSpot: (data) => http.post('/scenic-spots', data),
  updateScenicSpot: (id, data) => http.put(`/scenic-spots/${id}`, data),
  deleteScenicSpot: (id) => http.delete(`/scenic-spots/${id}`),
  downloadScenicSpotTemplate: () => http.get('/scenic-spots/template', { responseType: 'blob' }),
  importScenicSpots: (file) => {
    const fd = new FormData()
    fd.append('file', file)
    return http.post('/scenic-spots/import', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },

  // 现场发文
  getLivePosts: (params) => http.get('/live-posts', { params }),
  deleteLivePost: (id) => http.delete(`/live-posts/${id}`),

  // 社区攻略
  getCommunityPosts: (params) => http.get('/community-posts', { params }),
  getCommunityPost: (id) => http.get(`/community-posts/${id}`),
  createCommunityPost: (data) => http.post('/community-posts', data),
  updateCommunityPost: (id, data) => http.put(`/community-posts/${id}`, data),
  deleteCommunityPost: (id) => http.delete(`/community-posts/${id}`),

  // 首页照片
  getHomepagePhotos: (params) => http.get('/homepage-photos', { params }),
  createHomepagePhoto: (data) => http.post('/homepage-photos', data),
  updateHomepagePhoto: (id, data) => http.put(`/homepage-photos/${id}`, data),
  deleteHomepagePhoto: (id) => http.delete(`/homepage-photos/${id}`),

  // 本地生活
  getLocalLifeItems: (params) => http.get('/locallife-items', { params }),
  createLocalLifeItem: (data) => http.post('/locallife-items', data),
  updateLocalLifeItem: (id, data) => http.put(`/locallife-items/${id}`, data),
  deleteLocalLifeItem: (id) => http.delete(`/locallife-items/${id}`),

  // 区域
  getDistricts: () => http.get('/districts'),
  createDistrict: (data) => http.post('/districts', data),
  updateDistrict: (id, data) => http.put(`/districts/${id}`, data),
  deleteDistrict: (id) => http.delete(`/districts/${id}`),

  // 用户
  getUsers: (params) => http.get('/users', { params }),
  deleteUser: (id) => http.delete(`/users/${id}`),
  banUser: (id, data) => http.put(`/users/${id}/ban`, data),
  unbanUser: (id) => http.put(`/users/${id}/unban`),

  // 预约
  getBookings: (params) => http.get('/bookings', { params }),

  // 敏感词（使用主应用 api）
  getSensitiveWords: () => axios.get('/api/sensitive/words').then(r => r.data),
  addSensitiveWord: (word) => axios.post('/api/sensitive/words', { word }).then(r => r.data),
  deleteSensitiveWord: (id) => axios.delete(`/api/sensitive/words/${id}`).then(r => r.data),
  reloadSensitive: () => axios.post('/api/sensitive/reload').then(r => r.data),

  // 配置
  getConfigs: () => http.get('/config'),
  setConfig: (data) => http.post('/config', data),
  deleteConfig: (key) => http.delete(`/config/${key}`),

  // 上传 (使用小程序 API /api/upload/image)
  uploadImage: (file) => {
    const formData = new FormData()
    formData.append('file', file)
    return axios.post('/api/upload/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(r => r.data)
  }
}
