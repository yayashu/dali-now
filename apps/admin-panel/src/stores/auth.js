import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('admin_token') || '')
  const username = ref('')

  async function login(data) {
    const res = await api.login(data)
    const t = res.data?.data?.token || res.data?.token
    token.value = t
    localStorage.setItem('admin_token', t)
    username.value = 'admin'
    return res
  }

  function logout() {
    api.logout().catch(() => {})
    token.value = ''
    username.value = ''
    localStorage.removeItem('admin_token')
  }

  async function check() {
    try {
      await api.check()
      return true
    } catch {
      logout()
      return false
    }
  }

  return { token, username, login, logout, check }
})
