<template>
  <div class="page-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <el-input v-model="keyword" placeholder="搜索标题/内容" clearable style="width:240px;" @clear="search" @keyup.enter="search"><template #prefix><el-icon><Search /></el-icon></template></el-input>
      <el-button type="primary" @click="goEdit()"><el-icon><Plus /></el-icon>新增攻略</el-button>
    </div>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="封面" width="70">
        <template #default="{row}">
          <el-image v-if="imgUrl(row.cover)" :src="imgUrl(row.cover)" style="width:40px;height:40px;border-radius:4px;" fit="cover" :preview-src-list="[imgUrl(row.cover)]" />
          <span v-else style="font-size:12px;color:#ccc;">无图</span>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="user_name" label="作者" width="100" />
      <el-table-column label="标签" width="160">
        <template #default="{row}"><el-tag v-for="t in row.tags" :key="t" size="small" style="margin-right:4px;">{{ t }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="view_count" label="浏览" width="70" />
      <el-table-column prop="like_count" label="点赞" width="70" />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{row}">
          <el-button link type="primary" size="small" @click="goEdit(row.id)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top:16px;justify-content:flex-end;" v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="loadData" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { api } from '@/api'
import { ElMessageBox, ElMessage } from 'element-plus'

function imgUrl(v) {
  if (!v || typeof v !== 'string') return ''
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const cleaned = v.replace(/^\/+/, '')
  return cleaned ? '/' + cleaned : ''
}
const router = useRouter()
const list = ref([]), loading = ref(false), page = ref(1), size = ref(20), total = ref(0), keyword = ref('')
function loadData() {
  loading.value = true
  api.getCommunityPosts({ page: page.value, size: size.value, keyword: keyword.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total }).finally(() => loading.value = false)
}
function search() { page.value = 1; loadData() }
function goEdit(id) { router.push(id ? `/community-posts/edit/${id}` : '/community-posts/edit') }
function handleDelete(row) {
  ElMessageBox.confirm(`确定删除"${row.title}"？`, '提示', { type: 'warning' }).then(() => {
    api.deleteCommunityPost(row.id).then(() => { ElMessage.success('已删除'); loadData() })
  }).catch(() => {})
}
onMounted(loadData)
</script>
