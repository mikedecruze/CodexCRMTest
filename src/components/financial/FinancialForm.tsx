import { useState } from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import type { Bootstrap } from "../../../shared/types";
import type {
  FinancialAdmin,
  FinancialCatalog,
  FinancialLine,
  MetricCode,
  ResolvedMetric,
} from "../../../shared/financial";
import { api, dateToday, post } from "../../api";
interface Field {
  key: string;
  label: string;
  type?: string;
  value?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  hint?: string;
}
export interface FinancialFormRequest {
  type:
    | "override"
    | "serviceStatus"
    | "mapping"
    | "serviceLine"
    | "settings"
    | "grant";
  groupId?: string;
  metricCode?: MetricCode;
  serviceLineId?: string | null;
  employeeLevel?: string | null;
  resolved?: ResolvedMetric | null;
  line?: FinancialLine;
  editLine?: { id: string; code: string; name: string; active: number };
}
export function FinancialForm({
  request,
  boot,
  catalog,
  admin,
  onClose,
  onSaved,
}: {
  request: FinancialFormRequest;
  boot: Bootstrap;
  catalog: FinancialCatalog;
  admin?: FinancialAdmin;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const options = (
    items: { id: string; name?: string; displayName?: string }[],
  ) =>
    items.map((i) => ({ value: i.id, label: i.name || i.displayName || "" }));
  const serviceOptions = options(catalog.serviceLines.filter((s) => s.active));
  const select = (
    key: string,
    label: string,
    options: Field["options"],
    value = "",
    required = true,
  ): Field => ({ key, label, options, value, required });
  const r = request.resolved;
  const fields: Record<FinancialFormRequest["type"], Field[]> = {
    override: [
      {
        key: "effectiveDate",
        label: "Business effective date",
        type: "date",
        required: true,
        value: r?.effectiveDate || dateToday(),
      },
      { key: "endDate", label: "Effective until (exclusive)", type: "date" },
      {
        key: "numericValue",
        label: "Override value",
        type: "number",
        required: true,
        value: r ? String(r.value) : "",
      },
      {
        key: "reason",
        label: "Reason for override",
        type: "textarea",
        required: true,
        hint: "At least 5 characters. The imported value is retained.",
      },
    ],
    serviceStatus: [
      select(
        "serviceLineId",
        "Service line",
        serviceOptions,
        request.serviceLineId || "",
      ),
      select(
        "status",
        "Service status",
        ["Active", "Inactive", "Pending", "Suspended"].map((s) => ({
          value: s,
          label: s,
        })),
        "Active",
      ),
      {
        key: "startDate",
        label: "Effective from",
        type: "date",
        required: true,
        value: dateToday(),
      },
      { key: "endDate", label: "Effective until (exclusive)", type: "date" },
      select(
        "teamId",
        "Responsible service team",
        options(boot.teams.filter((t) => t.active)),
        request.line?.status?.teamId ||
          boot.groups.find((g) => g.id === request.groupId)?.teamId ||
          "",
      ),
      {
        key: "reason",
        label: "Reason for service change",
        type: "textarea",
        required: true,
        hint: "Changing status does not change source ARR.",
      },
    ],
    mapping: [
      select(
        "externalSourceId",
        "Unmapped source customer",
        admin?.customers
          .filter(
            (c) =>
              !admin.mappings.some(
                (m) => m.externalSourceId === c.externalSourceId,
              ),
          )
          .map((c) => ({
            value: c.externalSourceId,
            label: `${c.displayName} · ${c.externalSourceId}`,
          })) || [],
      ),
      select("groupId", "Map explicitly to Client Group", options(boot.groups)),
      {
        key: "acknowledge",
        label:
          "I reviewed the source identity; names alone do not establish a match.",
        type: "checkbox",
        required: true,
      },
    ],
    serviceLine: [
      {
        key: "code",
        label: "Stable service-line code",
        required: true,
        value: request.editLine?.code,
        hint: "Uppercase letters, digits and underscores; codes remain stable.",
      },
      {
        key: "name",
        label: "Display name",
        required: true,
        value: request.editLine?.name,
      },
      select(
        "active",
        "Status",
        [
          { value: "true", label: "Active" },
          { value: "false", label: "Inactive" },
        ],
        request.editLine?.active === 0 ? "false" : "true",
      ),
    ],
    settings: [
      {
        key: "lookbackMonths",
        label: "Completed months in staffing lookback",
        type: "number",
        required: true,
        value: String(catalog.lookbackMonths),
        hint: "1–60 completed calendar months. Monthly average and annualized equivalent are displayed separately.",
      },
    ],
    grant: [
      select("groupId", "Client Group", options(boot.groups)),
      select(
        "employeeId",
        "Employee",
        options(boot.employees.filter((e) => e.active)),
      ),
      {
        key: "startDate",
        label: "Effective from",
        type: "date",
        required: true,
        value: dateToday(),
      },
      { key: "endDate", label: "Effective until (exclusive)", type: "date" },
      {
        key: "reason",
        label: "Reason for approved scope",
        type: "textarea",
        required: true,
        hint: "This scope does not grant access to a Client Group. Team authorization is also required.",
      },
    ],
  };
  const titles = {
    override: "Record a financial override",
    serviceStatus: "Record a service status change",
    mapping: "Approve an explicit source mapping",
    serviceLine: request.editLine ? "Edit service line" : "Add a service line",
    settings: "Configure staffing convention",
    grant: "Grant profitability scope",
  };
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const data = new FormData(e.currentTarget),
      value: Record<string, unknown> = {};
    for (const f of fields[request.type]) {
      const v = String(data.get(f.key) || "").trim();
      if (f.type === "number") value[f.key] = Number(v);
      else if (f.type === "checkbox") value[f.key] = data.has(f.key);
      else if (f.type === "date") value[f.key] = v || null;
      else value[f.key] = v;
    }
    try {
      if (request.type === "override") {
        value.metricCode = request.metricCode;
        value.serviceLineId = request.serviceLineId ?? null;
        value.employeeLevel = request.employeeLevel ?? null;
        value.periodStart = r?.periodStart ?? null;
        value.periodEnd = r?.periodEnd ?? null;
        await post(`/groups/${request.groupId}/financials/overrides`, value);
      } else if (request.type === "serviceStatus")
        await post(`/groups/${request.groupId}/services`, value);
      else if (request.type === "mapping") {
        delete value.acknowledge;
        value.recordType = "CLIENT_GROUP";
        value.internalRecordId = value.groupId;
        await post("/admin/financial/mappings", value);
      } else if (request.type === "serviceLine") {
        value.active = value.active === "true";
        if (request.editLine)
          await api(`/admin/financial/service-lines/${request.editLine.id}`, {
            method: "PATCH",
            body: JSON.stringify(value),
          });
        else await post("/admin/financial/service-lines", value);
      } else if (request.type === "settings")
        await api("/admin/financial/settings", {
          method: "PATCH",
          body: JSON.stringify(value),
        });
      else await post("/admin/financial/grants", value);
      onSaved(
        request.type === "override"
          ? "Override saved. The source observation is unchanged."
          : request.type === "serviceStatus"
            ? "Service status saved independently of financial values."
            : "Configuration saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="form-modal financial-form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="financial-form-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">FINANCIAL HISTORY</span>
            <h2 id="financial-form-title">{titles[request.type]}</h2>
            <p>
              {request.metricCode
                ? `${request.metricCode} · ${request.employeeLevel || catalog.serviceLines.find((s) => s.id === request.serviceLineId)?.name || "Client Group"}`
                : "Explicit decisions. Preserved history."}
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="Close financial form"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          {request.type === "override" && (
            <div className="notice financial-form-note">
              <span>
                Imported source:{" "}
                <strong>{r?.sourceValue.toLocaleString("en-US")}</strong> ·
                revision {r?.sourceRevision}
                <br />
                {r?.periodStart
                  ? `Measurement period: ${r.periodStart} through ${r.periodEnd} (exclusive).`
                  : "Point-in-time snapshot; this override applies within its effective dates."}
              </span>
            </div>
          )}
          <div className="form-fields">
            {fields[request.type].map((f) => (
              <label
                key={f.key}
                className={`field ${f.type === "textarea" || f.type === "checkbox" ? "full" : ""} ${f.type === "checkbox" ? "checkbox-field" : ""}`}
              >
                <span>
                  {f.label}
                  {f.required && " *"}
                </span>
                {f.options ? (
                  <select
                    aria-label={f.label}
                    name={f.key}
                    required={f.required}
                    defaultValue={f.value || ""}
                  >
                    <option value="">Choose…</option>
                    {f.options.map((o) => (
                      <option value={o.value} key={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    aria-label={f.label}
                    name={f.key}
                    required={f.required}
                    minLength={5}
                    maxLength={2000}
                    rows={3}
                  />
                ) : (
                  <input
                    aria-label={f.label}
                    name={f.key}
                    type={f.type || "text"}
                    defaultValue={f.value || ""}
                    required={f.required}
                    maxLength={160}
                    step={f.type === "number" ? "any" : undefined}
                    readOnly={
                      request.type === "serviceLine" &&
                      !!request.editLine &&
                      f.key === "code"
                    }
                  />
                )}{" "}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </div>
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={16} />
              ) : (
                <ArrowRight size={16} />
              )}
              Save{" "}
              {request.type === "override"
                ? "override"
                : request.type === "mapping"
                  ? "mapping"
                  : "changes"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
