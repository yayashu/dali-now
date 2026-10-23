@echo off
REM ============================================================
REM 大理此刻 - Windows 生产环境启动脚本
REM ============================================================
REM 前置条件:
REM   - 已安装 Node.js >= 18
REM   - 已安装 Python >= 3.9
REM   - 已执行 npm install 和 pip install -r requirements.txt
REM   - .env 文件已配置
REM ============================================================

cd /d "%~dp0..\.."

echo ============================================================
echo  大理此刻 (DaLiNow) - Windows 生产环境启动
echo ============================================================
echo.

REM 检查 .env
if not exist .env (
    echo [WARN] .env 文件不存在，从 .env.example 复制...
    copy .env.example .env
    echo 请编辑 .env 填入真实配置后重新运行！
    pause
    exit /b 1
)

REM 创建上传目录
if not exist "%USERPROFILE%\dali_uploads" mkdir "%USERPROFILE%\dali_uploads"
if not exist "logs" mkdir "logs"

REM 启动 Node.js API (端口 3000)
echo [INFO] 启动 Node.js API 服务...
start "DaLiNow-API" cmd /c "node app.js >> logs\api.log 2>&1"

REM 启动 Python 管理后台 (端口 5000)
echo [INFO] 启动 Python 管理后台...
start "DaLiNow-Admin" cmd /c "python app.py >> logs\admin.log 2>&1"

timeout /t 3 /nobreak >nul

echo.
echo [INFO] 验证服务...

REM 验证 Node.js
curl -s http://localhost:3000/api/health
if errorlevel 1 (
    echo [WARN] Node.js API 未响应，检查 logs\api.log
) else (
    echo.
    echo [OK] Node.js API (3000) 运行中
)

echo.
echo [INFO] 验证 Python...
curl -s http://localhost:5000/api/health
if errorlevel 1 (
    echo [WARN] Python 管理后台未响应，检查 logs\admin.log
) else (
    echo.
    echo [OK] Python 管理后台 (5000) 运行中
)

echo.
echo ============================================================
echo 部署完成！按任意键退出...
pause >nul
