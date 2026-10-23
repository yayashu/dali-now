#!/bin/bash
# ============================================================
# 大理此刻 - 一键部署脚本 (Linux)
# ============================================================
# 用法:
#   chmod +x deploy.sh
#   sudo ./deploy.sh
#
# 前置条件:
#   - 服务器已安装 Node.js >= 18, Python >= 3.9, MySQL >= 8.0
#   - 代码已上传到 /data/dali-now（monorepo 根目录）
# ============================================================

set -e

# ====== 配置变量 ======
# 服务端目录（本脚本位于 services/server/deploy，因此在 monorepo 中指向 services/server）
APP_DIR="/data/dali-now/services/server"
UPLOAD_DIR="/data/dali-now/uploads"
LOG_DIR="${APP_DIR}/logs"
NODE_PORT=3000
PYTHON_PORT=5000

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "============================================================"
echo "  大理此刻 (DaLiNow) - 自动部署脚本"
echo "============================================================"
echo ""

# ====== 1. 检查基础环境 ======
log_info "检查基础环境..."

command -v node >/dev/null 2>&1 || { log_error "Node.js 未安装，请先安装 Node.js >= 18"; exit 1; }
command -v npm >/dev/null 2>&1  || { log_error "npm 未安装"; exit 1; }
command -v python3 >/dev/null 2>&1 || { log_error "Python3 未安装"; exit 1; }
command -v pip3 >/dev/null 2>&1 || { log_error "pip3 未安装"; exit 1; }

NODE_VER=$(node -v)
PY_VER=$(python3 --version)
log_info "Node.js: ${NODE_VER}"
log_info "Python: ${PY_VER}"

# ====== 2. 进入项目目录 ======
if [ ! -d "$APP_DIR" ]; then
  log_error "项目目录不存在: $APP_DIR"
  exit 1
fi
cd "$APP_DIR"

# ====== 3. 检查 .env 配置 ======
if [ ! -f .env ]; then
  cp .env.example .env
  log_warn ".env 文件已从 .env.example 创建"
  log_warn "请编辑 ${APP_DIR}/.env 填入真实配置后重新运行此脚本！"
  log_warn "  vim ${APP_DIR}/.env"
  exit 0
fi

# ====== 4. 安装 Node.js 依赖 ======
log_info "安装 Node.js 依赖..."
npm install --production

# ====== 5. 安装 Python 依赖 ======
log_info "安装 Python 依赖..."
pip3 install -r requirements.txt

# ====== 6. 创建目录 ======
log_info "创建运行时目录..."
mkdir -p "$UPLOAD_DIR"
mkdir -p "$LOG_DIR"

# ====== 7. 安装 PM2 ======
if ! command -v pm2 >/dev/null 2>&1; then
  log_info "安装 PM2..."
  npm install -g pm2
fi

# ====== 8. 加载环境变量 ======
log_info "加载环境变量..."
set -a
source .env
set +a

# ====== 9. 停止旧进程（如果存在） ======
pm2 delete dali-api 2>/dev/null || true
pm2 delete dali-admin 2>/dev/null || true

# ====== 10. 启动服务 ======
log_info "启动服务 (Node.js ${NODE_PORT} / Python ${PYTHON_PORT})..."
pm2 start "${APP_DIR}/deploy/ecosystem.config.js"

# ====== 11. 保存 PM2 进程列表并设置开机自启 ======
log_info "设置 PM2 开机自启..."
pm2 save
pm2 startup | grep "sudo" | bash 2>/dev/null || true

# ====== 12. 验证服务 ======
log_info "验证服务..."
sleep 3

echo ""
echo "---- Node.js API 健康检查 ----"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${NODE_PORT}/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  log_info "Node.js API (端口 ${NODE_PORT}) ✅ 正常"
  curl -s http://localhost:${NODE_PORT}/api/health
  echo ""
else
  log_error "Node.js API (端口 ${NODE_PORT}) ❌ 异常 (HTTP ${HTTP_CODE})"
fi

echo ""
echo "---- Python 管理后台健康检查 ----"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${PYTHON_PORT}/api/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
  log_info "Python 管理后台 (端口 ${PYTHON_PORT}) ✅ 正常"
  curl -s http://localhost:${PYTHON_PORT}/api/health
  echo ""
else
  log_error "Python 管理后台 (端口 ${PYTHON_PORT}) ❌ 异常 (HTTP ${HTTP_CODE})"
fi

# ====== 13. 完成 ======
echo ""
echo "============================================================"
log_info "✅ 部署完成！"
echo ""
echo "   查看进程状态: pm2 status"
echo "   查看日志:     pm2 logs"
echo "   重启服务:     pm2 restart all"
echo ""
echo "   接下来请配置 Nginx 反向代理，参考:"
echo "   ${APP_DIR}/docs/deployment/DEPLOY.md 第五章"
echo "============================================================"
