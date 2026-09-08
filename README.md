# job-in-cn (JBCN)

> 面向国内主流招聘平台（Boss 直聘 / 前程无忧 / 智联招聘）的个人 AI 智能求职与投递管理系统。

---

## 🌟 核心特性

- **多平台岗位采集**
  - 支持 **Boss 直聘**、**前程无忧 (51job)**、**智联招聘**。
  - 采用陪同式被动读取架构（配合 OpenCLI Browser Bridge），最大化规避风控拦截与账号风险。
  - 智能多轮轮转采集、防风控降速等待、风控/验证码自动暂停与恢复。

- **本地自托管 Web 看板**
  - 基于 **Next.js + Tailwind CSS + SQLite (Prisma)** 打造，全部数据本地持久化存储，无需将个人隐私上传云端。
  - 多维度快速筛选：关键词、城市、来源、薪资区间、工作年限/学历要求、双休确认等。
  - 招聘全流程状态追踪：未投递、已投递、深度推进中、收到 Offer 等一键流转。

- **多模型 AI 智能匹配与打分**
  - 支持 **OpenAI 兼容协议 (Chat Completions / Responses)** 及 **Anthropic Messages 协议**。
  - 自由配置 Base URL、API Key 与模型（支持 DeepSeek、Claude、GPT、Kimi 等）。
  - 内置多维度契约与默认简历对比，批量对岗位进行 JD 匹配评分并生成量化报告。

- **简历管理与结构化解析**
  - 支持 PDF / Word (.docx) 简历上传与自动化关键信息结构提取。
  - 简历内容作为 AI 评分基准，精准匹配岗位技术栈与经历。

- **投递人闸保障 (Human-in-the-loop)**
  - 严格的人类安全闸机制：自动化仅负责筛选与准备，发招呼及投递由用户明确确认，保障账号安全。

---

## 🛠️ 技术栈

- **前端 / 服务端**：Next.js 15, React 19, Tailwind CSS, Radix UI
- **数据存储**：SQLite, Prisma ORM
- **采集与自动化**：Node.js, TypeScript, OpenCLI Browser Bridge, Playwright
- **AI 框架**：Vercel AI SDK, 自定义 OpenAI/Anthropic 客户端与工具集
- **测试**：Vitest, Testing Library

---

## 🚀 快速开始

### 1. 前置依赖
- **Node.js** >= 22
- **Chrome 浏览器**（已登录对应招聘网站，并安装 OpenCLI 扩展与命令行支持）

### 2. 安装依赖
```bash
# 根目录安装依赖
npm install

# 进入 Web 端安装依赖
cd apps/web && npm install && cd ../..
```

### 3. 初始化数据库与启动
在根目录下运行：
```bash
# 本地一键启动（启动并在浏览器打开 http://127.0.0.1:3737）
npm run dev
# 或使用内置启动器：
.\JBCN.cmd
```

服务启动后，可在浏览器中访问：`http://127.0.0.1:3737`。

---

## 📖 目录结构

```
job-in-cn/
├── apps/
│   └── web/                # Next.js 本地 Web 看板与后台 API
│       ├── src/
│       │   ├── app/        # Next.js App Router (岗位列表、AI 设置、爬虫控制台)
│       │   ├── components/ # UI 组件
│       │   └── lib/        # 业务逻辑、AI 客户端、数据库连接
│       └── prisma/         # SQLite 数据库模型与迁移
├── src/
│   ├── boss/               # Boss 直聘采集与映射适配器
│   ├── job51/              # 前程无忧 51job 适配器
│   ├── zhaopin/            # 智联招聘适配器
│   ├── crawler/            # 统筹调度、多源轮转与防风控计划
│   └── scoring/            # 岗位评分逻辑与 LLM 客户端
├── tests/                  # 自动化单元测试与回归测试集
├── docs/                   # 架构设计 (design.md)、决策记录 (ADR)、PRD 文档
└── profile/                # 候选人偏好配置模板 (candidate.example.yaml)
```

---

## 🔒 隐私与免责声明

1. 本项目为个人效率工具，**所有岗位数据、个人简历、API 密钥与配置均存储在本地 SQLite 数据库及本地文件中**，绝不回传任何第三方分析服务器。
2. 请严格遵守各招聘平台的用户协议与规则，合理设置采集间隔与频率，切勿用于商业竞争或批量骚扰行为。
