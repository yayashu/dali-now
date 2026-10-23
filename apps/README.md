# 前端应用（apps）

本目录包含「大理此刻」的两个客户端，均通过 HTTPS 调用 `services/server` 提供的 API。

| 目录 | 应用 | 技术栈 | 开发命令 | 构建产物 |
|---|---|---|---|---|
| `miniprogram/` | 微信小程序 | 原生小程序 | 微信开发者工具导入 | 工具内上传 |
| `admin-panel/` | 管理后台 | Vue 3 + Element Plus + ECharts | `npm run dev` | `dist/`，部署到 Nginx `/admin/` |

各应用详细说明见 [../docs/modules/](../docs/modules/)。

## 使用前必改

| 文件 | 需要修改 |
|---|---|
| `miniprogram/utils/config.js` | `SERVER_HOST`、`API_SECRET` |
| `miniprogram/project.config.json` | `appid` |
| `admin-panel/vite.config.js` | 开发代理 `target`（默认 `http://localhost:5000`） |

> `API_SECRET` 必须与 `services/server/.env` 中的 `API_SECRET` 完全一致。
