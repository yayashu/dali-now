<template>
  <div class="page-card">
    <div style="margin-bottom:16px;">
      <el-input v-model="keyword" placeholder="搜索昵称/手机号" clearable style="width:260px;" @clear="search" @keyup.enter="search"><template #prefix><el-icon><Search /></el-icon></template></el-input>
    </div>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="头像" width="60">
        <template #default="{row}"><el-avatar :size="36" :src="row.avatar" /></template>
      </el-table-column>
      <el-table-column prop="nickname" label="昵称" min-width="120" />
      <el-table-column prop="phone" label="手机号" width="120" />
      <el-table-column label="账号状态" width="100">
        <template #default="{row}">
          <el-tag :type="statusTag(row.status)" size="small">{{ statusText(row) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="在线" width="60">
        <template #default="{row}"><el-tag :type="row.is_logged_in?'success':'info'" size="small">{{ row.is_logged_in?'在线':'离线' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="活动" width="60"><template #default="{row}">{{ row.booking_count || 0 }}</template></el-table-column>
      <el-table-column label="发文" width="60"><template #default="{row}">{{ row.post_count || 0 }}</template></el-table-column>
      <el-table-column label="收藏" width="60"><template #default="{row}">{{ row.fav_count || 0 }}</template></el-table-column>
      <el-table-column prop="created_at" label="注册时间" width="160" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{row}">
          <template v-if="row.status === 'active'">
            <el-button link type="warning" size="small" @click="openBanDialog(row, 'disabled')">禁用</el-button>
            <el-button link type="warning" size="small" @click="openBanDialog(row, 'muted')">禁闭</el-button>
          </template>
          <template v-else>
            <el-button link type="success" size="small" @click="handleUnban(row)">解封</el-button>
          </template>
          <el-popconfirm title="确定删除该用户？（同时删除关联数据）" @confirm="handleDelete(row)">
            <template #reference><el-button link type="danger" size="small">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top:16px;justify-content:flex-end;" v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="loadData" />

    <!-- 封禁弹窗 -->
    <el-dialog v-model="banVisible" :title="banType==='muted'?'禁闭用户':'禁用用户'" width="420px">
      <el-form label-width="80px">
        <el-form-item label="用户">{{ banUser.nickname }}</el-form-item>
        <el-form-item v-if="banType==='muted'" label="禁闭时长">
          <el-select v-model="banDuration" placeholder="选择时长" style="width:100%">
            <el-option label="1 小时" :value="1" />
            <el-option label="6 小时" :value="6" />
            <el-option label="12 小时" :value="12" />
            <el-option label="24 小时（1天）" :value="24" />
            <el-option label="72 小时（3天）" :value="72" />
            <el-option label="168 小时（7天）" :value="168" />
            <el-option label="永久" :value="0" />
          </el-select>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="banReason" type="textarea" :rows="2" placeholder="选填，告知封禁原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="banVisible = false">取消</el-button>
        <el-button type="primary" @click="handleBan" :loading="banLoading">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
const list = ref([]), loading = ref(false), page = ref(1), size = ref(20), total = ref(0), keyword = ref('')

const banVisible = ref(false), banType = ref('disabled'), banDuration = ref(24), banReason = ref(''), banLoading = ref(false)
const banUser = ref({})

function statusTag(status) {
  const map = { active: 'success', muted: 'warning', disabled: 'danger' }
  return map[status] || 'info'
}
function statusText(row) {
  const status = row.status || 'active'
  if (status === 'muted') {
    const until = row.ban_until ? row.ban_until.slice(0, 16) : '永久'
    return '禁闭至 ' + until
  }
  const map = { active: '正常', muted: '禁闭中', disabled: '已禁用' }
  return map[status] || status
}

function loadData() {
  loading.value = true
  api.getUsers({ page: page.value, size: size.value, keyword: keyword.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total }).finally(() => loading.value = false)
}
function search() { page.value = 1; loadData() }
function handleDelete(row) { api.deleteUser(row.id).then(() => { ElMessage.success('已删除'); loadData() }) }

function openBanDialog(row, type) {
  banUser.value = row
  banType.value = type
  banDuration.value = type === 'muted' ? 24 : 0
  banReason.value = ''
  banVisible.value = true
}

function handleBan() {
  banLoading.value = true
  const data = { type: banType.value, reason: banReason.value }
  if (banType.value === 'muted' && banDuration.value > 0) {
    data.duration_hours = banDuration.value
  }
  api.banUser(banUser.value.id, data)
    .then(() => { ElMessage.success('操作成功'); banVisible.value = false; loadData() })
    .finally(() => banLoading.value = false)
}

function handleUnban(row) {
  const label = row.status === 'disabled' ? '解除禁用' : '解除禁闭'
  ElMessageBox.confirm(`确定${label}"${row.nickname}"吗？`, '确认', { type: 'warning' })
    .then(() => api.unbanUser(row.id).then(() => { ElMessage.success('已解封'); loadData() }))
    .catch(() => {})
}

onMounted(loadData)
</script>
