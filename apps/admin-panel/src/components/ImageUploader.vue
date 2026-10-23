<template>
  <div class="image-uploader">
    <div class="preview-box" v-if="modelValue && fullUrl">
      <el-image :src="fullUrl" fit="cover" style="width:100%;height:100%;border-radius:6px;" :preview-src-list="[fullUrl]" />
      <div class="preview-overlay" v-if="!disabled" @click.stop="clearImage">
        <el-icon :size="20"><Delete /></el-icon>
      </div>
    </div>
    <el-upload
      v-if="!disabled"
      class="upload-btn"
      :show-file-list="false"
      :http-request="customUpload"
      :before-upload="beforeUpload"
      accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/bmp"
    >
      <div class="upload-trigger" :class="{ 'has-image': !!modelValue }">
        <el-icon :size="modelValue ? 16 : 24"><Plus /></el-icon>
        <span v-if="!modelValue" style="margin-top:4px;font-size:12px;">上传图片</span>
      </div>
    </el-upload>
    <el-input
      v-if="!disabled"
      v-model="urlText"
      placeholder="或输入图片URL"
      size="small"
      style="margin-top:8px;"
      @blur="onUrlBlur"
      clearable
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
})
const emit = defineEmits(['update:modelValue'])

const uploading = ref(false)
const urlText = ref('')

const fullUrl = computed(() => {
  const v = props.modelValue
  if (!v || typeof v !== 'string') return ''
  if (v.startsWith('http://') || v.startsWith('https://')) return v
  const cleaned = v.replace(/^\/+/, '')
  return cleaned ? '/' + cleaned : ''
})

function beforeUpload(file) {
  const valid = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/bmp']
  if (!valid.includes(file.type)) {
    ElMessage.error('仅支持 PNG/JPG/GIF/Webp/BMP 格式')
    return false
  }
  if (file.size > 20 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 20MB')
    return false
  }
  return true
}

async function customUpload({ file }) {
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    const res = await axios.post('/api/upload/image', fd)
    const d = res.data
    if (d.code === 0) {
      emit('update:modelValue', d.data.url)
      urlText.value = ''
      ElMessage.success('上传成功')
    } else {
      ElMessage.error(d.msg || '上传失败')
    }
  } catch (e) {
    ElMessage.error('上传失败，请稍后重试')
  } finally {
    uploading.value = false
  }
}

function onUrlBlur() {
  const v = urlText.value.trim()
  if (v) {
    emit('update:modelValue', v)
    urlText.value = ''
  }
}

function clearImage() {
  emit('update:modelValue', '')
}
</script>

<style scoped>
.image-uploader {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}
.preview-box {
  position: relative;
  width: 100px;
  height: 100px;
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  border: 1px solid #e4e7ed;
  flex-shrink: 0;
}
.preview-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: #fff;
}
.preview-box:hover .preview-overlay {
  opacity: 1;
}
.upload-trigger {
  width: 100px;
  height: 100px;
  border: 1px dashed #d9d9d9;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8c939d;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}
.upload-trigger:hover {
  border-color: #1a6b4b;
  color: #1a6b4b;
}
.upload-trigger.has-image {
  width: 32px;
  height: 32px;
  border-style: solid;
  border-radius: 4px;
}
.upload-btn {
  flex-shrink: 0;
}
</style>
