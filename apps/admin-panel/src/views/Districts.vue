<template>
  <div class="page-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:16px;font-weight:600;">区域管理</span>
      <el-button type="primary" @click="dialogVisible = true; resetForm()"><el-icon><Plus /></el-icon>新增区域</el-button>
    </div>
    <el-table :data="list" stripe>
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="code" label="代码" width="120" />
      <el-table-column prop="name" label="名称" min-width="150" />
      <el-table-column prop="sort_order" label="排序" width="80" />
      <el-table-column label="操作" width="160">
        <template #default="{row}">
          <el-button link type="primary" size="small" @click="editItem(row)">编辑</el-button>
          <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)"><template #reference><el-button link type="danger" size="small">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" :title="isEdit?'编辑区域':'新增区域'" width="400px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="代码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
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
const list = ref([]), dialogVisible = ref(false), saving = ref(false), isEdit = ref(false)
const form = reactive({ id:null, code:'', name:'', sort_order:0, editId:null })
function resetForm() { isEdit.value = false; Object.assign(form, { id:null, code:'', name:'', sort_order:0 }) }
function editItem(p) { isEdit.value = true; Object.assign(form, p); dialogVisible.value = true }
function loadData() { api.getDistricts().then(res => list.value = res.data.list) }
async function handleSave() {
  saving.value = true
  try {
    if (isEdit.value) await api.updateDistrict(form.id, form)
    else await api.createDistrict(form)
    ElMessage.success('保存成功'); dialogVisible.value = false; loadData()
  } finally { saving.value = false }
}
function handleDelete(id) { api.deleteDistrict(id).then(() => { ElMessage.success('已删除'); loadData() }) }
onMounted(loadData)
</script>
