# Contributing to TaskDock

English · 中文说明见下文。

Thank you for helping make reusable task agents dependable. Start small: describe a real task, reproduce a bug, improve a translation, or propose one integration.

## Run locally

Use Node.js 24+ and Git. Run `npm ci`, `npm test`, and `npm run check`. Use `npm run local:start` and `npm run demo:reliability` for the local demo; stop it with `npm run local:stop`.

## Before changing behavior

Read [AGENTS.md](AGENTS.md), the [architecture](docs/ARCHITECTURE.md), [protocol](docs/PROTOCOL.md), and [reliability contracts](docs/RELIABILITY.md). Update contracts before implementation. Keep each request's input, snapshot, events, tool receipts, and artifacts private to that request. Learning must produce a proposal; stable releases require a passing test for the exact digest.

## Pull requests

Describe the problem, resulting behavior, and evidence. Explain the verification layer: unit, protocol, browser automation, native automation, or human acceptance. Do not call mocked provider responses live-model validation. Include a regression check for meaningful behavior changes; do not add tests that merely restate low-impact implementation details.

Use uncontrolled form inputs. Do not replace focused editable nodes after an asynchronous response. Keep translation changes separate from user-authored content and protocol identifiers.

Never commit runtime data, histories, credentials, `.env`, backups, or browser artifacts. Redact reports before opening an issue. Contributions are provided under the project's MIT license; retain third-party notices.

## 中文

欢迎提交真实场景、问题复现、翻译与小范围集成。开发需要 Node 24+ 与 Git；提交前执行 `npm test` 和 `npm run check`。改协议前先更新契约文档，严格保留请求隔离、固定版本与审核晋级。测试报告注明测试层，模拟模型响应不能称为真实模型验收。不要上传请求历史、密钥、环境文件或浏览器产物。贡献沿用项目 MIT 协议。
