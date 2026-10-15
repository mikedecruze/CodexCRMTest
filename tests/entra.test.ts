import { afterEach, beforeEach, expect, it, vi } from "vitest";
import request from "supertest";
import { generateKeyPairSync, sign } from "node:crypto";
import { openDb, type Db } from "../server/db.ts";
import { seed, seedId } from "../server/seed.ts";
import { createApp } from "../server/app.ts";
const tenant = "11111111-1111-4111-a111-111111111111",
  clientId = "22222222-2222-4222-a222-222222222222",
  oid = "33333333-3333-4333-a333-333333333333";
const issuer = `https://login.microsoftonline.com/${tenant}/v2.0`,
  base = "https://trove.example";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
let db: Db,
  nonce = "",
  claimsOverride: Record<string, unknown> = {},
  badSignature = false,
  observedVerifier = "",
  app: ReturnType<typeof createApp>;
const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
beforeEach(() => {
  db = openDb(":memory:");
  seed(db);
  db.prepare("UPDATE employee SET subject=? WHERE id=?").run(
    `${tenant}:${oid}`,
    seedId("james"),
  );
  nonce = "";
  claimsOverride = {};
  badSignature = false;
  observedVerifier = "";
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes(".well-known/openid-configuration"))
        return json({
          issuer,
          authorization_endpoint: `${issuer}/authorize`,
          token_endpoint: `${issuer}/token`,
          jwks_uri: `${issuer}/keys`,
          id_token_signing_alg_values_supported: ["RS256"],
          response_types_supported: ["code"],
        });
      if (url.endsWith("/keys"))
        return json({
          keys: [
            {
              ...keys.publicKey.export({ format: "jwk" }),
              kid: "fixture-key",
              use: "sig",
              alg: "RS256",
            },
          ],
        });
      if (url.endsWith("/token")) {
        observedVerifier =
          new URLSearchParams(String(init?.body)).get("code_verifier") || "";
        const header = Buffer.from(
            JSON.stringify({ alg: "RS256", kid: "fixture-key" }),
          ).toString("base64url"),
          payload = Buffer.from(
            JSON.stringify({
              iss: issuer,
              aud: clientId,
              sub: "opaque-subject",
              tid: tenant,
              oid,
              nonce,
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 300,
              ...claimsOverride,
            }),
          ).toString("base64url"),
          data = `${header}.${payload}`,
          signature = sign("RSA-SHA256", Buffer.from(data), keys.privateKey);
        if (badSignature) signature[0] ^= 255;
        return json({
          access_token: "synthetic-access-token",
          token_type: "Bearer",
          expires_in: 300,
          id_token: `${data}.${signature.toString("base64url")}`,
        });
      }
      throw new Error("Unexpected auth destination");
    }),
  );
  app = createApp(db, {
    demo: false,
    origin: base,
    tenantId: tenant,
    clientId,
    clientSecret: "synthetic-test-secret",
    redirectUri: `${base}/auth/callback`,
  });
});
afterEach(() => {
  db.close();
  vi.unstubAllGlobals();
});
async function start() {
  const r = await request(app).get("/auth/entra").expect(302),
    url = new URL(r.headers.location);
  nonce = url.searchParams.get("nonce")!;
  expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  expect(url.searchParams.get("redirect_uri")).toBe(`${base}/auth/callback`);
  return url.searchParams.get("state")!;
}
function callback(state: string) {
  return request(app)
    .get(`/auth/callback?state=${state}&code=fixture-code`)
    .set("Cookie", `trove_oidc=${state}`);
}
it("completes a signed OIDC code flow with PKCE and maps the employee from tenant/object identity", async () => {
  const state = await start(),
    r = await callback(state).expect(302);
  expect(observedVerifier.length).toBeGreaterThan(30);
  expect(r.headers["set-cookie"].join(";")).toContain("Secure");
  const cookie = r.headers["set-cookie"].find((s: string) =>
    s.startsWith("trove_session="),
  );
  const boot = await request(app)
    .get("/api/bootstrap")
    .set("Cookie", cookie.split(";")[0])
    .expect(200);
  expect(boot.body.user.id).toBe(seedId("james"));
  expect(boot.body.user.role).toBe("employee");
  await callback(state).expect(401);
});
it("rejects a browser with a mismatched state cookie before exchanging a code", async () => {
  const state = await start();
  await request(app)
    .get(`/auth/callback?state=${state}&code=fixture-code`)
    .set("Cookie", "trove_oidc=wrong")
    .expect(401);
  expect(observedVerifier).toBe("");
});
it.each([
  { nonce: "wrong-nonce" },
  { tid: "another-tenant" },
  { aud: "another-client" },
  { exp: 1 },
])("rejects invalid identity claims %j", async (overrides) => {
  const state = await start();
  claimsOverride = overrides;
  const r = await callback(state);
  expect(r.status).toBeGreaterThanOrEqual(400);
  expect(db.prepare("SELECT count(*) n FROM session").get()!.n).toBe(0);
});
it("rejects an ID token with a forged JWS signature", async () => {
  const state = await start();
  badSignature = true;
  const r = await callback(state);
  expect(r.status).toBeGreaterThanOrEqual(400);
  expect(db.prepare("SELECT count(*) n FROM session").get()!.n).toBe(0);
});
it("rejects valid but unprovisioned identities rather than creating employees from claims", async () => {
  const state = await start();
  claimsOverride = {
    oid: "44444444-4444-4444-a444-444444444444",
    roles: ["admin"],
  };
  await callback(state).expect(403);
  expect(db.prepare("SELECT count(*) n FROM session").get()!.n).toBe(0);
});
