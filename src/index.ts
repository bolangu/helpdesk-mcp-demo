#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { openDatabase } from "./db.js";
import { createServer } from "./server.js";

// stdout carries the MCP protocol, so diagnostics must only go to stderr.
try {
  const server = createServer(openDatabase());
  await server.connect(new StdioServerTransport());
  console.error("helpdesk-demo MCP server running on stdio");
} catch (error) {
  console.error("Failed to start helpdesk-demo:", error);
  process.exit(1);
}
