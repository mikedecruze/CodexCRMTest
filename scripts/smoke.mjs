// Functional readiness check for the explicitly synthetic local application.
const origin = process.env.TROVE_ORIGIN || "http://localhost:5173";
let cookie = "";
async function call(path, body) {
  const response = await fetch(`${origin}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(`Readiness request ${path} failed (${response.status}).`);
  const session = response.headers
    .getSetCookie()
    .find((c) => c.startsWith("trove_session="));
  if (session) cookie = session.split(";")[0];
  return data;
}
const health = await call("/health");
if (!health.ok) throw new Error("Database readiness failed.");
const config = await call("/auth/config");
if (!config.demo)
  throw new Error("This readiness script is for synthetic demo mode only.");
const employee = config.personas.find((p) => p.displayName === "James Carter");
if (!employee)
  throw new Error("Expected synthetic readiness identity is absent.");
await call("/auth/demo", { employeeId: employee.id });
try {
  const boot = await call("/bootstrap");
  if (boot.user.id !== employee.id)
    throw new Error("Authenticated identity did not match.");
  const directory = await call("/groups");
  if (!Array.isArray(directory.items))
    throw new Error("Client directory failed.");
  if (directory.items.length) {
    const detail = await call(`/groups/${directory.items[0].id}`);
    const visible = new Set(
      [...detail.people, ...detail.entities, ...detail.advisors].map(
        (p) => p.id,
      ),
    );
    if (
      detail.group.id !== directory.items[0].id ||
      !Array.isArray(detail.households)
    )
      throw new Error("Profile readiness failed.");
    const financial = await call(`/groups/${detail.group.id}/financials`);
    if (
      !financial.summary ||
      !Array.isArray(financial.lines) ||
      financial.dataMode !== "MOCK_FABRIC"
    )
      throw new Error("Financial profile readiness failed.");
    if (
      !financial.canViewProfitability &&
      (Object.hasOwn(financial.summary, "laborCost") ||
        financial.lines.some((l) => Object.hasOwn(l, "laborCost")))
    )
      throw new Error("Profitability data was not redacted.");
    if (
      !detail.relationships.every(
        (r) => visible.has(r.sourceId) && visible.has(r.targetId),
      )
    )
      throw new Error("Graph contains an unscoped endpoint.");
  }
  console.log(
    "PASS: live authentication, authorized directory, persistent profile, scoped relationship graph and financial history.",
  );
} finally {
  await call("/auth/logout", {});
}
