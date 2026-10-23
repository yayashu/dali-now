<template>
  <div class="page-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:16px;font-weight:600;">首页照片墙</span>
      <el-button type="primary" @click="dialogVisible = true; resetForm()"><el-icon><Plus /></el-icon>添加照片</el-button>
    </div>
    <el-row :gutter="16">
      <el-col :xs="12" :sm="8" :md="6" v-for="p in list" :key="p.id" style="margin-bottom:16px;">
        <el-card :body-style="{padding:0}">
          <el-image v-if="imgUrl(p.image_url)" :src="imgUrl(p.image_url)" style="width:100%;height:180px;" fit="cover" :preview-src-list="[imgUrl(p.image_url)]">
            <template #error><div style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;color:#999;font-size:12px;">加载失败</div></template>
          </el-image>
          <div v-else style="width:100%;height:180px;display:flex;align-items:center;justify-content:center;background:#f5f5f5;color:#999;font-size:12px;">无图片</div>
          <div style="padding:8px 12px;display:flex;justify-content:space-between;align-items:center;">
            <span style="font-size:12px;color:#999;">序号: {{ p.sort_order }}</span>
            <div>
              <el-button link type="primary" size="small" @click="editItem(p)">编辑</el-button>
              <el-popconfirm title="确定删除？" @confirm="handleDelete(p.id)"><template #reference><el-button link type="danger" size="small">删除</el-button></template></el-popconfirm>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
    <el-pagination style="margin-top:16px;justify-content:flex-end;" v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[8,16,32]" layout="total,sizes,prev,pager,next" @change="loadData" />

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑照片' : '添加照片'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="图片"><ImageUploader v-model="form.image_url" /></el-form-item>
        <el-form-item label="用户名"><el-input v-model="form.user_name" /></el-form-item>
        <el-form-item label="拍摄日期"><el-date-picker v-model="form.shoot_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%;" /></el-form-item>
        <el-form-item label="天气"><el-input v-model="form.weather" /></el-form-item>
        <el-form-item label="温度"><el-input v-model="form.temperature" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort_order" :min="0" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { api } from '@/api'
import { ElMessage } from 'element-plus'
import ImageUploader from '@/components/ImageUploader.vue'

function imgUrl(v) {
  if (!v || typeof v !== 'string') return ''
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const cleaned = v.replace(/^\/+/, '')
  return cleaned ? '/' + cleaned : ''
}
const list = ref([]), loading = ref(false), page = ref(1), size = ref(8), total = ref(0)
const dialogVisible = ref(false), saving = ref(false), isEdit = ref(false)
const form = reactive({ id:'',image_url:'',user_name:'',user_avatar:'',shoot_date:'',weather:'',temperature:'',sort_order:0 })
function resetForm() { isEdit.value = false; Object.assign(form, { id:'',image_url:'',user_name:'',user_avatar:'',shoot_date:'',weather:'',temperature:'',sort_order:0 }) }
function editItem(p) { isEdit.value = true; Object.assign(form, p); dialogVisible.value = true }
function loadData() {
  loading.value = true
  api.getHomepagePhotos({ page: page.value, size: size.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total }).finally(() => loading.value = false)
}
async function handleSave() {
  saving.value = true
  try {
    if (isEdit.value) await api.updateHomepagePhoto(form.id, form)
    else await api.createHomepagePhoto(form)
    ElMessage.success('保存成功')
    dialogVisible.value = false
    loadData()
  } finally { saving.value = false }
}
function handleDelete(id) { api.deleteHomepagePhoto(id).then(() => { ElMessage.success('已删除'); loadData() }) }
onMounted(loadData)
</script>
