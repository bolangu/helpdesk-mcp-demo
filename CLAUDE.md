# Help Desk MCP demo

A demo MCP server for a fictional store's support team. TypeScript, stdio transport, SQLite through Node's built-in `node:sqlite`. Requires Node 22.13 or later.

## Commands

- `npm run build`: compile to `dist/`
- `npm test`: build, then run end-to-end tests through a real MCP client over stdio, using a temporary database
- `npm run reset`: restore the demo data in `data/helpdesk.db`
- `npm run inspect`: open MCP Inspector against the built server

## Layout

- `src/index.ts`: stdio entry point
- `src/server.ts`: tools, resource, prompt, and refund rules (`refundState`, `issue_refund`)
- `src/policy.ts`: refund limits and the policy text generated from them
- `src/db.ts`: connection, schema, transactions, reset
- `src/seed.ts`: demo data
- `src/server.test.ts`: end-to-end tests

## Rules

- Never write to stdout from the server. It carries the MCP protocol, so diagnostics go to stderr.
- Store and calculate money as integer cents. Use `usd()` only for display.
- Change refund limits in `src/policy.ts`, so the published policy and the enforced rules stay in sync.
- Keep the checks and writes in `issue_refund` inside one transaction.
- Enforce refund rules on the server. Don't rely on tool descriptions or the model to follow them.
- Seed dates are relative to seeding time. The tests and the README demo script depend on each seeded scenario, so update them together.
- The default database path is resolved from the module location because MCP clients may launch the server from any directory.

## Status

All 11 tests pass on Linux with Node 22. The project has not been run on Windows or inside Claude Desktop yet, so on a new machine start with `npm install` and `npm test`.
