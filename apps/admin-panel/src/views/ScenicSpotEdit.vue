<template>
  <div class="page-card">
    <h3 style="margin-bottom:20px;">{{ isEdit ? '编辑景区' : '新增景区' }}</h3>
    <el-form :model="form" label-width="100px" label-position="top" style="max-width:900px;">

      <!-- 基础信息 -->
      <el-divider content-position="left">基础信息</el-divider>
      <el-row :gutter="16">
        <el-col v-if="isEdit" :span="6"><el-form-item label="ID"><el-input v-model="form.id" disabled /></el-form-item></el-col>
        <el-col :span="isEdit ? 12 : 16"><el-form-item label="景区名称" required><el-input v-model="form.name" placeholder="如：洱海生态廊道" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="所属区域"><el-select v-model="form.district_code" placeholder="选择区域" clearable style="width:100%;"><el-option v-for="d in districts" :key="d.code" :label="d.name" :value="d.code" /></el-select></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="景区级别"><el-select v-model="form.level" placeholder="选择级别" clearable><el-option label="5A" value="5A" /><el-option label="4A" value="4A" /><el-option label="3A" value="3A" /><el-option label="2A" value="2A" /><el-option label="A" value="A" /></el-select></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="标签"><el-input v-model="form.tags" placeholder="逗号分隔，如：自然风光,骑行" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="状态"><el-select v-model="form.status"><el-option label="上架" value="active" /><el-option label="下架" value="inactive" /></el-select></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="热度"><el-input v-model="form.popularity" type="number" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="排序权重"><el-input v-model="form.sort_order" type="number" /></el-form-item></el-col>
      </el-row>

      <!-- 图片 -->
      <el-divider content-position="left">图片</el-divider>
      <el-form-item label="封面图"><ImageUploader v-model="form.cover" /></el-form-item>
      <el-form-item label="景区图片集">
        <div v-for="(img, idx) in form.images" :key="idx" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
          <el-image v-if="img.url" :src="imgUrl(img.url)" style="width:80px;height:60px;border-radius:4px;" fit="cover" />
          <el-input v-model="img.url" placeholder="图片URL" style="flex:1;" />
          <el-input v-model="img.desc" placeholder="图片描述（选填）" style="flex:1;" />
          <el-button type="danger" :icon="Delete" circle size="small" @click="removeImage(idx)" />
        </div>
        <el-button type="primary" plain size="small" @click="addImage">+ 添加图片</el-button>
      </el-form-item>

      <!-- 位置与入口 -->
      <el-divider content-position="left">位置 &amp; 入口</el-divider>
      <el-form-item label="详细地址"><el-input v-model="form.address" placeholder="如：大理市大理古城南门" /></el-form-item>
      <el-row :gutter="16">
        <el-col :span="12"><el-form-item label="联系电话"><el-input v-model="form.phone" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="官网"><el-input v-model="form.website" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="景区位置"><LocationMapPicker v-model:lat="form.latitude" v-model:lng="form.longitude" v-model:address="form.address" /></el-form-item>
      <el-row :gutter="16">
        <el-col :span="18"><el-form-item label="入口描述"><el-input v-model="form.entrance" placeholder="入口名称或位置描述" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="入口纬度"><el-input v-model="form.entrance_lat" type="number" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="入口经度"><el-input v-model="form.entrance_lng" type="number" /></el-form-item></el-col>
      </el-row>

      <!-- 停车场 -->
      <el-divider content-position="left">停车场</el-divider>
      <el-row :gutter="16">
        <el-col :span="18"><el-form-item label="停车场信息"><el-input v-model="form.parking" placeholder="停车场名称或位置描述" /></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="停车费"><el-input v-model="form.parking_fee" placeholder="如：10元/次" /></el-form-item></el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="停车场纬度"><el-input v-model="form.parking_lat" type="number" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="停车场经度"><el-input v-model="form.parking_lng" type="number" /></el-form-item></el-col>
      </el-row>

      <!-- 门票 -->
      <el-divider content-position="left">门票</el-divider>
      <el-row :gutter="16">
        <el-col :span="6"><el-form-item label="门票类型"><el-select v-model="form.ticket_type"><el-option label="免费" value="free" /><el-option label="收费" value="paid" /></el-select></el-form-item></el-col>
        <el-col :span="6"><el-form-item label="价格(元)"><el-input v-model="form.ticket_price" type="number" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="票价说明"><el-input v-model="form.ticket_note" type="textarea" :rows="2" /></el-form-item>
      <el-form-item label="优惠政策"><el-input v-model="form.half_price_note" type="textarea" :rows="2" placeholder="如：学生半价、老人免票等" /></el-form-item>

      <!-- 开放时间 -->
      <el-divider content-position="left">开放时间</el-divider>
      <el-row :gutter="16">
        <el-col :span="8"><el-form-item label="开放时间"><el-input v-model="form.open_time" placeholder="如：08:00" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="关闭时间"><el-input v-model="form.close_time" placeholder="如：18:00" /></el-form-item></el-col>
        <el-col :span="8"><el-form-item label="最佳季节"><el-input v-model="form.best_season" placeholder="如：3-5月" /></el-form-item></el-col>
      </el-row>
      <el-form-item label="建议游览时长"><el-input v-model="form.suggested_time" placeholder="如：2-3小时" /></el-form-item>

      <!-- 介绍 -->
      <el-divider content-position="left">景区介绍</el-divider>
      <el-form-item label="简介"><el-input v-model="form.description" type="textarea" :rows="3" placeholder="景区简要介绍" /></el-form-item>
      <el-form-item label="概况"><el-input v-model="form.overview" type="textarea" :rows="4" placeholder="景区详细概况" /></el-form-item>

      <!-- 配套设施 -->
      <el-divider content-position="left">配套设施 &amp; 提示</el-divider>
      <el-form-item label="配套设施"><el-input v-model="form.facilities" type="textarea" :rows="2" placeholder="如：卫生间、停车场、餐饮、导览等" /></el-form-item>
      <el-form-item label="交通指南"><el-input v-model="form.transport" type="textarea" :rows="2" placeholder="如：可乘坐8路公交至大理古城站" /></el-form-item>
      <el-form-item label="注意事项"><el-input v-model="form.notice" type="textarea" :rows="2" placeholder="游客须知" /></el-form-item>
      <el-form-item label="游览贴士"><el-input v-model="form.tips" type="textarea" :rows="2" placeholder="游览建议" /></el-form-item>

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

