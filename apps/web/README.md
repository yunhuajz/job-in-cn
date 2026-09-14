# JobSync - Job Search Assistant

## <a href="https://demo.jobsync.ca">Live Demo</a>

JobSync is a web app companion for managing your job search journey. This free and open-source project is designed to help job seekers efficiently track and organize their job applications. Say goodbye to the chaos of scattered information and hello to a streamlined, intuitive, and powerful job search experience running locally on your system.

Job searching can be overwhelming, with numerous applications to track and deadlines to meet. JobSeeker Assistant is here to simplify this process, allowing you to focus on big picture and keep track of your job search related activities. JobSync app platform empowers you with the tools you need to stay organized, informed, and proactive throughout your job search.

### Dashboard

![App Snapshot](./screenshots/jobsync-dashboard-screenshot.png?raw=true "App Snapshot Image")

### Jobs Applied list

![App Snapshot](./screenshots/jobsync-myjobs.png?raw=true "My Jobs Page Snapshot Image")

### AI Resume review

![JobSync AI Demo](./screenshots/jobsync-ai.gif)

### AI Job match

![JobSync AI Demo](./screenshots/jobsync-ai-jobmatch.gif)

## Key Features
- **Application Tracker:** Keep a detailed record of all your job applications, including company details, job titles, application dates, and current status.

- **Monitoring Dashboard:** Visualize your job search progress with an interactive dashboard that provides insights into your application activities, success rates, and upcoming tasks.

- **Resume Management:** Store and manage your resumes, export them as professionally formatted PDFs (Simple or Professional template), and use them with AI to get reviews and match with job descriptions. Import existing resumes from PDF or Word (.docx) files — AI extracts and structures your contact info, experience, education, and certifications so you can review and save each section individually.

- **Automated Job Discovery:** Schedule and run automations that track companies directly via the Greenhouse and Lever job board APIs, then AI-match each listing against your resume and surface the best fits for review. More job board sources coming soon.

- **Task & Activity Management:** Manage tasks, track activites linked with tasks included with time tracking. 

- **AI Assistant:** Leverage the power of AI to improve your resumes and match with jobs. Get personalized job matching with scoring to identify the best opportunities tailored to your profile.

- **岗位录入 API：** 外部 AI 工具或普通脚本可以通过标准 HTTP POST 将岗位保存到系统，系统统一执行实体解析和去重。投递仍需用户在页面确认。


## Free to Use and Self-Hosted
JobSync Assistant is completely free to use and open source. It provides a powerful job search management tool at no cost and ensures that everyone has access to the resources they need. Additionally, JobSeeker Assistant is designed to be self-hosted, giving you full control over your data. By using Docker, you can easily set up and run JobSync Assistant on your own server, ensuring a secure and personalized experience.


## Quick Start

