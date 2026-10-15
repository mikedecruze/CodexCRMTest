// Explicit synthetic-data entry point. The normal API entry point never enables demo auth.
if (process.env.NODE_ENV === "production")
  throw new Error("Demo mode cannot run in production.");
process.env.TROVE_DEMO = "1";
await import("./index.ts");