function imgUrl(v) {
  if (!v || typeof v !== 'string') return ''
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const cleaned = v.replace(/^\/+/, '')
  return cleaned ? '/' + cleaned : ''
}

const route = useRoute(), router = useRouter()
const isEdit = computed(() => !!route.params.id)
const saving = ref(false)
const districts = ref([])

const form = reactive({
  id:'', name:'', district_code:'', cover:'', images:[], description:'', overview:'',
  entrance:'', entrance_lat:'', entrance_lng:'',
  parking:'', parking_lat:'', parking_lng:'', parking_fee:'',
  ticket_type:'free', ticket_price:'', ticket_note:'', half_price_note:'',
  open_time:'', close_time:'', best_season:'', suggested_time:'',
  address:'', latitude:'', longitude:'', phone:'', website:'',
  level:'', tags:'', facilities:'', transport:'', notice:'', tips:'',
  popularity:'0', sort_order:'0', status:'active'
})

function resetForm() {
  Object.assign(form, {
    id:'', name:'', district_code:'', cover:'', images:[], description:'', overview:'',
    entrance:'', entrance_lat:'', entrance_lng:'',
    parking:'', parking_lat:'', parking_lng:'', parking_fee:'',
    ticket_type:'free', ticket_price:'', ticket_note:'', half_price_note:'',
    open_time:'', close_time:'', best_season:'', suggested_time:'',
    address:'', latitude:'', longitude:'', phone:'', website:'',
    level:'', tags:'', facilities:'', transport:'', notice:'', tips:'',
    popularity:'0', sort_order:'0', status:'active'
  })
}

async function loadEditData() {
  if (isEdit.value) {
    const { data } = await api.getScenicSpot(route.params.id)
    Object.keys(form).forEach(key => {
      if (data[key] !== undefined && data[key] !== null) {
        if (key === 'images') {
          form[key] = typeof data[key] === 'string' ? JSON.parse(data[key] || '[]') : (data[key] || [])
        } else {
          form[key] = String(data[key])
        }
      }
    })
  } else {
    resetForm()
  }
}

function addImage() { form.images.push({ url: '', desc: '' }) }
function removeImage(idx) { form.images.splice(idx, 1) }

async function handleSave() {
  if (!form.name.trim()) { ElMessage.warning('请输入景区名称'); return }
  saving.value = true
  try {
    const data = { ...form }
    // 数值字段
    ;['ticket_price','popularity','sort_order','latitude','longitude','entrance_lat','entrance_lng','parking_lat','parking_lng'].forEach(f => {
      data[f] = parseFloat(data[f]) || null
    })
    // images 保持为数组，后端自动序列化
    isEdit.value ? await api.updateScenicSpot(form.id, data) : await api.createScenicSpot(data)
    ElMessage.success(isEdit.value ? '更新成功' : '创建成功')
    router.push('/scenic-spots')
  } finally { saving.value = false }
}

onMounted(() => {
  api.getDistricts().then(res => { districts.value = res.data.list || res.data || [] }).catch(() => {})
})

watch(() => route.params.id, async (id) => {
  if (id) await loadEditData()
  else resetForm()
}, { immediate: true })
</script>
