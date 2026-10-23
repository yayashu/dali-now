import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/login', name: 'Login', component: () => import('@/views/Login.vue'), meta: { noAuth: true } },
  {
    path: '/',
    component: () => import('@/views/Layout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '数据看板' } },
      { path: 'activities', name: 'Activities', component: () => import('@/views/Activities.vue'), meta: { title: '活动管理' } },
      { path: 'activity-types', name: 'ActivityTypes', component: () => import('@/views/ActivityTypes.vue'), meta: { title: '活动类型' } },
      { path: 'activities/edit/:id?', name: 'ActivityEdit', component: () => import('@/views/ActivityEdit.vue'), meta: { title: '活动编辑' } },
      { path: 'scenic-spots', name: 'ScenicSpots', component: () => import('@/views/ScenicSpots.vue'), meta: { title: '景区管理' } },
      { path: 'scenic-spots/edit/:id?', name: 'ScenicSpotEdit', component: () => import('@/views/ScenicSpotEdit.vue'), meta: { title: '景区编辑' } },
      { path: 'checkin-points', name: 'CheckinPoints', component: () => import('@/views/CheckinPoints.vue'), meta: { title: '打卡点管理' } },
      { path: 'checkin-points/edit/:id?', name: 'CheckinPointEdit', component: () => import('@/views/CheckinPointEdit.vue'), meta: { title: '打卡点编辑' } },
      { path: 'live-posts', name: 'LivePosts', component: () => import('@/views/LivePosts.vue'), meta: { title: '现场发文' } },
      { path: 'community-posts', name: 'CommunityPosts', component: () => import('@/views/CommunityPosts.vue'), meta: { title: '社区攻略' } },
      { path: 'community-posts/edit/:id?', name: 'CommunityPostEdit', component: () => import('@/views/CommunityPostEdit.vue'), meta: { title: '攻略编辑' } },
      { path: 'homepage-photos', name: 'HomepagePhotos', component: () => import('@/views/HomepagePhotos.vue'), meta: { title: '首页照片' } },
      { path: 'local-life', name: 'LocalLife', component: () => import('@/views/LocalLife.vue'), meta: { title: '本地生活' } },
      { path: 'districts', name: 'Districts', component: () => import('@/views/Districts.vue'), meta: { title: '区域管理' } },
      { path: 'users', name: 'Users', component: () => import('@/views/Users.vue'), meta: { title: '用户管理' } },
      { path: 'bookings', name: 'Bookings', component: () => import('@/views/Bookings.vue'), meta: { title: '预约管理' } },
      { path: 'sensitive-words', name: 'SensitiveWords', component: () => import('@/views/SensitiveWords.vue'), meta: { title: '敏感词管理' } },
      { path: 'config', name: 'Config', component: () => import('@/views/Config.vue'), meta: { title: '系统配置' } }
    ]
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')
  if (!to.meta.noAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/dashboard')
  } else {
    next()
  }
})

export default router
