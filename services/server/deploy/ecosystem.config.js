/**
 * 大理此刻 - PM2 进程管理配置
 * ============================================================
 * 使用方式（在仓库根目录执行）:
 *   pm2 start deploy/ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */
const path = require('path')
const ROOT = path.resolve(__dirname, '..')   // 仓库根目录，使脚本路径与配置文件位置无关

module.exports = {
  apps: [
    {
      // ---- Node.js Express API 服务 ----
      name: 'dali-api',
      script: path.join(ROOT, 'app.js'),
      cwd: ROOT,
      instances: 1,                    // 单实例（如需集群，改为 'max'）
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 3000
      },
      max_memory_restart: '500M',      // 内存超 500M 自动重启
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      // ---- Python Flask 管理后台 ----
      name: 'dali-admin',
      script: path.join(ROOT, 'app.py'),
      interpreter: 'python3',          // 使用 Python 解释器
      cwd: ROOT,
      instances: 1,
      exec_mode: 'fork',
      env: {
        SERVER_PORT: 5000
      },
      max_memory_restart: '300M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/admin-error.log',
      out_file: './logs/admin-out.log',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
};
