# 管理后台（apps/admin-panel）

面向运营的内容管理界面，Vue 3 + Element Plus + ECharts，调用 Flask 管理后台 API。

## 技术栈

| 项 | 值 |
|---|---|
| 框架 | Vue 3 + Vite 5 |
| UI | Element Plus + @element-plus/icons-vue |
| 图表 | ECharts + vue-echarts |
| 状态 | Pinia |
| 请求 | axios |

## 目录

```text
apps/admin-panel/
├── index.html
├── vite.config.js       # base: '/admin/'，开发代理到 http://localhost:5000
├── package.json
├── public/
└── src/
    ├── main.js / App.vue
    ├── api/index.js      # axios 实例，baseURL: /api/admin
    ├── components/
    ├── router/
    ├── stores/
    ├── styles/
    └── views/            # 20 个页面（活动、景点、打卡点、用户、配置等）
```

## 开发与构建

```bash
cd apps/admin-panel
npm install
npm run dev        # http://localhost:5173，/api 代理到 http://localhost:5000
npm run build      # 产物输出 dist/，base 为 /admin/
```

## 认证

登录 `/api/admin/login` 后，后端返回 HMAC 签名 Token；前端在请求头携带：

```text
X-Admin-Token: <timestamp>:<signature>
```

Token 有效期 24 小时，过期需重新登录。

## 界面预览

<table>
  <tr>
    <td align="center"><img src="../assets/screenshots/admin-panel/01-dashboard.jpg" width="420" alt="数据看板"><br><sub>数据看板</sub></td>
    <td align="center"><img src="../assets/screenshots/admin-panel/02-activities.jpg" width="420" alt="活动管理"><br><sub>活动管理</sub></td>
  </tr>
</table>

## 功能模块

| 模块 | 说明 |
|---|---|
| 登录 / 仪表盘 | 账号登录、数据概览与图表 |
| 活动管理 | CRUD、上下架、审核、Excel 模板导入 |
| 景点管理 | CRUD、搜索、Excel 导入 |
| 打卡点管理 | CRUD、审核、Excel 导入 |
| 现场动态 / 社区 | 列表、审核、删除 |
| 首页照片墙 / 本地生活 / 区县 | CRUD |
| 用户管理 | 查询、封禁/解封、删除 |
| 敏感词库 / 系统配置 | 词库维护、应用配置读写 |

## 部署

`npm run build` 后将 `dist/` 内容部署到服务器 `/data/www/admin/`，Nginx 配置中以 `/admin/` 提供访问（见 `services/server/deploy/nginx/dali-now.conf`）。
