// data/store.js
//
// A minimal file-backed JSON store. We use this instead of a real database
// engine (Postgres/Mongo) so the project runs anywhere with just `node` and
// `npm install` — no external DB server, no native bindings to compile.
// For a production deployment, swap `readTable`/`writeTable` for real
// queries; every place that touches persistence goes through this module.

const fs = require("fs");
const path = require("path");

const DB_DIR = path.join(__dirname, "db");
const TABLES = ["users", "bookings"];

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  for (const table of TABLES) {
    const file = path.join(DB_DIR, `${table}.json`);
    if (!fs.existsSync(file)) fs.writeFileSync(file, "[]", "utf-8");
  }
}

function readTable(table) {
  ensureDb();
  const file = path.join(DB_DIR, `${table}.json`);
  const raw = fs.readFileSync(file, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeTable(table, rows) {
  ensureDb();
  const file = path.join(DB_DIR, `${table}.json`);
  fs.writeFileSync(file, JSON.stringify(rows, null, 2), "utf-8");
}

function readJsonAsset(filename) {
  const file = path.join(__dirname, filename);
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function writeJsonAsset(filename, value) {
  const file = path.join(__dirname, filename);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf-8");
}

module.exports = { readTable, writeTable, readJsonAsset, writeJsonAsset, ensureDb };
