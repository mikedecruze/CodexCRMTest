import express from "express";
import { registerFinancialRoutes } from "./financial/routes.ts";
import { MockFabricConnector } from "./financial/connector.ts";
import type { Request, Response, NextFunction } from "express";
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import * as oidc from "openid-client";
import { z } from "zod";
import { Service, HttpError, dateSchema, today, overlaps } from "./service.ts";
import { insert } from "./seed.ts";
import { transaction, type Db } from "./db.ts";
import type { Employee, Reference } from "../shared/types.ts";
export interface AppOptions {
  demo: boolean;
  origin: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  production?: boolean;
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const cookies = (req: Request) =>
  Object.fromEntries(
    (req.headers.cookie || "").split(";").map((c) => c.trim().split("=")),
  );
export function createApp(db: Db, options: AppOptions) {
  if (options.demo && options.production)
    throw new Error("Demo authentication cannot run in production.");
  if (!options.demo && !options.origin.startsWith("https://"))
    throw new Error("Non-demo mode requires an HTTPS app origin.");
  const app = express(),
    service = new Service(db);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
    });
    next();
  });
  app.use(express.json({ limit: "64kb" }));
  app.use((req, _res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.headers.origin !== options.origin)
        return next(new HttpError(403, "Request origin is not allowed."));
      if (!req.is("application/json"))
        return next(new HttpError(415, "Use application/json."));
    }
    next();
  });
  const issueSession = (res: Response, employeeId: string) => {
    const token = randomBytes(32).toString("hex");
    db.prepare("DELETE FROM session WHERE expiresAt<?").run(Date.now());
    insert(db, "session", {
      tokenHash: hash(token),
      employeeId,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
      mode: options.demo ? "demo" : "entra",
    });
    res.cookie("trove_session", token, {
      httpOnly: true,
      secure: !options.demo,
      sameSite: "strict",
      path: "/",
      maxAge: 8 * 60 * 60 * 1000,
    });
  };
  app.get("/api/health", (_req, res) => {
    db.prepare("SELECT 1").get();
    res.json({
      ok: true,
      mode: options.demo ? "synthetic-demo" : "entra",
      storage: "sqlite-development-adapter",
    });
  });
  app.get("/api/auth/config", (_req, res) =>
    res.json({
      demo: options.demo,
      entraConfigured: !!(
        options.tenantId &&
        options.clientId &&
        options.clientSecret &&
        options.redirectUri
      ),
      personas: options.demo ? service.employees() : [],
    }),
  );
  const loginLimits = new Map<string, { count: number; until: number }>();
  app.post("/api/auth/demo", (req, res) => {
    if (!options.demo) throw new HttpError(404, "Not found");
    const key = req.ip || "local";
    let limit = loginLimits.get(key);
    if (!limit || limit.until < Date.now()) {
      limit = { count: 0, until: Date.now() + 60_000 };
      loginLimits.set(key, limit);
    }
    if (++limit.count > 60)
      throw new HttpError(429, "Try signing in again in a minute.");
    const { employeeId } = z
      .object({ employeeId: z.uuid() })
      .strict()
      .parse(req.body);
    const user = service.employee(employeeId);
    if (!user) throw new HttpError(401, "Sign-in failed");
    if (cookies(req).trove_session)
      db.prepare("DELETE FROM session WHERE tokenHash=?").run(
        hash(cookies(req).trove_session),
      );
    issueSession(res, user.id);
    res.json({ user });
  });
  let configuration: Promise<oidc.Configuration> | undefined;
  function entraConfig() {
    if (
      !options.tenantId ||
      !options.clientId ||
      !options.clientSecret ||
      !options.redirectUri
    )
      throw new HttpError(
        503,
        "Microsoft sign-in needs the tenant app registration and redirect URI.",
      );
    if (!z.uuid().safeParse(options.tenantId).success)
      throw new HttpError(503, "Invalid tenant configuration.");
    return (configuration ??= oidc.discovery(
      new URL(`https://login.microsoftonline.com/${options.tenantId}/v2.0`),
      options.clientId,
      options.clientSecret,
      undefined,
      { execute: [oidc.enableNonRepudiationChecks] },
    ));
  }
  app.get("/auth/entra", async (_req, res) => {
    const config = await entraConfig(),
      state = oidc.randomState(),
      verifier = oidc.randomPKCECodeVerifier(),
      nonce = oidc.randomNonce();
    db.prepare("DELETE FROM login_attempt WHERE expiresAt<?").run(Date.now());
    insert(db, "login_attempt", {
      state,
      verifier,
      nonce,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    res.cookie("trove_oidc", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/auth",
      maxAge: 10 * 60 * 1000,
    });
    res.redirect(
      oidc.buildAuthorizationUrl(config, {
        redirect_uri: options.redirectUri!,
        scope: "openid profile email",
        code_challenge: await oidc.calculatePKCECodeChallenge(verifier),
        code_challenge_method: "S256",
        state,
        nonce,
      }).href,
    );
  });
  app.get("/auth/callback", async (req, res) => {
    const state = z.string().min(20).max(200).parse(req.query.state),
      cookie = cookies(req).trove_oidc || "";
    if (
      cookie.length !== state.length ||
      !timingSafeEqual(Buffer.from(cookie), Buffer.from(state))
    )
      throw new HttpError(401, "Invalid sign-in state.");
    const attempt = service.one<{
      state: string;
      verifier: string;
      nonce: string;
      expiresAt: number;
    }>("SELECT * FROM login_attempt WHERE state=?", state);
    db.prepare("DELETE FROM login_attempt WHERE state=?").run(state);
    res.clearCookie("trove_oidc", {
      path: "/auth",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
    if (!attempt || attempt.expiresAt < Date.now())
      throw new HttpError(401, "Sign-in expired.");
    const tokens = await oidc.authorizationCodeGrant(
      await entraConfig(),
      new URL(
        `${options.redirectUri}?${new URLSearchParams(req.query as Record<string, string>)}`,
      ),
      {
        pkceCodeVerifier: attempt.verifier,
        expectedState: state,
        expectedNonce: attempt.nonce,
        idTokenExpected: true,
      },
    );
    const claims = tokens.claims();
    if (
      !claims ||
      claims.tid !== options.tenantId ||
      typeof claims.oid !== "string"
    )
      throw new HttpError(401, "Invalid tenant identity.");
    const user = service.one<Employee>(
      "SELECT id,displayName,email,level,role,active FROM employee WHERE subject=? AND active=1",
      `${claims.tid}:${claims.oid}`,
    );
    if (!user)
      throw new HttpError(
        403,
        "Your employee account has not been provisioned.",
      );
    issueSession(res, user.id);
    res.redirect("/");
  });
  app.use("/api", (req, res, next) => {
    const token = cookies(req).trove_session;
    const session = token
      ? service.one<{ employeeId: string; expiresAt: number }>(
          "SELECT employeeId,expiresAt FROM session WHERE tokenHash=? AND mode=?",
          hash(token),
          options.demo ? "demo" : "entra",
        )
      : undefined;
    const user =
      session && session.expiresAt > Date.now()
        ? service.employee(session.employeeId)
        : undefined;
    if (!user) return next(new HttpError(401, "Sign in to continue."));
    res.locals.user = user;
    next();
  });
  const user = (res: Response) => res.locals.user as Employee;
  registerFinancialRoutes(
    app,
    service,
    options.demo ? new MockFabricConnector() : null,
  );
  app.post("/api/auth/logout", (req, res) => {
    db.prepare("DELETE FROM session WHERE tokenHash=?").run(
      hash(cookies(req).trove_session || ""),
    );
    res.clearCookie("trove_session", { path: "/" });
    res.json({ ok: true });
  });
  app.get("/api/bootstrap", (_req, res) => {
    const u = user(res),
      parties = service.parties(u),
      groups = service.groups(u);
    res.json({
      user: u,
      demo: options.demo,
      employees: service.employees(),
      teams: service.teams(),
      references: service.references(),
      groups,
      stats: {
        groups: groups.filter((g) => g.status !== "Archived").length,
        people: parties.filter((p) => p.kind === "PERSON" && p.primaryGroupId)
          .length,
        entities: parties.filter((p) => p.kind === "LEGAL_ENTITY").length,
        advisors: parties.filter((p) => p.isAdvisor).length,
      },
    });
  });
  const pageSchema = z.coerce.number().int().min(1).max(10000).default(1);
  function paginate<T>(items: T[], page: unknown) {
    const p = pageSchema.parse(page);
    return {
      items: items.slice((p - 1) * 20, p * 20),
      total: items.length,
      page: p,
      pageSize: 20,
    };
  }
  app.get("/api/groups", (req, res) => {
    const q = String(req.query.q || "").toLowerCase(),
      status = String(req.query.status || ""),
      team = String(req.query.team || ""),
      partner = String(req.query.partner || ""),
      manager = String(req.query.manager || "");
    res.json(
      paginate(
        service
          .groups(user(res))
          .filter(
            (g) =>
              (!q || `${g.name} ${g.displayName}`.toLowerCase().includes(q)) &&
              (!status || g.status === status) &&
              (!team || g.teamId === team) &&
              (!partner || g.partnerId === partner) &&
              (!manager || g.managerId === manager),
          ),
        req.query.page,
      ),
    );
  });
  app.post("/api/groups", (req, res) =>
    res.status(201).json(service.createGroup(user(res), req.body)),
  );
  app.get("/api/groups/:id", (req, res) =>
    res.json(
      service.detail(
        user(res),
        z.uuid().parse(req.params.id),
        dateSchema.parse(req.query.asOf || today()),
      ),
    ),
  );
  app.post("/api/groups/:id/commands", (req, res) =>
    res
      .status(201)
      .json(service.mutate(user(res), z.uuid().parse(req.params.id), req.body)),
  );
  app.get("/api/parties", (req, res) => {
    const q = String(req.query.q || "").toLowerCase(),
      kind = String(req.query.kind || "");
    res.json(
      paginate(
        service
          .parties(user(res))
          .filter(
            (p) =>
              (!q || p.displayName.toLowerCase().includes(q)) &&
              (!req.query.status || p.status === req.query.status) &&
              (!kind || (kind === "advisor" ? p.isAdvisor : p.kind === kind)),
          ),
        req.query.page,
      ),
    );
  });
  app.get("/api/parties/:id", (req, res) =>
    res.json(service.party(user(res), z.uuid().parse(req.params.id))),
  );
  app.patch("/api/parties/:id", (req, res) =>
    res.json(
      service.updateParty(user(res), z.uuid().parse(req.params.id), req.body),
    ),
  );
  app.get("/api/search", (req, res) => {
    const q = z
        .string()
        .trim()
        .min(2)
        .max(100)
        .parse(req.query.q)
        .toLowerCase(),
      u = user(res);
    res.json({
      groups: service
        .groups(u)
        .filter((g) => `${g.name} ${g.displayName}`.toLowerCase().includes(q))
        .slice(0, 10),
      parties: service
        .parties(u)
        .filter((p) =>
          `${p.displayName} ${p.email || ""}`.toLowerCase().includes(q),
        )
        .slice(0, 20),
    });
  });
  app.get("/api/audit", (req, res) =>
    res.json(
      service.audit(
        user(res),
        req.query.groupId ? z.uuid().parse(req.query.groupId) : undefined,
      ),
    ),
  );
  app.get("/api/admin", (_req, res) => {
    service.requireAdmin(user(res));
    res.json({
      memberships: service.rows(
        "SELECT m.*,e.displayName employee,t.name team FROM team_membership m JOIN employee e ON e.id=m.employeeId JOIN team t ON t.id=m.teamId ORDER BY e.displayName",
      ),
      audit: service.audit(user(res)),
    });
  });
  app.post("/api/admin/references", (req, res) => {
    const u = user(res);
    service.requireAdmin(u);
    const v = z
      .object({
        category: z.enum(["entity", "relationship", "advisor", "contact"]),
        code: z.string().regex(/^[a-z][a-z0-9-]{1,49}$/),
        label: z.string().trim().min(1).max(160),
        symmetric: z.boolean().default(false),
        ownership: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    if (v.category !== "relationship" && (v.symmetric || v.ownership))
      throw new HttpError(
        400,
        "Relationship flags require the relationship category.",
      );
    const id = randomUUID(),
      stamp = new Date().toISOString();
    transaction(db, () => {
      if (
        service.one(
          "SELECT id FROM reference_type WHERE category=? AND code=?",
          v.category,
          v.code,
        )
      )
        throw new HttpError(409, "This category code already exists.");
      insert(db, "reference_type", {
        ...v,
        id,
        symmetric: v.symmetric ? 1 : 0,
        ownership: v.ownership ? 1 : 0,
        active: 1,
        createdAt: stamp,
        updatedAt: stamp,
      });
      service.log(u, null, "Reference type created", id, null, v);
    });
    res.status(201).json({ id });
  });
  app.patch("/api/admin/references/:id", (req, res) => {
    const u = user(res);
    service.requireAdmin(u);
    const v = z
        .object({
          label: z.string().trim().min(1).max(160),
          active: z.boolean(),
        })
        .strict()
        .parse(req.body),
      id = z.uuid().parse(req.params.id);
    transaction(db, () => {
      const before = service.one<Reference>(
        "SELECT * FROM reference_type WHERE id=?",
        id,
      );
      if (!before) throw new HttpError(404, "Category not found");
      db.prepare(
        "UPDATE reference_type SET label=?,active=?,updatedAt=? WHERE id=?",
      ).run(v.label, v.active ? 1 : 0, new Date().toISOString(), id);
      service.log(u, null, "Reference type updated", id, before, v);
    });
    res.json({ id });
  });
  app.post("/api/admin/memberships", (req, res) => {
    const u = user(res);
    service.requireAdmin(u);
    const v = z
      .object({
        employeeId: z.uuid(),
        teamId: z.uuid(),
        startDate: dateSchema,
        endDate: dateSchema.nullable().default(null),
      })
      .strict()
      .parse(req.body);
    service.range(v.startDate, v.endDate);
    if (
      !service.employee(v.employeeId) ||
      !service.teams().some((t) => t.id === v.teamId && t.active)
    )
      throw new HttpError(400, "Choose active employee and team records.");
    const id = randomUUID();
    transaction(db, () => {
      if (
        service
          .rows<{ startDate: string; endDate: string | null }>(
            "SELECT startDate,endDate FROM team_membership WHERE employeeId=? AND teamId=?",
            v.employeeId,
            v.teamId,
          )
          .some((m) => overlaps(v.startDate, v.endDate, m.startDate, m.endDate))
      )
        throw new HttpError(409, "Team membership dates overlap.");
      insert(db, "team_membership", { id, ...v });
      service.log(u, null, "Team membership created", id, null, v);
    });
    res.status(201).json({ id });
  });
  app.use("/api", (_req, _res, next) => next(new HttpError(404, "Not found")));
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof z.ZodError)
      return res.status(400).json({
        error: err.issues
          .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
          .join("; "),
      });
    if (err instanceof HttpError)
      return res.status(err.status).json({ error: err.message });
    if (err instanceof oidc.ClientError)
      return res.status(401).json({
        error: "Microsoft sign-in could not be verified. Please sign in again.",
      });
    if (err instanceof SyntaxError)
      return res.status(400).json({ error: "Invalid JSON request." });
    console.error(
      "Request failed:",
      err instanceof Error ? err.name : "UnknownError",
    );
    return res
      .status(500)
      .json({ error: "The request could not be completed." });
  });
  return app;
}
