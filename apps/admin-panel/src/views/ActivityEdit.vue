<template>
  <div class="page-card">
    <h3 style="margin-bottom:20px;">{{ isEdit ? '编辑活动' : '新增活动' }}</h3>
    <el-form :model="form" ref="formRef" label-width="100px" label-position="top" style="max-width:800px;">
      <el-row :gutter="16">
        <el-col v-if="isEdit" :span="12"><el-form-item label="活动ID"><el-input v-model="form.id" disabled /></el-form-item></el-col>
        <el-col :span="isEdit ? 12 : 24"><el-form-item label="活动名称" required><el-input v-model="form.name" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="类型" required>
          <el-select v-model="form.type" filterable @change="onTypeChange" style="width:100%;">
            <el-option v-for="t in typeList" :key="t.code" :label="t.name" :value="t.code" />
          </el-select>
        </el-form-item></el-col>
        <el-col :span="8"><el-form-item label="类型名称"><el-input v-model="form.type_name" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="状态">
          <el-select v-model="form.status"><el-option label="进行中" value="active" /><el-option label="已结束" value="ended" /><el-option label="已取消" value="cancelled" /></el-select>
        </el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="日期"><el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%;" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="时间"><el-time-picker v-model="form.time" format="HH:mm" value-format="HH:mm" placeholder="选择时间" style="width:100%;" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="时间段"><el-time-picker v-model="timeRange" is-range format="HH:mm" value-format="HH:mm" range-separator="-" start-placeholder="开始" end-placeholder="结束" style="width:100%;" @change="onTimeRangeChange" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="地点"><LocationMapPicker v-model:lat="form.latitude" v-model:lng="form.longitude" v-model:address="form.location" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="区域代码"><el-input v-model="form.district_code" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="价格"><el-input v-model="form.price" type="number" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="价格文本"><el-input v-model="form.price_text" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="免费"><el-switch v-model="form.is_free" :active-value="1" :inactive-value="0" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="热度值"><el-input v-model="form.hot_value" type="number" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="总名额"><el-input v-model="form.capacity" type="number" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="剩余"><el-input v-model="form.remaining" type="number" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="已预约"><el-input v-model="form.booked" type="number" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="封面图"><ImageUploader v-model="form.cover" /></el-form-item>
      <el-form-item label="海报图"><ImageUploader v-model="form.poster" /></el-form-item>
      <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="民俗文化介绍"><el-input v-model="form.culture_intro" type="textarea" :rows="3" /></el-form-item>
      <el-form-item label="主办方"><el-input v-model="form.organizer" /></el-form-item>
      <el-form-item label="交通指南"><el-input v-model="form.traffic" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="注意事项"><el-input v-model="form.notes" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="报名规则"><el-input v-model="form.rules" type="textarea" :rows="2" /></el-form-item>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="活动日期区间"><el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" style="width:100%;" @change="onDateRangeChange" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="持续天数"><el-input v-model="form.duration_days" type="number" :disabled="!!dateRange" /></el-form-item></el-col>
      </el-row>

      <el-form-item label="标签">
        <el-tag v-for="(t,i) in form.tags" :key="i" closable style="margin-right:8px;" @close="form.tags.splice(i,1)">{{ t }}</el-tag>
        <el-input v-if="tagInputVisible" ref="tagInputRef" v-model="tagValue" size="small" style="width:100px;" @keyup.enter="addTag" @blur="addTag" />
        <el-button v-else size="small" @click="showTagInput">+ 添加标签</el-button>
      </el-form-item>

      <el-form-item label="图片">
        <div v-for="(img,i) in form.images" :key="i" style="display:flex;gap:8px;margin-bottom:8px;align-items:center;">
          <ImageUploader :model-value="form.images[i]" @update:model-value="v => form.images[i] = v" />
          <el-button type="danger" :icon="Delete" circle size="small" @click="form.images.splice(i,1)" />
        </div>
        <el-button size="small" @click="form.images.push('')">+ 添加图片</el-button>
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
import { Delete } from '@element-plus/icons-vue'
import ImageUploader from '@/components/ImageUploader.vue'
import LocationMapPicker from '@/components/LocationMapPicker.vue'

const route = useRoute(), router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const formRef = ref(null)
const typeList = ref([])
const dateRange = ref(null)
const timeRange = ref(null)

function onTimeRangeChange(val) {
  if (val && val.length === 2) {
    form.time_range = val.join('-')
  } else {
    form.time_range = ''
  }
}
const form = reactive({
  id: '', name: '', type: '', type_name: '', cover: '', poster: '', date: '', time: '', time_range: '',
  location: '', latitude: null, longitude: null, district_code: '', price: 0, price_text: '免费', is_free: 1, capacity: 0, remaining: 0,
  booked: 0, hot_value: 0, description: '', culture_intro: '', organizer: '',
  traffic: '', notes: '', rules: '', status: 'active', date_range_start: '', date_range_end: '',
  duration_days: 1, tags: [], images: []
})

function onTypeChange(code) {
  const found = typeList.value.find(t => t.code === code)
  form.type_name = found ? found.name : ''
}

function onDateRangeChange(val) {
  if (val && val.length === 2) {
    form.date_range_start = val[0]
    form.date_range_end = val[1]
    const diff = (new Date(val[1]) - new Date(val[0])) / (1000 * 60 * 60 * 24) + 1
    form.duration_days = Math.max(1, Math.round(diff))
  }
}

async function loadTypes() {
  try { const res = await api.getActivityTypes(); typeList.value = res.data.list || [] } catch (e) { /* ignore */ }
}

const tagInputVisible = ref(false), tagValue = ref(''), tagInputRef = ref(null)
function showTagInput() { tagInputVisible.value = true; nextTick(() => tagInputRef.value?.focus()) }
function addTag() {
  const v = tagValue.value.trim()
  if (v) { form.tags.push(v); tagValue.value = '' }
  tagInputVisible.value = false
}

function resetForm() {
  Object.assign(form, {
    id: '', name: '', type: '', type_name: '', cover: '', poster: '', date: '', time: '', time_range: '',
    location: '', latitude: null, longitude: null, district_code: '', price: 0, price_text: '免费', is_free: 1, capacity: 0, remaining: 0,
    booked: 0, hot_value: 0, description: '', culture_intro: '', organizer: '',
    traffic: '', notes: '', rules: '', status: 'active', date_range_start: '', date_range_end: '',
    duration_days: 1, tags: [], images: []
  })
  dateRange.value = null
  timeRange.value = null
}

async function loadEditData() {
  if (isEdit.value) {
    const { data } = await api.getActivity(route.params.id)
    Object.assign(form, data)
    // admin API 返回对象数组 [{id, image_url, ...}]，转为字符串数组
    form.images = Array.isArray(data.images)
      ? data.images.map(img => typeof img === 'string' ? img : (img.image_url || ''))
      : []
    if (form.date_range_start && form.date_range_end) {
      dateRange.value = [form.date_range_start, form.date_range_end]
    }
    if (form.time_range && form.time_range.includes('-')) {
      timeRange.value = form.time_range.split('-')
    }
  } else {
    resetForm()
  }
}

onMounted(loadTypes)

watch(() => route.params.id, async (id) => {
  if (id) {
    await loadEditData()
  } else {
    resetForm()
  }
}, { immediate: true })

async function handleSave() {
  saving.value = true
  try {
    if (isEdit.value) {
      await api.updateActivity(form.id, form)
      ElMessage.success('更新成功')
    } else {
      await api.createActivity(form)
      ElMessage.success('创建成功')
    }
    router.push('/activities')
  } finally { saving.value = false }
}
</script>
