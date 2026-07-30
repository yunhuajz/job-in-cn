@echo off
cd /d D:\AJS\job-for-claude\apps\web
"C:\Program Files\nodejs\node.exe" scripts\export-jobs-html.cjs >> D:\AJS\job-for-claude\data\export.log 2>&1
