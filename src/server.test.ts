import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const entryPoint = fileURLToPath(new URL("./index.js", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "helpdesk-test-"));
const dbPath = join(directory, "test.db");

async function connect() {
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [entryPoint],
      env: { ...process.env, HELPDESK_DB: dbPath } as Record<string, string>,
      stderr: "ignore",
    }),
  );
  return client;
}

describe("helpdesk MCP server over stdio", () => {
  let client: Client;

  async function call(name: string, args: Record<string, unknown>) {
    const result = await client.callTool({ name, arguments: args });
    const [first] = result.content as { type: string; text: string }[];
    const text = first?.text ?? "";
    let data: any = text;
    try {
      data = JSON.parse(text);
    } catch {
      // Input validation errors from the SDK are plain text.
    }
    return { isError: Boolean(result.isError), data };
  }

  before(async () => {
    client = await connect();
  });

  after(async () => {
    await client.close();
    rmSync(directory, { recursive: true, force: true });
  });

  it("advertises tools, the policy resource, and the prompt", async () => {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map((tool) => tool.name).sort(), [
      "find_customer",
      "issue_refund",
      "list_tickets",
      "lookup_order",
      "open_ticket",
    ]);

    const { resources } = await client.listResources();
    assert.deepEqual(resources.map((resource) => resource.uri), ["helpdesk://policies/refunds"]);
    const policy = await client.readResource({ uri: "helpdesk://policies/refunds" });
    const [policyContent] = policy.contents;
    assert.ok(policyContent && "text" in policyContent);
    assert.match(policyContent.text, /30 days of delivery/);

    const { prompts } = await client.listPrompts();
    assert.deepEqual(prompts.map((prompt) => prompt.name), ["draft_reply"]);
  });

  it("finds customers and treats LIKE wildcards literally", async () => {
    const found = await call("find_customer", { query: "maya.chen" });
    assert.equal(found.data.matches[0].id, "CUS-1001");
    assert.deepEqual(found.data.matches[0].order_ids, ["ORD-5001"]);

    const wildcard = await call("find_customer", { query: "%%" });
    assert.equal(wildcard.data.matches.length, 0);
  });

  it("lists open tickets, most urgent first", async () => {
    const { data } = await call("list_tickets", {});
    assert.equal(data.tickets.length, 5);
    assert.equal(data.tickets[0].priority, "high");
    assert.equal(data.tickets.at(-1).priority, "low");

    const scoped = await call("list_tickets", { customer_id: "cus-1004" });
    assert.deepEqual(scoped.data.tickets.map((ticket: any) => ticket.id), ["TCK-1004"]);
  });

  it("issues a refund, then enforces the remaining balance", async () => {
    const refund = await call("issue_refund", { order_id: "ord-5001", amount_cents: 8900, reason: "damaged" });
    assert.equal(refund.isError, false);
    assert.equal(refund.data.amount, "$89.00");
    assert.equal(refund.data.remaining_on_order, "$14.50");

    const order = await call("lookup_order", { order_id: "ORD-5001" });
    assert.equal(order.data.refunds.length, 1);
    assert.equal(order.data.refund_status.remaining_cents, 1450);

    const tooMuch = await call("issue_refund", { order_id: "ORD-5001", amount_cents: 1451, reason: "damaged" });
    assert.equal(tooMuch.isError, true);
    assert.equal(tooMuch.data.error.code, "AMOUNT_EXCEEDS_REFUNDABLE");
  });

  it("rejects refunds outside the window or before delivery", async () => {
    const expired = await call("issue_refund", { order_id: "ORD-5002", amount_cents: 100, reason: "changed_mind" });
    assert.equal(expired.data.error.code, "WINDOW_EXPIRED");

    const inTransit = await call("issue_refund", { order_id: "ORD-5004", amount_cents: 100, reason: "other" });
    assert.equal(inTransit.data.error.code, "NOT_DELIVERED");

    const processing = await call("issue_refund", { order_id: "ORD-5006", amount_cents: 100, reason: "other" });
    assert.equal(processing.data.error.code, "NOT_DELIVERED");
  });

  it("excludes final-sale items and counts earlier refunds", async () => {
    const order = await call("lookup_order", { order_id: "ORD-5005" });
    assert.equal(order.data.refund_status.refundable_value, "$60.00");
    assert.equal(order.data.refund_status.remaining_cents, 4000);

    const scarf = await call("issue_refund", { order_id: "ORD-5005", amount_cents: 4001, reason: "not_as_described" });
    assert.equal(scarf.data.error.code, "AMOUNT_EXCEEDS_REFUNDABLE");
  });

  it("requires a supervisor above the limit, even when the refund is split", async () => {
    const full = await call("issue_refund", { order_id: "ORD-5003", amount_cents: 41200, reason: "defective" });
    assert.equal(full.data.error.code, "SUPERVISOR_REQUIRED");

    const first = await call("issue_refund", { order_id: "ORD-5003", amount_cents: 25000, reason: "defective" });
    assert.equal(first.isError, false);

    const second = await call("issue_refund", { order_id: "ORD-5003", amount_cents: 1, reason: "defective" });
    assert.equal(second.data.error.code, "SUPERVISOR_REQUIRED");
  });

  it("rejects invalid input and unknown orders", async () => {
    const negative = await call("issue_refund", { order_id: "ORD-5001", amount_cents: -5, reason: "damaged" });
    assert.equal(negative.isError, true);

    const fractional = await call("issue_refund", { order_id: "ORD-5001", amount_cents: 10.5, reason: "damaged" });
    assert.equal(fractional.isError, true);

    const missing = await call("lookup_order", { order_id: "ORD-9999" });
    assert.equal(missing.data.error.code, "ORDER_NOT_FOUND");
  });

  it("opens tickets only against the customer's own orders", async () => {
    const mismatch = await call("open_ticket", {
      customer_id: "CUS-1001",
      order_id: "ORD-5002",
      subject: "Wrong order",
      body: "This order belongs to someone else.",
    });
    assert.equal(mismatch.data.error.code, "ORDER_CUSTOMER_MISMATCH");

    const created = await call("open_ticket", {
      customer_id: "CUS-1003",
      order_id: "ORD-5003",
      subject: "Supervisor approval needed",
      body: "Customer requests a full refund of $412.00 for a defective desk.",
      priority: "urgent",
    });
    assert.equal(created.isError, false);
    assert.equal(created.data.id, "TCK-1006");
    assert.equal(created.data.status, "open");
  });

  it("builds a draft_reply prompt from live data and rejects unknown tickets", async () => {
    const prompt = await client.getPrompt({ name: "draft_reply", arguments: { ticket_id: "TCK-1001", tone: "apologetic" } });
    const content = prompt.messages[0]?.content;
    assert.equal(content?.type, "text");
    const text = content?.type === "text" ? content.text : "";
    assert.match(text, /apologetic/);
    assert.match(text, /Headphones arrived damaged/);
    assert.match(text, /RFD-2002/);
    assert.match(text, /Refund policy|refund policy/);

    await assert.rejects(client.getPrompt({ name: "draft_reply", arguments: { ticket_id: "TCK-404" } }), /No ticket found/);
  });

  it("keeps data after the server restarts", async () => {
    await client.close();
    client = await connect();

    const order = await call("lookup_order", { order_id: "ORD-5001" });
    assert.equal(order.data.refunds.length, 1);
    const { data } = await call("list_tickets", { status: "all" });
    assert.equal(data.tickets.length, 6);
  });
});