Make sure [Docker](https://www.docker.com) is installed and running, then:

```sh
git clone https://github.com/Gsync/jobsync.git
cd jobsync
docker compose up
```

> **Note:** If app is unreachable after container starts, wait for a few minutes before accessing the app in browser.

Open [http://localhost:3737](http://localhost:3737) and create your account. That's it!

API keys for AI providers can be configured in **Settings** after signing in.

### Configuration (Optional)

Environment variables can be set in `docker-compose.yml`:

| Variable | Description |
|---|---|
| `TZ` | Your timezone (e.g. `America/Edmonton`). **Set this on remote servers** to avoid activity time shifts. |
| `AUTH_SECRET` | Auto-generated if not set. To set manually: `openssl rand -base64 32` |

### Updating

From the project directory, run the deploy script to pull the latest changes and rebuild:

```sh
curl -fsSL https://raw.githubusercontent.com/Gsync/jobsync/main/deploy.sh | sudo bash -s
```

On **Windows**, run the PowerShell equivalent from the project directory instead (`deploy.sh` needs WSL or Git Bash; `deploy.ps1` runs natively):

```powershell
.\deploy.ps1
```

>Note: If you are updating in a homelab environment, edit `NEXTAUTH_URL` in your `.env` file to use your server IP address instead of `localhost`. See `.env.example` for the expected format.

## Features in Detail

### PDF Resume Export

Export any resume as a professionally formatted PDF directly from the resume page. Choose between two layouts — a clean **Simple** template and a more polished **Professional** template. If a PDF attachment already exists, you'll be prompted to replace it or keep the download only.

### Resume Import

Import an existing resume from a PDF or Word (.docx) file. AI extracts structured data — contact info, summary, skills, work experience, education, and certifications — and presents each section as a review card. You can accept or skip individual sections before saving them to your resume.

### Automated Job Discovery

Set up automations that search for new jobs on a schedule and AI-match them against your resume, so relevant openings come to you.

- **Greenhouse** — track specific companies by name from a built-in directory (or by pasting a board URL). Each run pulls every published role from those companies' Greenhouse boards, ranks them against your target titles, skills, and resume with a fast local relevance score, and runs the AI match on only the top candidates to keep costs bounded. No API key required.

- **Lever** — same company-tracking workflow as Greenhouse, backed by a built-in directory of 1,160+ companies (or paste a board URL). Automatically resolves the right regional API (`lever.co` or `eu.lever.co`) per company and carries full remote/hybrid/onsite signal from the listing. No API key required.

More job board sources are on the way. Discovered jobs are surfaced for review — accept the ones you like to promote them into your job tracker, or dismiss the rest.

### 岗位录入 API

在“设置 → API 接入”中创建访问令牌后，外部 AI 工具或脚本可以调用 `POST /api/local/jobs` 录入岗位。请求使用 `Authorization: Bearer <令牌>` 鉴权，支持职位、公司、地点、职位描述、薪资、来源、原始链接和标签等字段。

API 只负责岗位录入，不提供自动投递能力。系统会统一执行名称解析、链接标准化和重复检查，投递仍由用户在页面中确认。


## Contributing

We welcome contributions! Please read our [Contributing Guidelines](./CONTRIBUTING.md) to get started. This project follows a [Code of Conduct](./CODE_OF_CONDUCT.md) — by participating, you agree to uphold its standards.

### Credits

- <a href="https://github.com/facebook/react">React</a>
- <a href="https://github.com/vercel/next.js">Next</a>
- <a href="https://github.com/shadcn-ui/ui">Shadcn</a>
- <a href="https://github.com/prisma/prisma">Prisma</a>
- <a href="https://github.com/tailwindlabs/tailwindcss">Tailwind</a>
- <a href="https://github.com/ueberdosis/tiptap">Tiptap</a>
- <a href="https://github.com/plouc/nivo">Nivo</a>
- <a href="https://github.com/sqlite/sqlite">Sqlite</a>
- <a href="https://github.com/vercel/ai">Vercel AI-SDK</a>
- <a href="https://github.com/ollama/ollama">Ollama</a>

### Supported AI Model Providers

API keys for all cloud providers can be configured in **Settings > AI Settings** after signing in. Ollama is selected as the default provider.

> **Note:** Selected models must support **structured output** for AI features to work correctly.

<details>
<summary><strong>Ollama (Local)</strong></summary>

Works with [Ollama](https://ollama.com) to run AI models locally on your machine.

- Make sure Ollama is installed and running on the same system
- AI settings will show a list of available models based on what you have downloaded in Ollama
- **Recommended:** Increase the Ollama context length from the default 4k for better results
- No API key required — runs entirely on your hardware
- If you are running jobsync on a homelab server, you can expose ollama to network from Ollama settings on your local machine. Also make sure your ollama base url is pointed to your local system IP under API keys section of settings.

</details>

<details>
<summary><strong>OpenAI</strong></summary>

- Get your API key at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Add your API key in **Settings > AI Settings**
- Select **OpenAI** as the provider and choose your preferred model
- Available models are fetched dynamically from the OpenAI API

</details>

<details>
<summary><strong>DeepSeek</strong></summary>

- Get your API key at [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys)
- Add your API key in **Settings > AI Settings**
- Select **DeepSeek** as the provider and choose your preferred model

</details>

<details>
<summary><strong>Google Gemini</strong></summary>

- Get your API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- Add your API key in **Settings > AI Settings**
- Select **Gemini** as the provider and choose your preferred model

</details>

<details>
<summary><strong>OpenRouter</strong></summary>

Access a wide range of AI models from multiple providers through a single API.

- Get your API key at [openrouter.ai/keys](https://openrouter.ai/keys)
- Add your API key in **Settings > AI Settings**
- Select **OpenRouter** as the provider and choose from available models

</details>

### Note

- If you are updating from an old version and already logged in, please try logging out and login again.

## Support the Project

If JobSync has been helpful in your job search, consider giving it a star on GitHub! It helps others discover the project and motivates continued development.

[![GitHub Stars](https://img.shields.io/github/stars/Gsync/jobsync?style=social)](https://github.com/Gsync/jobsync)

Every star means a lot — thank you for your support!

