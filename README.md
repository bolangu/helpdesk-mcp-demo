# Help Desk MCP demo

A demo [Model Context Protocol](https://modelcontextprotocol.io) server for a fictional store's customer support team. Claude can look up customers and orders, issue refunds under policy, open tickets, and draft replies. Data is stored in SQLite.

## Slides and video

- [Slides (PDF)](docs/help-desk-mcp-server-slides.pdf): architecture, how a request reaches SQLite, the refund rules, setup in Claude Desktop, and two demos.
- [Walkthrough video (MP4, about 6.5 minutes)](docs/help-desk-mcp-server.mp4): the same material with narration.

| Type | Name | What it does |
|---|---|---|
| Tool | `find_customer` | Searches customers by name or email |
| Tool | `lookup_order` | Returns an order's status, items, refunds, and refund eligibility |
| Tool | `issue_refund` | Records a refund if the policy allows it |
| Tool | `open_ticket` | Creates a support ticket |
| Tool | `list_tickets` | Lists tickets, most urgent first |
| Resource | `helpdesk://policies/refunds` | The refund policy, in Markdown |
| Prompt | `draft_reply` | Builds a reply prompt from a ticket, its order, and the policy |

## Setup

You need **Node.js 22.13 or later**. SQLite comes from Node's built-in `node:sqlite` module, so there is no native package to compile. Node prints an `ExperimentalWarning` about it to stderr, which is harmless.

```bash
npm install
npm run build
npm test        # optional: runs the built server through a real MCP client
```

The database is created and filled with demo data the first time the server starts, at `data/helpdesk.db`.

## Try it

### MCP Inspector

```bash
npm run inspect
```

This opens a browser UI where you can call each tool and view the resource and prompt.

### Claude Desktop

In Claude Desktop, go to **Settings > Developer > Edit Config** and add this server, using the absolute path to this folder:

```json
{
  "mcpServers": {
    "helpdesk": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-helpdesk/dist/index.js"]
    }
  }
}
```

Quit and restart Claude Desktop. If it can't find `node` (common with nvm), set `command` to the full path from `which node`, or `where node` on Windows.

### Claude Code

The included `.mcp.json` registers the server for this project. After building, start `claude` in this folder and approve the `helpdesk` server when asked.

## Demo script

| Ask Claude | What happens |
|---|---|
| "What support tickets are open?" | Lists five tickets, ordered by priority |
| "Handle TCK-1001 and refund what the customer is entitled to." | Refunds $89.00 for the damaged headphones, leaving the undamaged cable's $14.50 alone |
| "Refund Daniel Okafor's backpack." | Rejected because the order is outside the 30-day window |
| "Priya Raman wants a full refund on her desk." | Rejected at $412.00 because it needs a supervisor, so Claude can open an urgent ticket |
| "Sofia Rossi wants her scarf refunded." | The scarf is final sale, so it can't be refunded |
| "Where is Tom Alvarez's grinder?" | Shows carrier and tracking, and that it hasn't been delivered |
| Use the `draft_reply` prompt with `TCK-1001` | Drafts an email based on the live order record, including any refund you just issued |

Demo data is regenerated with dates relative to the current time, so these scenarios keep working. To restore it after a demo:

```bash
npm run reset
```

## How it's organized

| File | Purpose |
|---|---|
| `src/index.ts` | Starts the server on stdio |
| `src/server.ts` | Tools, resource, prompt, and refund rules |
| `src/policy.ts` | Refund limits and the policy text generated from them |
| `src/db.ts` | SQLite connection, schema, and transactions |
| `src/seed.ts` | Demo customers, orders, refunds, and tickets |
| `src/server.test.ts` | End-to-end tests over stdio |

Set the `HELPDESK_DB` environment variable to store the database somewhere else.

This is a demo: there is no authentication, and refunds only write a row to SQLite.
