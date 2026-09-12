# 0001. 废弃内部 MCP 与冗余 CLI 脚本，改用纯净本地 REST API 录入岗位

早期系统为复用上游 MCP 工具，在本地脚本中通过 HTTP 回环自调 MCP 端点录入岗位，导致架构割裂、依赖未就绪的 Web 服务，并在仓库中留存了大量与当前网页控制台脱节的 CLI 脚本。我们决定彻底废弃内部对 MCP 的调用依赖与冗余 CLI 脚本，提供轻量、标准的本地 REST API (`POST /api/local/jobs`) 作为对外录入通道，数据写入统一收敛至内部业务函数。

## Considered Options

- **选项 A（维持现状）**：继续保留自调 MCP 回环与多套终端 harvest 脚本。
- **选项 B（纯净 REST API）**：废弃内部 MCP 自调用与冗余 CLI，网页与外部程序统一通过标准 JSON REST API 录入岗位。

## Consequences

- 内部代码库不再需要伪装成外部 Agent 发起 HTTP 请求，内部数据流完全直连。
- 清理 8+ 个早期的废弃 CLI 脚本及相关 npm 命令，代码结构大幅减负。
- 任何外部工具（包括但不限于 AI Agent、浏览器脚本、Python）均可以最标准的 HTTP POST 方式录入岗位，不绑定任何专有协议。
