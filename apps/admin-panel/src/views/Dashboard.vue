<template>
  <div>
    <!-- 加载状态 -->
    <el-row :gutter="16" style="margin-bottom:20px;" v-if="loading">
      <el-col :xs="12" :sm="6" v-for="i in 7" :key="i">
        <el-card shadow="hover" :body-style="{padding:'16px 20px'}">
          <el-skeleton :rows="2" animated />
        </el-card>
      </el-col>
    </el-row>

    <!-- 错误状态 -->
    <el-alert v-if="loadError && !loading"
      title="数据加载失败"
      :description="errorMsg"
      type="error"
      show-icon
      closable
      style="margin-bottom:20px;"
    >
      <template #default>
        <el-button type="primary" size="small" @click="loadData" style="margin-top:8px;">
          重新加载
        </el-button>
      </template>
    </el-alert>

    <!-- 正常数据 -->
    <el-row :gutter="16" style="margin-bottom:20px;" v-if="!loading && !loadError">
      <el-col :xs="12" :sm="6" v-for="s in statCards" :key="s.label">
        <el-card shadow="hover" :body-style="{padding:'16px 20px'}">
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <div>
              <div style="color:#909399;font-size:13px;">{{ s.label }}</div>
              <div style="font-size:28px;font-weight:700;margin-top:4px;color:#303133;">{{ s.value }}</div>
            </div>
            <el-icon :size="36" :color="s.color"><component :is="s.icon" /></el-icon>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-bottom:20px;" v-if="!loading && !loadError">
      <el-col :xs="24" :md="14">
        <el-card>
          <template #header>各板块内容统计</template>
          <div ref="trendChart" style="height:280px;"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="10">
        <el-card>
          <template #header>热度 Top 5 活动</template>
          <el-table :data="topAct" size="small" :show-header="false" empty-text="暂无数据">
            <el-table-column type="index" width="40" />
            <el-table-column prop="name" show-overflow-tooltip />
            <el-table-column width="90">
              <template #default="{row}">🔥 {{ row.hot_value }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="16" v-if="!loading && !loadError">
      <el-col :xs="24" :md="12">
        <el-card>
          <template #header>活动预约排行</template>
          <div ref="statusChart" style="height:240px;"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card>
          <template #header>内容模块占比</template>
          <div ref="userChart" style="height:240px;"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, nextTick } from 'vue'
import { api } from '@/api'
import * as echarts from 'echarts'

const stats = reactive({})
const topAct = ref([])
const trendChart = ref(null)
const statusChart = ref(null)
const userChart = ref(null)
const loading = ref(true)
const loadError = ref(false)
const errorMsg = ref('')

const statCards = [
  { label: '活动总数', value: 0, icon: 'Calendar', color: '#1a6b4b' },
  { label: '打卡点', value: 0, icon: 'Location', color: '#409EFF' },
  { label: '用户数', value: 0, icon: 'User', color: '#E6A23C' },
  { label: '现场发文', value: 0, icon: 'ChatLineRound', color: '#67C23A' },
  { label: '社区攻略', value: 0, icon: 'Document', color: '#909399' },
  { label: '预约量', value: 0, icon: 'Tickets', color: '#F56C6C' },
  { label: '本地生活', value: 0, icon: 'Shop', color: '#7B68EE' }
]

async function loadData() {
  try {
    loading.value = true
    loadError.value = false
    errorMsg.value = ''
    const { data } = await api.dashboard()
    if (!data) throw new Error('数据为空')
    Object.assign(stats, data.stats || {})
    statCards[0].value = data.stats?.total_activities ?? 0
    statCards[1].value = data.stats?.total_checkin ?? 0
    statCards[2].value = data.stats?.total_users ?? 0
    statCards[3].value = data.stats?.total_live ?? 0
    statCards[4].value = data.stats?.total_community ?? 0
    statCards[5].value = data.stats?.total_bookings ?? 0
    statCards[6].value = data.stats?.total_locallife ?? 0
    topAct.value = data.top_activities || []

    // 先结束 loading 让 v-if 释放 DOM，再渲染图表
    loading.value = false
    await nextTick()
    // 各板块内容统计（柱状图，基于 stats 数据，始终有值）
    if (trendChart.value) {
      const t = echarts.init(trendChart.value)
      const overviewLabels = ['活动', '打卡点', '现场发文', '社区攻略', '预约量', '本地生活']
      const overviewValues = [
        statCards[0].value, statCards[1].value, statCards[2].value,
        statCards[3].value, statCards[4].value, statCards[5].value
      ]
      t.setOption({
        tooltip: { trigger: 'axis' },
        grid: { left: 50, right: 20, top: 20, bottom: 40 },
        xAxis: { type: 'category', data: overviewLabels, axisLabel: { rotate: 15 } },
        yAxis: { type: 'value', minInterval: 1 },
        series: [{
          type: 'bar', data: overviewValues,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#43cea2' }, { offset: 1, color: '#1a6b4b' }
            ]),
            borderRadius: [6, 6, 0, 0]
          },
          label: { show: true, position: 'top', color: '#333' }
        }]
      })
      window.addEventListener('resize', () => t.resize())
    }
    // 活动预约排行（横向柱状图，基于 top_activities booked）
    if (statusChart.value) {
      const s = echarts.init(statusChart.value)
      const topNames = topAct.value.map(i => i.name).reverse()
      const topBooked = topAct.value.map(i => i.booked || 0).reverse()
      s.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 80, right: 40, top: 10, bottom: 20 },
        xAxis: { type: 'value', minInterval: 1 },
        yAxis: { type: 'category', data: topNames, axisLabel: { width: 70, overflow: 'truncate' } },
        series: [{
          type: 'bar', data: topBooked,
          itemStyle: { color: '#409EFF', borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: '#333' }
        }]
      })
    }
    // 内容模块占比（环形饼图，基于 stats 数据）
    if (userChart.value) {
      const u = echarts.init(userChart.value)
      const pieData = [
        { name: '活动', value: statCards[0].value },
        { name: '打卡点', value: statCards[1].value },
        { name: '现场发文', value: statCards[2].value },
        { name: '社区攻略', value: statCards[3].value },
        { name: '预约量', value: statCards[4].value },
        { name: '本地生活', value: statCards[5].value }
      ].filter(i => i.value > 0)
      const pieColors = ['#1a6b4b', '#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#7B68EE']
      u.setOption({
        tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [{
          type: 'pie', radius: ['45%', '75%'], center: ['50%', '45%'],
          label: { show: true, formatter: '{b}\n{d}%', fontSize: 11 },
          data: pieData.length ? pieData : [{ name: '暂无数据', value: 1 }],
          itemStyle: { borderColor: '#fff', borderWidth: 2 }
        }]
      })
      // 为每个数据项设置颜色
      if (pieData.length) {
        u.setOption({
          series: [{
            data: pieData.map((d, i) => ({ ...d, itemStyle: { color: pieColors[i] || '#ccc' } }))
          }]
        })
      }
    }
  } catch (e) {
    loadError.value = true
    errorMsg.value = e?.msg || e?.message || '网络异常，请稍后重试'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>
