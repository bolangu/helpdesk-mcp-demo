import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { seed } from "./seed.js";

export type Db = DatabaseSync;

// Resolved from this file, not the working directory: MCP clients often launch
// servers from somewhere unrelated to the project.
const DEFAULT_DB_PATH = fileURLToPath(new URL("../data/helpdesk.db", import.meta.url));

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 3000;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS customers (
    id    TEXT PRIMARY KEY,
    name  TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    tier  TEXT NOT NULL CHECK (tier IN ('standard', 'plus'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id           TEXT PRIMARY KEY,
    customer_id  TEXT NOT NULL REFERENCES customers(id),
    status       TEXT NOT NULL CHECK (status IN ('processing', 'shipped', 'delivered', 'cancelled')),
    ordered_at   TEXT NOT NULL,
    shipped_at   TEXT,
    delivered_at TEXT,
    carrier      TEXT,
    tracking     TEXT
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id         TEXT NOT NULL REFERENCES orders(id),
    sku              TEXT NOT NULL,
    name             TEXT NOT NULL,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    final_sale       INTEGER NOT NULL DEFAULT 0 CHECK (final_sale IN (0, 1))
  );

  CREATE TABLE IF NOT EXISTS refunds (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     TEXT NOT NULL REFERENCES orders(id),
    amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
    reason       TEXT NOT NULL,
    created_at   TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    order_id    TEXT REFERENCES orders(id),
    subject     TEXT NOT NULL,
    body        TEXT NOT NULL,
    priority    TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status      TEXT NOT NULL CHECK (status IN ('open', 'pending', 'closed')),
    created_at  TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
  CREATE INDEX IF NOT EXISTS idx_refunds_order ON refunds(order_id);
  CREATE INDEX IF NOT EXISTS idx_tickets_customer ON tickets(customer_id);
`;

/** Runs `fn` in a write transaction, so checks and writes can't interleave with another process. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function openDatabase(path: string = process.env.HELPDESK_DB ?? DEFAULT_DB_PATH): Db {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);

  const { count } = db.prepare("SELECT COUNT(*) AS count FROM customers").get() as { count: number };
  if (count === 0) transaction(db, () => seed(db));
  return db;
}

/** Restores the original demo data. Dates are regenerated relative to now. */
export function resetDatabase(db: Db): void {
  transaction(db, () => {
    db.exec(`
      DELETE FROM refunds;
      DELETE FROM tickets;
      DELETE FROM order_items;
      DELETE FROM orders;
      DELETE FROM customers;
      DELETE FROM sqlite_sequence;
    `);
    seed(db);
  });
}
