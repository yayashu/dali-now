<template>
  <div class="page-card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <span style="font-size:16px;font-weight:600;">系统配置</span>
      <el-button type="primary" @click="dialogVisible = true; resetForm()"><el-icon><Plus /></el-icon>添加配置</el-button>
    </div>
    <el-table :data="list" stripe>
      <el-table-column prop="key" label="键名" width="200" />
      <el-table-column prop="value" label="值" min-width="300" show-overflow-tooltip />
      <el-table-column prop="updated_at" label="更新时间" width="180" />
      <el-table-column label="操作" width="160">
        <template #default="{row}">
          <el-button link type="primary" size="small" @click="editItem(row)">编辑</el-button>
          <el-popconfirm title="确定删除？" @confirm="handleDelete(row.key)"><template #reference><el-button link type="danger" size="small">删除</el-button></template></el-popconfirm>
        </template>
      </el-table-column>
    </el-table>
    <el-dialog v-model="dialogVisible" title="编辑配置" width="400px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="键名"><el-input v-model="form.key" :disabled="isEdit" /></el-form-item>
        <el-form-item label="值"><el-input v-model="form.value" type="textarea" :rows="3" /></el-form-item>
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
const form = reactive({ key:'', value:'' })
function resetForm() { isEdit.value = false; form.key = ''; form.value = '' }
function editItem(p) { isEdit.value = true; form.key = p.key; form.value = p.value; dialogVisible.value = true }
function loadData() { api.getConfigs().then(res => list.value = res.data.list) }
async function handleSave() {
  saving.value = true
  try { await api.setConfig(form); ElMessage.success('保存成功'); dialogVisible.value = false; loadData() } finally { saving.value = false }
}
function handleDelete(key) { api.deleteConfig(key).then(() => { ElMessage.success('已删除'); loadData() }) }
onMounted(loadData)
</script>
