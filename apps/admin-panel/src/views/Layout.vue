<template>
  <div class="admin-layout">
    <aside class="admin-sidebar">
      <div class="logo">🏔️ 大理此刻</div>
      <el-menu
        :default-active="route.path"
        background-color="transparent"
        text-color="rgba(255,255,255,0.75)"
        active-text-color="#fff"
        router
      >
        <el-menu-item index="/dashboard"><el-icon><DataAnalysis /></el-icon><span>数据看板</span></el-menu-item>
        <el-menu-item index="/activities"><el-icon><Calendar /></el-icon><span>活动管理</span></el-menu-item>
        <el-menu-item index="/activity-types"><el-icon><Collection /></el-icon><span>活动类型</span></el-menu-item>
        <el-menu-item index="/scenic-spots"><el-icon><Sunny /></el-icon><span>景区管理</span></el-menu-item>
        <el-menu-item index="/checkin-points"><el-icon><Location /></el-icon><span>打卡点管理</span></el-menu-item>
        <el-menu-item index="/live-posts"><el-icon><ChatLineRound /></el-icon><span>现场发文</span></el-menu-item>
        <el-menu-item index="/community-posts"><el-icon><Document /></el-icon><span>社区攻略</span></el-menu-item>
        <el-menu-item index="/homepage-photos"><el-icon><Picture /></el-icon><span>首页照片</span></el-menu-item>
        <el-menu-item index="/local-life"><el-icon><Shop /></el-icon><span>本地生活</span></el-menu-item>
        <el-menu-item index="/districts"><el-icon><MapLocation /></el-icon><span>区域管理</span></el-menu-item>
        <el-menu-item index="/users"><el-icon><User /></el-icon><span>用户管理</span></el-menu-item>
        <el-menu-item index="/bookings"><el-icon><Tickets /></el-icon><span>预约管理</span></el-menu-item>
        <el-menu-item index="/sensitive-words"><el-icon><Warning /></el-icon><span>敏感词管理</span></el-menu-item>
        <el-menu-item index="/config"><el-icon><Setting /></el-icon><span>系统配置</span></el-menu-item>
      </el-menu>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar">
        <span style="font-size:16px;font-weight:600;">{{ route.meta.title || '' }}</span>
        <el-dropdown trigger="click">
          <span style="cursor:pointer;display:flex;align-items:center;gap:8px;">
            <el-avatar :size="32" icon="UserFilled" />
            <span>admin</span>
            <el-icon><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="handleLogout"><el-icon><SwitchButton /></el-icon>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </header>
      <main class="admin-content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ElMessageBox } from 'element-plus'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' }).then(() => {
    auth.logout()
    router.push('/login')
  }).catch(() => {})
}
</script>
