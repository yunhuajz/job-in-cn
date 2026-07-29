@echo off
rem 后台启动 jobsync dev server(端口 3737),日志写 data/next-dev.log
cd /d D:\AJS\job-for-claude\apps\web
"C:\Program Files\nodejs\node.exe" node_modules\next\dist\bin\next dev --turbopack -p 3737 >> D:\AJS\job-for-claude\data\next-dev.log 2>&1
