# Security

TaskDock is an early-preview, local-first service for a single maintainer. Caller session capabilities isolate application requests; they do not protect data from the local administrator or malicious code on the same OS account.

- Keep the default loopback binding. Non-loopback hosting requires strong service tokens and an independently reviewed deployment setup.
- Store credentials only in local environment files with restricted permissions. Do not put secrets into manifests, issues, screenshots, or shared capability packages.
- Review MCP endpoints and tool allowlists. This project does not provide an OS sandbox for arbitrary plugins.
- Uncertain external tool outcomes require reconciliation. Never bypass that state merely to make a request appear successful.

Do not disclose exploitable details, tokens, or request histories in a public issue. Use GitHub's private vulnerability reporting if enabled; otherwise open a minimal issue requesting a private contact without exploit details or private data. There is no guaranteed response SLA.

中文：本项目是单维护者本地预览版，不是恶意代码沙箱或生产多租户平台。保持回环地址绑定，凭据只存本地环境。公开 issue 不得含漏洞利用细节、密钥或运行历史；优先使用仓库私密漏洞报告（如已启用），否则仅请求建立私密联系。
