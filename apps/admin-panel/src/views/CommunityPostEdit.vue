<template>
  <div class="page-card">
    <h3 style="margin-bottom:20px;">{{ isEdit ? '编辑攻略' : '新增攻略' }}</h3>
    <el-form :model="form" label-width="100px" label-position="top" style="max-width:800px;">
      <el-row :gutter="16">
        <el-col v-if="isEdit" :span="12"><el-form-item label="ID"><el-input v-model="form.id" disabled /></el-form-item></el-col>
        <el-col :span="isEdit ? 12 : 24"><el-form-item label="标题" required><el-input v-model="form.title" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="作者"><el-input v-model="form.user_name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="发布日期"><el-date-picker v-model="form.post_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%;" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="封面图"><ImageUploader v-model="form.cover" /></el-form-item>
      <el-form-item label="内容"><el-input v-model="form.content" type="textarea" :rows="8" /></el-form-item>
      <el-form-item label="标签">
        <el-tag v-for="(t,i) in form.tags" :key="i" closable style="margin-right:8px;" @close="form.tags.splice(i,1)">{{ t }}</el-tag>
        <el-input v-if="tagVisible" ref="tagRef" v-model="tagVal" size="small" style="width:100px;" @keyup.enter="addTag" @blur="addTag" />
        <el-button v-else size="small" @click="showTag">+ 添加标签</el-button>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { ElMessage } from 'element-plus'
import ImageUploader from '@/components/ImageUploader.vue'
const route = useRoute(), router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const initialForm = { id:'',user_name:'管理员',user_avatar:'',title:'',cover:'',content:'',post_date:'2026-06-09',tags:[] }
const form = reactive({ ...initialForm })
const tagVisible = ref(false), tagVal = ref(''), tagRef = ref(null)
function showTag() { tagVisible.value = true; nextTick(() => tagRef.value?.focus()) }
function addTag() { const v = tagVal.value.trim(); if(v) { form.tags.push(v); tagVal.value = '' }; tagVisible.value = false }
async function loadEditData() {
  if (isEdit.value) {
    const { data } = await api.getCommunityPost(route.params.id)
    Object.assign(form, data)
  } else {
    Object.assign(form, JSON.parse(JSON.stringify(initialForm)))
  }
}
onMounted(() => {})
watch(() => route.params.id, () => loadEditData(), { immediate: true })
async function handleSave() {
  saving.value = true
  try {
    isEdit.value ? await api.updateCommunityPost(form.id, form) : await api.createCommunityPost(form)
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    router.push('/community-posts')
  } finally { saving.value = false }
}
</script>
