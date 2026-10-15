import type { Express, Response } from "express";
import { z } from "zod";
import type { Employee } from "../../shared/types.ts";
import { dateSchema, Service, today } from "../service.ts";
import { FinancialService, timestampSchema } from "./service.ts";
import { FinancialImports } from "./imports.ts";
import type { FinancialSourceConnector } from "./connector.ts";
export function registerFinancialRoutes(
  app: Express,
  core: Service,
  connector: FinancialSourceConnector | null,
) {
  const finance = new FinancialService(core),
    imports = new FinancialImports(finance, connector),
    user = (res: Response) => res.locals.user as Employee;
  const readQuery = z.object({
    asOf: dateSchema.default(today),
    recordedAsOf: timestampSchema.optional(),
  });
  const dates = (q: unknown) => {
    const v = readQuery.parse(q);
    return {
      asOf: v.asOf,
      recordedAsOf: v.recordedAsOf || new Date().toISOString(),
    };
  };
  app.get("/api/financial/catalog", (_req, res) => res.json(finance.catalog()));
  app.get("/api/groups/:id/financials", (req, res) => {
    const q = dates(req.query);
    res.json(
      finance.overview(
        user(res),
        z.uuid().parse(req.params.id),
        q.asOf,
        q.recordedAsOf,
        req.query.serviceLineId
          ? z.uuid().parse(req.query.serviceLineId)
          : undefined,
      ),
    );
  });
  app.get("/api/groups/:id/financials/trend", (req, res) => {
    const q = dates(req.query),
      granularity = z
        .enum(["monthly", "quarterly"])
        .default("monthly")
        .parse(req.query.granularity);
    res.json(
      finance.trend(
        user(res),
        z.uuid().parse(req.params.id),
        q.asOf,
        q.recordedAsOf,
        granularity,
        req.query.serviceLineId
          ? z.uuid().parse(req.query.serviceLineId)
          : undefined,
      ),
    );
  });
  app.get("/api/groups/:id/financials/history", (req, res) => {
    const q = dates(req.query);
    res.json(
      finance.history(
        user(res),
        z.uuid().parse(req.params.id),
        {
          metricCode: req.query.metricCode,
          serviceLineId: req.query.serviceLineId || null,
          employeeLevel: req.query.employeeLevel || null,
        },
        q.asOf,
        q.recordedAsOf,
      ),
    );
  });
  app.post("/api/groups/:id/financials/overrides", (req, res) =>
    res
      .status(201)
      .json(
        finance.createOverride(
          user(res),
          z.uuid().parse(req.params.id),
          req.body,
        ),
      ),
  );
  app.post(
    "/api/groups/:id/financials/overrides/:overrideId/withdraw",
    (req, res) => {
      const v = z
        .object({ reason: z.string().trim().min(5).max(2000) })
        .strict()
        .parse(req.body);
      res
        .status(201)
        .json(
          finance.withdrawOverride(
            user(res),
            z.uuid().parse(req.params.id),
            z.uuid().parse(req.params.overrideId),
            v.reason,
          ),
        );
    },
  );
  app.get("/api/groups/:id/services", (req, res) => {
    const q = dates(req.query);
    res.json(
      finance.serviceHistory(
        user(res),
        z.uuid().parse(req.params.id),
        q.recordedAsOf,
      ),
    );
  });
  app.post("/api/groups/:id/services", (req, res) =>
    res
      .status(201)
      .json(
        finance.changeServiceStatus(
          user(res),
          z.uuid().parse(req.params.id),
          req.body,
        ),
      ),
  );
  app.get("/api/financial/reports", (req, res) => {
    const q = dates(req.query),
      filters = z
        .object({
          groupId: z.uuid().optional(),
          serviceLineId: z.uuid().optional(),
          teamId: z.uuid().optional(),
          partnerId: z.uuid().optional(),
          managerId: z.uuid().optional(),
          status: z
            .enum(["Active", "Prospective", "Inactive", "Archived"])
            .optional(),
        })
        .parse(req.query);
    res.json(finance.report(user(res), q.asOf, q.recordedAsOf, filters));
  });
  app.get("/api/admin/financial", async (_req, res) =>
    res.json(await imports.admin(user(res))),
  );
  app.post("/api/admin/financial/mappings", async (req, res) =>
    res.status(201).json(await imports.map(user(res), req.body)),
  );
  app.post("/api/admin/financial/imports", async (req, res) => {
    z.object({}).strict().parse(req.body);
    res.status(201).json(await imports.run(user(res)));
  });
  app.post("/api/admin/financial/service-lines", (req, res) =>
    res.status(201).json(imports.serviceLine(user(res), req.body)),
  );
  app.patch("/api/admin/financial/service-lines/:id", (req, res) =>
    res.json(
      imports.serviceLine(user(res), req.body, z.uuid().parse(req.params.id)),
    ),
  );
  app.patch("/api/admin/financial/settings", (req, res) =>
    res.json(imports.settings(user(res), req.body)),
  );
  app.post("/api/admin/financial/grants", (req, res) =>
    res.status(201).json(imports.grant(user(res), req.body)),
  );
  app.post("/api/admin/financial/grants/:id/end", (req, res) => {
    const v = z
      .object({ reason: z.string().trim().min(5).max(2000) })
      .strict()
      .parse(req.body);
    res.json(
      imports.revokeGrant(user(res), z.uuid().parse(req.params.id), v.reason),
    );
  });
}
