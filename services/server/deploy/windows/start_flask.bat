@echo off
cd /d "%~dp0..\.."
start /B python admin_api.py > server.log 2>&1
