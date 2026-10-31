# 本地与独立 Registry 部署准备

本次实际验收在 macOS 本机完成；以下容器/云端方案是准备好的部署入口，未构建镜像或部署云主机，不计入已通过测试。

本地分别运行 npm start / npm run registry，默认 loopback。开发服务随终端、机器关机或睡眠可能中断；每次体验前检查两个 /health 的 service 名称与版本，不只看 200。

自托管 Registry 使用相同源码，执行 node src/registry-server.js，挂载独立 TASKDOCK_DATA_DIR。REGISTRY_HOST=0.0.0.0 时必须通过私密环境文件注入至少 32 字符 TASKDOCK_REGISTRY_TOKEN，HTTP 客户端使用 Bearer token。本地端设置 TASKDOCK_REGISTRY_URL 与相同 registry token。

Dockerfile 提供 Node 24 与 Git，默认启动本地控制面；作为 Registry 镜像时覆盖 command 为 node src/registry-server.js。持久化 /app/.data，环境文件不得进镜像。公网入口应经 HTTPS 反向代理。当前模式为一个维护者与一份共享 token；它不是开放注册的社区身份系统。

正式公开前的必要后续工作：用户与发布者身份、包签名/来源校验、内容与权限审核、多租户 ACL、限流与配额、审计与备份恢复演练、沙箱和网络策略。先在私有测试部署完成真实模型/外部 MCP/目标设备验收，再由维护者执行正式发布。
