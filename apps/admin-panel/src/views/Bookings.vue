<template>
  <div class="page-card">
    <h3 style="margin-bottom:16px;">预约管理</h3>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column type="index" width="50" />
      <el-table-column prop="user_nickname" label="用户" width="120" />
      <el-table-column prop="activity_name" label="活动" min-width="160" show-overflow-tooltip />
      <el-table-column prop="name" label="姓名" width="100" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="count" label="人数" width="60" />
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{row}"><el-tag size="small">{{ row.status === 'confirmed' ? '已确认' : row.status === 'completed' ? '已完成' : '待确认' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="created_at" label="预约时间" width="160" />
    </el-table>
    <el-pagination style="margin-top:16px;justify-content:flex-end;" v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="loadData" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { api } from '@/api'
const list = ref([]), loading = ref(false), page = ref(1), size = ref(20), total = ref(0)
function loadData() {
  loading.value = true
  api.getBookings({ page: page.value, size: size.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total }).finally(() => loading.value = false)
}
onMounted(loadData)
</script>
