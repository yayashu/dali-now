<template>
  <div class="page-card">
    <h3 style="margin-bottom:20px;">{{ isEdit ? '编辑打卡点' : '新增打卡点' }}</h3>
    <el-form :model="form" label-width="100px" label-position="top" style="max-width:800px;">
      <el-row :gutter="16">
        <el-col v-if="isEdit" :span="12"><el-form-item label="ID"><el-input v-model="form.id" disabled /></el-form-item></el-col>
        <el-col :span="isEdit ? 12 : 24"><el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="类型"><el-select v-model="form.type"><el-option label="景点固定" value="scenic" /><el-option label="活动专属" value="activity" /></el-select></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="关联活动"><el-select v-model="form.activity_id" clearable filterable remote reserve-keyword :remote-method="searchActivities" :loading="activitiesLoading" placeholder="输入关键词搜索活动"><el-option v-for="a in activities" :key="a.id" :label="a.name" :value="a.id" /></el-select></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="所属景区"><el-select v-model="form.scenic_spot_id" clearable filterable remote reserve-keyword :remote-method="searchScenicSpots" :loading="scenicSpotsLoading" placeholder="输入关键词搜索景区"><el-option v-for="s in scenicSpots" :key="s.id" :label="s.name" :value="s.id" /></el-select></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="人气"><el-input v-model="form.popularity" type="number" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="纬度"><el-input v-model="form.latitude" type="number" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="经度"><el-input v-model="form.longitude" type="number" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="距离"><el-input v-model="form.distance" type="number" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="地图选点">
        <LocationMapPicker v-model:lat="form.latitude" v-model:lng="form.longitude" v-model:address="form.landmark" />
      </el-form-item>
      <el-form-item label="封面图"><ImageUploader v-model="form.cover" /></el-form-item>
      <el-form-item label="描述"><el-input v-model="form.description" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="地标"><el-input v-model="form.landmark" /></el-form-item>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="人流等级"><el-input v-model="form.crowd_level" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="高峰时段"><el-time-picker v-model="crowdPeakRange" is-range format="HH:mm" value-format="HH:mm" range-separator="-" start-placeholder="开始" end-placeholder="结束" style="width:100%;" @change="onCrowdPeakChange" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="上午"><el-input v-model="form.crowd_morning" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="中午"><el-input v-model="form.crowd_noon" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="下午"><el-input v-model="form.crowd_afternoon" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="傍晚"><el-input v-model="form.crowd_evening" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="拍摄角度"><el-input v-model="form.angle" /></el-form-item>
      <el-form-item label="构图方式"><el-input v-model="form.composition" /></el-form-item>
      <el-form-item label="最佳时段"><el-time-picker v-model="bestTimeRange" is-range format="HH:mm" value-format="HH:mm" range-separator="-" start-placeholder="开始" end-placeholder="结束" style="width:100%;" @change="onBestTimeChange" /></el-form-item>
      <el-form-item label="小贴士"><el-input v-model="form.tips" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="禁忌事项"><el-input v-model="form.taboos" type="textarea" :rows="2" /></el-form-item>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="收费方式"><el-select v-model="form.charge_type"><el-option label="免费" value="free" /><el-option label="收费" value="paid" /></el-select></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="价格"><el-input v-model="form.charge_price" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="人气文本"><el-input v-model="form.popularity_text" /></el-form-item></el-col>
      </el-row>
      <el-form-item>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
        <el-button @click="$router.back()">取消</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { api } from '@/api'
import { ElMessage } from 'element-plus'
import ImageUploader from '@/components/ImageUploader.vue'
import LocationMapPicker from '@/components/LocationMapPicker.vue'
const route = useRoute(), router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const crowdPeakRange = ref(null)
const bestTimeRange = ref(null)
const activities = ref([])
const activitiesLoading = ref(false)
const scenicSpots = ref([])
const scenicSpotsLoading = ref(false)

