<template>
  <div class="page-card">
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <el-input v-model="keyword" placeholder="搜索用户名/内容/地点" clearable style="width:260px;" @clear="search" @keyup.enter="search"><template #prefix><el-icon><Search /></el-icon></template></el-input>
      <el-select v-model="hiddenFilter" placeholder="显示状态" clearable style="width:140px;" @change="search">
        <el-option label="正常显示" :value="0" /><el-option label="已隐藏" :value="1" />
      </el-select>
    </div>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column prop="user_name" label="用户" width="100" />
      <el-table-column label="内容" min-width="180" show-overflow-tooltip>
        <template #default="{row}">{{ row.content || '(无文字)' }}</template>
      </el-table-column>
      <el-table-column prop="activity_name" label="关联活动" width="130" show-overflow-tooltip />
      <el-table-column prop="location" label="地点" width="120" show-overflow-tooltip />
      <el-table-column prop="post_date" label="日期" width="110" />
      <el-table-column label="点赞" width="70"><template #default="{row}">❤️ {{ row.like_count }}</template></el-table-column>
      <el-table-column label="隐藏" width="70">
        <template #default="{row}"><el-tag :type="row.is_hidden ? 'danger' : 'success'" size="small">{{ row.is_hidden ? '是' : '否' }}</el-tag></template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{row}">
          <el-popconfirm title="确定删除该发文？" @confirm="handleDelete(row)">
            <template #reference><el-button link type="danger" size="small">删除</el-button></template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top:16px;justify-content:flex-end;" v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="loadData" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessage } from 'element-plus'
const list = ref([]), loading = ref(false), page = ref(1), size = ref(20), total = ref(0)
const keyword = ref(''), hiddenFilter = ref('')
function loadData() {
  loading.value = true
  api.getLivePosts({ page: page.value, size: size.value, keyword: keyword.value, is_hidden: hiddenFilter.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total }).finally(() => loading.value = false)
}
function search() { page.value = 1; loadData() }
function handleDelete(row) { api.deleteLivePost(row.id).then(() => { ElMessage.success('已删除'); loadData() }) }
onMounted(loadData)
</script>
