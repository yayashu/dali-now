# 贡献指南

感谢你对「大理此刻」开源项目的关注！

## 仓库结构

| 目录 | 内容 |
|---|---|
| `services/server/` | 服务端（Node.js 公开 API + Flask 管理后台 API） |
| `apps/miniprogram/` | 微信小程序 |
| `apps/admin-panel/` | 管理后台（Vue 3 + Element Plus） |
| `docs/` | 项目文档 |

## 开发环境

```bash
# 服务端
cd services/server
npm install
cp .env.example .env       # 填入本地数据库等信息
npm run init-db            # 初始化数据库（可选）
npm start                  # Node.js API :3000
pip install -r requirements.txt
python app.py              # Flask 管理后台 :5000

# 前端（按需）
cd apps/admin-panel && npm install && npm run dev
```

小程序用微信开发者工具导入 `apps/miniprogram`。

## 开发约定

- **双后端同步**：同一业务逻辑如需两侧实现，Node.js（`services/server/routes/`）与 Python（`services/server/admin_api.py`）需保持行为一致
- **分页格式统一**：列表接口统一返回 `{ list, total, page, size }`，入参兼容 `page/size` 与 `limit/offset`
  - Node.js 使用 `services/server/utils.js` 的 `getPagination(req)` / `paginatedData()`
  - Python 使用 `get_pagination()`
- **敏感信息**：密码、密钥、AppID 只能通过环境变量或前端占位配置提供，禁止硬编码
- **代码风格**：Python 遵循 PEP 8，JavaScript 使用 2 空格缩进（见 `.editorconfig`）

## 提交 Pull Request

1. Fork 仓库并创建特性分支：`git checkout -b feature/your-feature`
2. 提交变更，commit message 使用简洁的中文或英文描述
3. 本地自查：
   ```bash
   cd services/server && node --check app.js && python -m compileall -q .
   cd apps/admin-panel && npm run build
   ```
4. 发起 PR 并描述改动内容与测试方式

## 提交 Issue

请使用 GitHub Issue 模板（Bug 报告 / 功能建议），并尽量提供：

- 复现步骤与期望行为
- 服务端日志片段（**隐去敏感信息**）
- 涉及的接口路径与请求参数
