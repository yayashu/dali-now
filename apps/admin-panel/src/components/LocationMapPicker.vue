<template>
  <div class="location-picker">
    <div style="display:flex;gap:8px;margin-bottom:8px;align-items:center;flex-wrap:wrap;">
      <el-input
        v-model="searchText"
        placeholder="搜索地点..."
        style="flex:1;min-width:200px;"
        clearable
        @keyup.enter="searchLocation"
      >
        <template #append><el-button @click="searchLocation" :loading="searching">搜索</el-button></template>
      </el-input>
      <el-button v-if="!showMap" size="small" type="primary" @click="toggleMap">
        <el-icon><MapLocation /></el-icon> 地图选点
      </el-button>
      <el-button v-if="showMap" size="small" @click="toggleMap">收起地图</el-button>
    </div>

    <!-- 搜索结果 -->
    <div v-if="results.length" style="margin-bottom:8px;max-height:160px;overflow-y:auto;border:1px solid #e4e7ed;border-radius:4px;">
      <div
        v-for="(r, i) in results"
        :key="i"
        style="padding:8px 12px;cursor:pointer;border-bottom:1px solid #f0f0f0;"
        :style="{background: selectedIdx === i ? '#ecf5ff' : ''}"
        @click="selectResult(r, i)"
      >
        <div style="font-weight:500;">{{ r?.title || r?.name || '' }}</div>
        <div style="font-size:12px;color:#999;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{{ r?.address || '' }}</div>
      </div>
    </div>

    <!-- 地图 -->
    <div v-if="showMap" ref="mapEl" style="width:100%;height:320px;border-radius:6px;border:1px solid #e4e7ed;"></div>

    <!-- 坐标与位置名 -->
    <div v-if="lat != null && lng != null" style="display:flex;gap:12px;margin-top:6px;align-items:center;">
      <span style="font-size:13px;color:#666;white-space:nowrap;">纬度: {{ Number(lat).toFixed(6) }}</span>
      <span style="font-size:13px;color:#666;white-space:nowrap;">经度: {{ Number(lng).toFixed(6) }}</span>
      <el-input v-model="addressText" placeholder="位置名称（可修改）" size="small" style="flex:1;" @input="onAddressInput" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'

const props = defineProps({
  lat: { type: [Number, String], default: null },
  lng: { type: [Number, String], default: null },
  address: { type: String, default: '' }
})

const emit = defineEmits(['update:lat', 'update:lng', 'update:address'])

const searchText = ref(props.address || '')
const searching = ref(false)
const results = ref([])
const selectedIdx = ref(-1)
const showMap = ref(false)
const mapEl = ref(null)
const addressText = ref(props.address || '')
let map = null
let marker = null

// ====== 等待全局 BMapGL（index.html 中已同步引入） ======
let bmapReady = null

function waitForBMap() {
  if (window.BMapGL) return Promise.resolve()
  if (bmapReady) return bmapReady
  bmapReady = new Promise((resolve) => {
    const check = setInterval(() => {
      if (window.BMapGL) { clearInterval(check); resolve() }
    }, 200)
  })
  return bmapReady
}

// ====== 地图操作 ======
async function toggleMap() {
  showMap.value = !showMap.value
  if (showMap.value) {
    await nextTick()
    try {
      await waitForBMap()
      initMap()
    } catch (e) {
      console.warn('地图初始化失败:', e)
      showMap.value = false
    }
  } else {
    destroyMap()
  }
}

function destroyMap() {
  if (marker) {
    marker.remove()
    marker = null
  }
  if (map) {
    map.destroy()
    map = null
  }
}

function initMap() {
  if (!mapEl.value || !window.BMapGL) return
  if (map) {
    // 地图已存在，刷新尺寸
    map.resize()
    return
  }

  const latVal = props.lat ? Number(props.lat) : 25.6065
  const lngVal = props.lng ? Number(props.lng) : 100.2676
  const center = new BMapGL.Point(lngVal, latVal)

  map = new BMapGL.Map(mapEl.value)
  map.centerAndZoom(center, 14)
  map.enableScrollWheelZoom(true)

  // 添加比例尺和缩放控件
  const scaleCtrl = new BMapGL.ScaleControl()
  map.addControl(scaleCtrl)
  const zoomCtrl = new BMapGL.ZoomControl()
  map.addControl(zoomCtrl)

  // 已有坐标时放置标记
  if (props.lat && props.lng) {
    addMarker(center)
  }

  // 点击地图选点
  map.addEventListener('click', (e) => {
    const pt = e.latlng
    updatePoint(pt.lat, pt.lng)
    reverseGeocode(pt)
  })
}

