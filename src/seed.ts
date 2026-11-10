import type { Db } from "./db.js";

const DAY_MS = 86_400_000;

/**
 * Fake data for a fictional store. Dates are relative to the moment of seeding so
 * each scenario keeps behaving the same way however long after install you demo it.
 */
export function seed(db: Db): void {
  const now = Date.now();
  const daysAgo = (days: number | null) =>
    days === null ? null : new Date(now - days * DAY_MS).toISOString();

  const customers = [
    ["CUS-1001", "Maya Chen", "maya.chen@example.com", "plus"],
    ["CUS-1002", "Daniel Okafor", "daniel.okafor@example.com", "standard"],
    ["CUS-1003", "Priya Raman", "priya.raman@example.com", "plus"],
    ["CUS-1004", "Tom Alvarez", "tom.alvarez@example.com", "standard"],
    ["CUS-1005", "Sofia Rossi", "sofia.rossi@example.com", "standard"],
    ["CUS-1006", "Liam Walsh", "liam.walsh@example.com", "standard"],
  ] as const;

  // id, customer, status, ordered, shipped, delivered (days ago), carrier, tracking
  const orders = [
    // Eligible for a full refund.
    ["ORD-5001", "CUS-1001", "delivered", 11, 9, 6, "Parcelway", "PW100482211"],
    // Outside the 30-day window.
    ["ORD-5002", "CUS-1002", "delivered", 52, 50, 45, "Parcelway", "PW100377940"],
    // Refundable, but above the supervisor limit.
    ["ORD-5003", "CUS-1003", "delivered", 10, 7, 4, "FreightLine", "FL774120563"],
    // In transit and running late.
    ["ORD-5004", "CUS-1004", "shipped", 12, 9, null, "Parcelway", "PW100519006"],
    // Contains a final-sale item and has a previous partial refund.
    ["ORD-5005", "CUS-1005", "delivered", 16, 14, 10, "Parcelway", "PW100460718"],
    // Not shipped yet.
    ["ORD-5006", "CUS-1006", "processing", 1, null, null, null, null],
  ] as const;

  // order, sku, name, quantity, unit price in cents, final sale
  const items = [
    ["ORD-5001", "AUD-220", "Wireless Headphones", 1, 8900, 0],
    ["ORD-5001", "CBL-014", "Braided USB-C Cable", 1, 1450, 0],
    ["ORD-5002", "BAG-310", "Canvas Commuter Backpack", 1, 12000, 0],
    ["ORD-5003", "DSK-900", "Electric Standing Desk", 1, 41200, 0],
    ["ORD-5004", "KIT-455", "Burr Coffee Grinder", 1, 14900, 0],
    ["ORD-5005", "APP-118", "Linen Shirt", 1, 6000, 0],
    ["ORD-5005", "APP-702", "Clearance Wool Scarf", 1, 2500, 1],
    ["ORD-5006", "KEY-640", "Mechanical Keyboard", 1, 12900, 0],
  ] as const;

  // id, customer, order, subject, body, priority, days ago
  const tickets = [
    [1001, "CUS-1001", "ORD-5001", "Headphones arrived damaged",
      "The left earcup on my headphones was cracked when I opened the box. The cable is fine. Can I get my money back for the headphones?",
      "high", 1],
    [1002, "CUS-1002", "ORD-5002", "Want to return my backpack",
      "The backpack is smaller than I expected. I'd like to return it for a refund.",
      "normal", 2],
    [1003, "CUS-1003", "ORD-5003", "Desk motor stopped working",
      "My standing desk stopped raising after two days. I want a full refund and for someone to collect it.",
      "high", 1],
    [1004, "CUS-1004", "ORD-5004", "Where is my grinder?",
      "My order shipped more than a week ago and tracking hasn't moved in days. When will it arrive?",
      "normal", 1],
    [1005, "CUS-1005", "ORD-5005", "Refund for the scarf",
      "The scarf isn't the color shown on the website. Please refund it.",
      "low", 3],
  ] as const;

  const insertCustomer = db.prepare("INSERT INTO customers (id, name, email, tier) VALUES (?, ?, ?, ?)");
  for (const row of customers) insertCustomer.run(...row);

  const insertOrder = db.prepare(`
    INSERT INTO orders (id, customer_id, status, ordered_at, shipped_at, delivered_at, carrier, tracking)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const [id, customer, status, ordered, shipped, delivered, carrier, tracking] of orders) {
    insertOrder.run(id, customer, status, daysAgo(ordered), daysAgo(shipped), daysAgo(delivered), carrier, tracking);
  }

  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, sku, name, quantity, unit_price_cents, final_sale)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const row of items) insertItem.run(...row);

  db.prepare("INSERT INTO refunds (id, order_id, amount_cents, reason, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(2001, "ORD-5005", 2000, "goodwill", daysAgo(5));

  const insertTicket = db.prepare(`
    INSERT INTO tickets (id, customer_id, order_id, subject, body, priority, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'open', ?)
  `);
  for (const [id, customer, order, subject, body, priority, opened] of tickets) {
    insertTicket.run(id, customer, order, subject, body, priority, daysAgo(opened));
  }
}
