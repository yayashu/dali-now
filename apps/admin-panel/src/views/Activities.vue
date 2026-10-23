<template>
  <div class="page-card">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
      <el-input v-model="keyword" placeholder="搜索活动名称" clearable style="width:240px;" @clear="search" @keyup.enter="search">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <div style="display:flex;gap:8px;">
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width:120px;" @change="search">
          <el-option label="进行中" value="active" /><el-option label="已结束" value="ended" /><el-option label="已取消" value="cancelled" />
        </el-select>
        <el-select v-model="reviewFilter" placeholder="审核状态" clearable style="width:120px;" @change="search">
          <el-option label="待审核" value="pending" /><el-option label="已通过" value="approved" /><el-option label="已拒绝" value="rejected" />
        </el-select>
        <el-select v-model="publishFilter" placeholder="上下架" clearable style="width:110px;" @change="search">
          <el-option label="上架" value="listed" /><el-option label="下架" value="unlisted" />
        </el-select>
        <el-button @click="showImportDialog = true"><el-icon><Upload /></el-icon>导入Excel</el-button>
        <el-button type="primary" @click="goEdit()"><el-icon><Plus /></el-icon>新增活动</el-button>
      </div>
    </div>

    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="封面" width="70">
        <template #default="{row}">
          <el-image v-if="imgUrl(row.cover)" :src="imgUrl(row.cover)" style="width:40px;height:40px;border-radius:4px;" fit="cover" :preview-src-list="[imgUrl(row.cover)]" />
          <span v-else style="font-size:12px;color:#ccc;">无图</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="160" show-overflow-tooltip />
      <el-table-column prop="type_name" label="类型" width="100" />
      <el-table-column prop="date" label="日期" width="110" />
      <el-table-column prop="district_code" label="区域" width="100" />
      <el-table-column label="状态" width="90">
        <template #default="{row}"><el-tag :type="row.status==='active'?'success':row.status==='ended'?'info':'danger'" size="small">{{ row.status === 'active' ? '进行中' : row.status === 'ended' ? '已结束' : '已取消' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="booked" label="已预约" width="80" />
      <el-table-column prop="hot_value" label="热度" width="70">
        <template #default="{row}">&#x1f525; {{ row.hot_value }}</template>
      </el-table-column>
      <el-table-column label="审核" width="90">
        <template #default="{row}">
          <el-tag :type="row.review_status==='approved'?'success':row.review_status==='pending'?'warning':'danger'" size="small">
            {{ row.review_status === 'approved' ? '已通过' : row.review_status === 'pending' ? '待审核' : '已拒绝' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="上架" width="80">
        <template #default="{row}">
          <el-tag :type="row.publish_status==='listed'?'success':'info'" size="small">
            {{ row.publish_status === 'listed' ? '已上架' : '已下架' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right" align="right">
        <template #default="{row}">
          <el-button link type="primary" size="small" @click="goEdit(row.id)">编辑</el-button>
          <el-button v-if="row.review_status==='pending'" link type="success" size="small" @click="handleApprove(row, 'approved')">通过</el-button>
          <el-button v-if="row.review_status==='pending'" link type="warning" size="small" @click="handleApprove(row, 'rejected')">拒绝</el-button>
          <el-button v-if="row.publish_status==='listed'" link type="warning" size="small" @click="handlePublish(row, 'unlisted')">下架</el-button>
          <el-button v-if="row.publish_status==='unlisted'" link type="success" size="small" @click="handlePublish(row, 'listed')">上架</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-pagination
      style="margin-top:16px;justify-content:flex-end;"
      v-model:current-page="page" v-model:page-size="size"
      :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next"
      @change="loadData"
    />

    <!-- 导入对话框 -->
    <el-dialog v-model="showImportDialog" title="批量导入活动" width="520px" :close-on-click-modal="false">
      <div style="margin-bottom:16px;">
        <el-alert type="info" :closable="false" show-icon style="margin-bottom:12px;">
          <template #title>
            请按照模板格式填写数据后上传。可
            <el-button link type="primary" @click="downloadTemplate" :loading="downloading" style="padding:0 4px;">下载模板</el-button>
            获取标准 Excel 文件。
          </template>
        </el-alert>
      </div>
      <el-steps :active="importStep" finish-status="success" align-center style="margin-bottom:20px;">
        <el-step title="选择文件" />
        <el-step title="确认导入" />
      </el-steps>
      <div v-if="importStep === 0">
        <el-upload
          ref="uploadRef"
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx,.xls"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          :file-list="fileList"
        >
          <el-icon style="font-size:40px;color:#409eff;"><UploadFilled /></el-icon>
          <div style="margin-top:8px;">将 Excel 文件拖到此处，或<em>点击上传</em></div>
          <template #tip><div style="font-size:12px;color:#999;margin-top:8px;">仅支持 .xlsx / .xls 格式文件</div></template>
        </el-upload>
      </div>
      <div v-else style="text-align:center;padding:20px 0;">
        <el-icon style="font-size:48px;color:#67c23a;"><SuccessFilled /></el-icon>
        <p style="margin-top:12px;">已选择文件: <strong>{{ selectedFile?.name }}</strong></p>
        <p style="color:#999;font-size:13px;">点击"开始导入"将立即写入数据库</p>
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button v-if="importStep === 1" @click="importStep = 0">上一步</el-button>
        <el-button v-if="importStep === 0 && selectedFile" type="primary" @click="importStep = 1">下一步</el-button>
        <el-button v-if="importStep === 1" type="primary" @click="doImport" :loading="importing">开始导入</el-button>
      </template>
    </el-dialog>
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
const list = ref([])
const loading = ref(false)
const page = ref(1), size = ref(20), total = ref(0)
const keyword = ref(''), statusFilter = ref(''), reviewFilter = ref(''), publishFilter = ref('')

function loadData() {
  loading.value = true
  api.getActivities({ page: page.value, size: size.value, keyword: keyword.value, status: statusFilter.value, review_status: reviewFilter.value, publish_status: publishFilter.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total })
    .finally(() => loading.value = false)
}
function search() { page.value = 1; loadData() }
function goEdit(id) { router.push(id ? `/activities/edit/${id}` : '/activities/edit') }
function handleDelete(row) {
  ElMessageBox.confirm(`确定删除"${row.name}"？`, '提示', { type: 'warning' }).then(() => {
    api.deleteActivity(row.id).then(() => { ElMessage.success('已删除'); loadData() })
  }).catch(() => {})
}
function handleApprove(row, status) {
  const label = status === 'approved' ? '通过审核' : '拒绝'
  ElMessageBox.confirm(`确定${label}"${row.name}"？`, '审核确认', { type: 'warning' }).then(() => {
    api.approveActivity(row.id, status).then(() => { ElMessage.success(status === 'approved' ? '已通过' : '已拒绝'); loadData() })
  }).catch(() => {})
}
function handlePublish(row, status) {
  const label = status === 'listed' ? '上架' : '下架'
  ElMessageBox.confirm(`确定${label}"${row.name}"？`, '操作确认', { type: 'warning' }).then(() => {
    api.publishActivity(row.id, status).then(() => { ElMessage.success(status === 'listed' ? '已上架' : '已下架'); loadData() })
  }).catch(() => {})
}

// ========== 导入功能 ==========
const showImportDialog = ref(false)
const importStep = ref(0)
const selectedFile = ref(null)
const fileList = ref([])
const importing = ref(false)
const downloading = ref(false)

function handleFileChange(file) {
  selectedFile.value = file.raw
  fileList.value = [file]
}
function handleFileRemove() {
  selectedFile.value = null
  fileList.value = []
  importStep.value = 0
}

async function downloadTemplate() {
  downloading.value = true
  try {
    const res = await api.downloadActivityTemplate()
    const blob = new Blob([res], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'activities_template.xlsx'
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('模板下载成功')
  } catch {
    ElMessage.error('下载模板失败')
  } finally {
    downloading.value = false
  }
}

async function doImport() {
  if (!selectedFile.value) return
  importing.value = true
  try {
    const res = await api.importActivities(selectedFile.value)
    ElMessage.success(res.msg || '导入成功')
    showImportDialog.value = false
    importStep.value = 0
    selectedFile.value = null
    fileList.value = []
    loadData()
  } catch {
    // 错误已在拦截器中统一提示
  } finally {
    importing.value = false
  }
}

onMounted(loadData)
</script>
