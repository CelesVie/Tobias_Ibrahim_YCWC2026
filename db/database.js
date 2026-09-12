const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Vercel hanya menyediakan filesystem yang dapat ditulis secara sementara di /tmp.
const dbPath = process.env.DATABASE_PATH || (
  process.env.VERCEL
    ? path.join(os.tmpdir(), 'transactions.db')
    : path.join(__dirname, '..', 'transactions.db')
);
const isNewDb = !fs.existsSync(dbPath);

const db = new DatabaseSync(dbPath);

// Create Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT CHECK(type IN ('INCOME', 'EXPENSE')) NOT NULL,
    amount REAL NOT NULL,
    category TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
  CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
`);

module.exports = {
  db,
  isNewDb
};
