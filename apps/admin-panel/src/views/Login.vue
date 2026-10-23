<template>
  <div style="height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a6b4b 0%,#0d4a30 100%);">
    <el-card style="width:380px;border-radius:12px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h2 style="font-size:24px;color:#1a6b4b;">🏔️ 大理此刻</h2>
        <p style="color:#999;margin-top:8px;">后台管理系统</p>
      </div>
      <el-form :model="form" ref="formRef" :rules="rules" @submit.prevent="handleLogin">
        <el-form-item prop="username">
          <el-input v-model="form.username" placeholder="用户名" :prefix-icon="User" size="large" />
        </el-form-item>
        <el-form-item prop="password">
          <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock" size="large" show-password @keyup.enter="handleLogin" />
        </el-form-item>
        <el-button type="primary" size="large" style="width:100%;background:#1a6b4b;border-color:#1a6b4b;" :loading="loading" @click="handleLogin">
          登 录
        </el-button>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { User, Lock } from '@element-plus/icons-vue'

const router = useRouter()
const auth = useAuthStore()
const loading = ref(false)
const formRef = ref(null)
const form = reactive({ username: 'admin', password: '' })
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

async function handleLogin() {
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  loading.value = true
  try {
    await auth.login(form)
    router.push('/dashboard')
  } finally {
    loading.value = false
  }
}
</script>