function addMarker(pt) {
  if (marker) {
    marker.setPosition(pt)
  } else {
    marker = new BMapGL.Marker(pt)
    if (marker.enableDragging) marker.enableDragging()
    marker.addEventListener('dragend', (e) => {
      const newPt = e.latlng
      updatePoint(newPt.lat, newPt.lng)
      reverseGeocode(newPt)
    })
    map.addOverlay(marker)
  }
}

function updatePoint(lat, lng) {
  emit('update:lat', lat)
  emit('update:lng', lng)
}

// ====== 地址搜索（使用隐藏容器 + LocalSearch） ======
let searchMap = null
let searchMapEl = null

function ensureSearchMap() {
  if (searchMap) return
  searchMapEl = document.createElement('div')
  searchMapEl.style.cssText = 'position:absolute;left:-9999px;top:0;width:200px;height:200px;'
  document.body.appendChild(searchMapEl)
  searchMap = new BMapGL.Map(searchMapEl)
}

function destroySearchMap() {
  if (searchMap) {
    searchMap.destroy()
    searchMap = null
  }
  if (searchMapEl && searchMapEl.parentNode) {
    searchMapEl.parentNode.removeChild(searchMapEl)
    searchMapEl = null
  }
}

async function searchLocation() {
  const q = searchText.value.trim()
  if (!q) return
  searching.value = true
  results.value = []
  selectedIdx.value = -1
  try {
    await waitForBMap()
    ensureSearchMap()
    const arr = await new Promise((resolve) => {
      const local = new BMapGL.LocalSearch(searchMap)
      local.setSearchCompleteCallback(() => {
        const pois = []
        const sr = local.getResults()
        if (sr && typeof sr.getNumPois === 'function') {
          const n = sr.getNumPois()
          for (let i = 0; i < n; i++) {
            const poi = sr.getPoi(i)
            if (poi && poi.point) pois.push(poi)
          }
        }
        resolve(pois)
      })
      local.search(q)
    })
    results.value = arr
  } catch (e) {
    console.warn('地点搜索失败:', e)
  } finally {
    searching.value = false
  }
}

function selectResult(r, i) {
  if (!r || !r.point) return
  selectedIdx.value = i
  const lat = r.point.lat
  const lng = r.point.lng
  updatePoint(lat, lng)
  const addr = r.address || r.title || r.name || ''
  addressText.value = addr
  emit('update:address', addr)
  searchText.value = r.title || r.name || ''
  results.value = []

  if (!showMap.value) {
    showMap.value = true
    nextTick(async () => {
      try {
        await waitForBMap()
        initMap()
        centerToPoint(lat, lng)
      } catch { /* ignore */ }
    })
  } else {
    centerToPoint(lat, lng)
  }
}

function centerToPoint(lat, lng) {
  if (!map) return
  map.resize()
  const pt = new BMapGL.Point(lng, lat)
  map.centerAndZoom(pt, 17)
  addMarker(pt)
}

// ====== 反向地理编码 ======
function reverseGeocode(pt) {
  if (!window.BMapGL) return
  const geoc = new BMapGL.Geocoder()
  geoc.getLocation(pt, (rs) => {
    if (rs && rs.address) {
      addressText.value = rs.address
      emit('update:address', rs.address)
    }
  })
}

// ====== 地址手动编辑 ======
let addressTimer = null
function onAddressInput() {
  clearTimeout(addressTimer)
  addressTimer = setTimeout(() => {
    emit('update:address', addressText.value)
  }, 300)
}

// ====== 外部 props 同步 ======
watch(() => props.address, (v) => {
  if (v) { addressText.value = v; searchText.value = v }
})

onBeforeUnmount(() => {
  destroySearchMap()
  destroyMap()
})
</script>

