import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer, httpCaller } from "./mcp.js";
const base = process.env.TASKDOCK_URL || "http://127.0.0.1:4640";
const server = createMcpServer(
  httpCaller(base, process.env.TASKDOCK_API_TOKEN),
);
await server.connect(new StdioServerTransport());
