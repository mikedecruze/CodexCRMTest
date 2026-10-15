// Isolated, in-memory synthetic backend used only by Playwright.
import { openDb } from "./db.ts";
import { seed } from "./seed.ts";
import { createApp } from "./app.ts";
const db = openDb(":memory:");
seed(db);
createApp(db, { demo: true, origin: "http://localhost:5174" }).listen(
  3002,
  "127.0.0.1",
);
