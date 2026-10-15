import { openDb } from "./db.ts";
import { seed } from "./seed.ts";
import { createApp } from "./app.ts";
const demo = process.env.TROVE_DEMO === "1";
if (demo && process.env.NODE_ENV === "production")
  throw new Error("Demo authentication cannot run in production.");
const db = openDb(process.env.TROVE_DB_PATH || ".data/trove.sqlite");
// Never inject demo identities or synthetic data into an Entra-configured store.
if (demo) seed(db);
const port = Number(process.env.PORT || 3001);
const app = createApp(db, {
  demo,
  production: process.env.NODE_ENV === "production",
  origin: process.env.TROVE_ORIGIN || "http://localhost:5173",
  tenantId: process.env.TROVE_ENTRA_TENANT_ID,
  clientId: process.env.TROVE_ENTRA_CLIENT_ID,
  clientSecret: process.env.TROVE_ENTRA_CLIENT_SECRET,
  redirectUri: process.env.TROVE_ENTRA_REDIRECT_URI,
});
const server = app.listen(port, "127.0.0.1", () =>
  console.log(
    `Trove API listening on ${port}; ${demo ? "SYNTHETIC DEMO — no real client data" : "Entra authentication required"}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