async function searchActivities(keyword = '') {
  activitiesLoading.value = true
  try {
    const res = await api.getActivities({ page: 1, size: 30, keyword })
    activities.value = res.data.list || []
  } finally { activitiesLoading.value = false }
}

async function searchScenicSpots(keyword = '') {
  scenicSpotsLoading.value = true
  try {
    const res = await api.searchScenicSpots(keyword)
    scenicSpots.value = res.data || []
  } finally { scenicSpotsLoading.value = false }
}

function onCrowdPeakChange(val) {
  form.crowd_peak = (val && val.length === 2) ? val.join('-') : ''
}
function onBestTimeChange(val) {
  // 只有当用户主动选择了时间才更新；清空时不覆盖原始自由文本数据
  if (val && val.length === 2) form.best_time = val.join('-')
}

const form = reactive({
  id:'',name:'',type:'scenic',activity_id:'',scenic_spot_id:'',cover:'',latitude:0,longitude:0,
  description:'',angle:'',composition:'',best_time:'',crowd_level:'舒适',crowd_peak:'',
  crowd_morning:'舒适',crowd_noon:'舒适',crowd_afternoon:'舒适',crowd_evening:'舒适',
  tips:'',taboos:'',landmark:'',popularity:0,popularity_text:'',charge_type:'free',
  charge_price:'',charge_note:'',distance:0
})
function resetForm() {
  Object.assign(form, {
    id:'',name:'',type:'scenic',activity_id:'',scenic_spot_id:'',cover:'',latitude:0,longitude:0,
    description:'',angle:'',composition:'',best_time:'',crowd_level:'舒适',crowd_peak:'',
    crowd_morning:'舒适',crowd_noon:'舒适',crowd_afternoon:'舒适',crowd_evening:'舒适',
    tips:'',taboos:'',landmark:'',popularity:0,popularity_text:'',charge_type:'free',
    charge_price:'',charge_note:'',distance:0
  })
  crowdPeakRange.value = null
  bestTimeRange.value = null
}

// 解析时间范围字符串为 [HH:mm, HH:mm] 数组，兼容自由文本和缺少前导零的情况
function parseTimeRangeString(str) {
  if (!str) return null
  // 尝试匹配标准 HH:mm-HH:mm（含缺少前导零的 H:mm）
  const directMatch = str.match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/)
  if (directMatch) {
    const pad = (h) => h.padStart(2, '0')
    return [pad(directMatch[1]) + ':' + directMatch[2], pad(directMatch[3]) + ':' + directMatch[4]]
  }
  // 尝试从自由文本中提取 HH:mm-HH:mm 模式（如 "日落前30-60分钟（16:30-18:00）"）
  const textMatch = str.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/)
  if (textMatch) {
    const pad = (h) => h.padStart(2, '0')
    return [pad(textMatch[1]) + ':' + textMatch[2], pad(textMatch[3]) + ':' + textMatch[4]]
  }
  return null
}

async function loadEditData() {
  if (isEdit.value) {
    const { data } = await api.getCheckinPoint(route.params.id)
    Object.assign(form, data)
    crowdPeakRange.value = parseTimeRangeString(form.crowd_peak)
    bestTimeRange.value = parseTimeRangeString(form.best_time)
    // 预加载已选活动到下拉列表
    if (form.activity_id) {
      try {
        const { data: act } = await api.getActivity(form.activity_id)
        activities.value = [act]
      } catch { /* ignore */ }
    }
    // 预加载已选景区到下拉列表
    if (form.scenic_spot_id) {
      try {
        const { data: spot } = await api.getScenicSpot(form.scenic_spot_id)
        scenicSpots.value = [spot]
      } catch { /* ignore */ }
    }
  } else {
    resetForm()
  }
}

onMounted(() => { if (!isEdit.value) { searchActivities(); searchScenicSpots() } })

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
    isEdit.value ? await api.updateCheckinPoint(form.id, form) : await api.createCheckinPoint(form)
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    router.push('/checkin-points')
  } finally { saving.value = false }
}
</script>
