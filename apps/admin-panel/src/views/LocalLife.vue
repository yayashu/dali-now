<template>
  <div class="page-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;">
      <div style="display:flex;gap:8px;">
        <el-input v-model="keyword" placeholder="搜索名称" clearable style="width:200px;" @clear="search" @keyup.enter="search"><template #prefix><el-icon><Search /></el-icon></template></el-input>
        <el-select v-model="catFilter" placeholder="分类" clearable style="width:120px;" @change="search">
          <el-option label="美食" value="food" /><el-option label="住宿" value="hotel" /><el-option label="好物" value="shop" />
        </el-select>
      </div>
      <el-button type="primary" @click="dialogVisible = true; resetForm()"><el-icon><Plus /></el-icon>新增项目</el-button>
    </div>
    <el-table :data="list" v-loading="loading" stripe>
      <el-table-column label="封面" width="80">
        <template #default="{row}">
          <el-image v-if="imgUrl(row.cover)" :src="imgUrl(row.cover)" style="width:48px;height:48px;border-radius:4px;" fit="cover" :preview-src-list="[imgUrl(row.cover)]">
            <template #error><span style="font-size:12px;color:#ccc;">无图</span></template>
          </el-image>
          <span v-else style="font-size:12px;color:#ccc;">无图</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="category" label="分类" width="80">
        <template #default="{row}"><el-tag size="small">{{ row.category === 'food' ? '美食' : row.category === 'hotel' ? '住宿' : '好物' }}</el-tag></template>
      </el-table-column>
      <el-table-column prop="rating" label="评分" width="70" />
      <el-table-column prop="price" label="价格" width="80" />
      <el-table-column prop="location" label="地点" width="120" show-overflow-tooltip />
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{row}">
          <el-button link type="primary" size="small" @click="editItem(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-pagination style="margin-top:16px;justify-content:flex-end;" v-model:current-page="page" v-model:page-size="size" :total="total" :page-sizes="[10,20,50]" layout="total,sizes,prev,pager,next" @change="loadData" />

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑项目' : '新增项目'" width="500px">
      <el-form :model="form" label-width="80px">
        <el-form-item v-if="isEdit" label="ID"><el-input v-model="form.id" disabled /></el-form-item>
        <el-form-item label="分类"><el-select v-model="form.category"><el-option label="美食" value="food" /><el-option label="住宿" value="hotel" /><el-option label="好物" value="shop" /></el-select></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="封面图"><ImageUploader v-model="form.cover" /></el-form-item>
        <el-form-item label="类型"><el-input v-model="form.item_type" /></el-form-item>
        <el-form-item label="评分"><el-input-number v-model="form.rating" :min="0" :max="5" :step="0.1" /></el-form-item>
        <el-form-item label="价格"><el-input v-model="form.price" /></el-form-item>
        <el-form-item label="地点"><LocationMapPicker v-model:address="form.location" /></el-form-item>
        <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
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
import { ElMessageBox, ElMessage } from 'element-plus'
import ImageUploader from '@/components/ImageUploader.vue'
import LocationMapPicker from '@/components/LocationMapPicker.vue'

function imgUrl(v) {
  if (!v || typeof v !== 'string') return ''
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const cleaned = v.replace(/^\/+/, '')
  return cleaned ? '/' + cleaned : ''
}
const list = ref([]), loading = ref(false), page = ref(1), size = ref(20), total = ref(0)
const keyword = ref(''), catFilter = ref('')
const dialogVisible = ref(false), saving = ref(false), isEdit = ref(false)
const form = reactive({ id:'',category:'food',name:'',cover:'',item_type:'',rating:0,price:'',location:'',description:'',sort_order:0 })
function resetForm() { isEdit.value = false; Object.assign(form, { id:'',category:'food',name:'',cover:'',item_type:'',rating:0,price:'',location:'',description:'',sort_order:0 }) }
function editItem(p) { isEdit.value = true; Object.assign(form, p); dialogVisible.value = true }
function loadData() {
  loading.value = true
  api.getLocalLifeItems({ page: page.value, size: size.value, keyword: keyword.value, category: catFilter.value })
    .then(res => { list.value = res.data.list; total.value = res.data.total }).finally(() => loading.value = false)
}
function search() { page.value = 1; loadData() }
async function handleSave() {
  saving.value = true
  try {
    isEdit.value ? await api.updateLocalLifeItem(form.id, form) : await api.createLocalLifeItem(form)
    ElMessage.success('保存成功'); dialogVisible.value = false; loadData()
  } finally { saving.value = false }
}
function handleDelete(row) {
  ElMessageBox.confirm(`确定删除"${row.name}"？`, '提示', { type: 'warning' }).then(() => {
    api.deleteLocalLifeItem(row.id).then(() => { ElMessage.success('已删除'); loadData() })
  }).catch(() => {})
}
onMounted(loadData)
</script>
