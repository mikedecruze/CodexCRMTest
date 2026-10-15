import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Database,
  FileCheck2,
  LoaderCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Bootstrap } from "../../shared/types";
import type {
  FinancialAdmin as AdminData,
  FinancialCatalog,
} from "../../shared/financial";
import { api, dateLabel, post } from "../api";
import { Badge, ErrorView, Loading, PageHeading } from "../components/ui";
import {
  FinancialForm,
  type FinancialFormRequest,
} from "../components/financial/FinancialForm";
export function FinancialAdmin({ boot }: { boot: Bootstrap }) {
  const [data, setData] = useState<AdminData>(),
    [catalog, setCatalog] = useState<FinancialCatalog>(),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [section, setSection] = useState("mappings"),
    [form, setForm] = useState<FinancialFormRequest | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [revoking, setRevoking] = useState<string | null>(null),
    [reason, setReason] = useState("");
  useEffect(() => {
    if (boot.user.role !== "admin") return;
    let valid = true;
    Promise.all([
      api<AdminData>("/admin/financial"),
      api<FinancialCatalog>("/financial/catalog"),
    ])
      .then(([d, c]) => {
        if (valid) {
          setData(d);
          setCatalog(c);
          setError("");
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [boot.user.role, version]);
  if (boot.user.role !== "admin")
    return (
      <>
        <PageHeading
          eyebrow="FINANCIAL ADMINISTRATION"
          title="Administrator access required"
          description="Source mappings, imports, conventions and explicit profitability grants are managed by administrators."
        />
        <div className="notice">
          <ShieldCheck size={19} />
          Current API permissions are enforced for every operation.
        </div>
      </>
    );
  if (error && !data)
    return <ErrorView error={error} retry={() => setVersion((v) => v + 1)} />;
  if (!data || !catalog) return <Loading />;
  async function runImport() {
    setBusy(true);
    setError("");
    try {
      const result = await post<{
        importedCount: number;
        skippedCount: number;
        errorCount: number;
      }>("/admin/financial/imports", {});
      setMessage(
        `Mock import completed: ${result.importedCount} new observations, ${result.skippedCount} existing revisions skipped, ${result.errorCount} exceptions for review.`,
      );
      setSection("imports");
      setVersion((v) => v + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function revoke(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await post(`/admin/financial/grants/${revoking}/end`, { reason });
      setRevoking(null);
      setReason("");
      setVersion((v) => v + 1);
      setMessage(
        "Profitability scope revoked. Client Group team access is unchanged.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const unmapped = data.customers.filter(
    (c) =>
      !data.mappings.some((m) => m.externalSourceId === c.externalSourceId),
  );
  return (
    <>
      <Link to="/admin" className="back-link">
        <ArrowLeft size={14} />
        Administration
      </Link>
      <PageHeading
        eyebrow="SOURCE CONTROL & FINANCIAL HISTORY"
        title="Financial data administration"
        description="Explicit mappings, repeatable imports and accountable access decisions."
        action={
          <button className="btn primary" onClick={runImport} disabled={busy}>
            {busy ? (
              <LoaderCircle className="spin" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
            Run mock import
          </button>
        }
      />
      <div className="financial-source-banner">
        <div className="quick-icon">
          <Database size={23} />
        </div>
        <div>
          <h2>{data.source.name}</h2>
          <p>
            Read-only synthetic adapter · no real Fabric connection · original
            observations are immutable
          </p>
        </div>
        <Badge tone="sage">MOCK DATA</Badge>
      </div>
      {message && (
        <div role="status" className="notice financial-message">
          <span>{message}</span>
          <button className="text-link" onClick={() => setMessage("")}>
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <div className="profile-tabs">
        {[
          { id: "mappings", label: "Source mappings" },
          { id: "imports", label: "Import monitoring" },
          { id: "lines", label: "Service lines & measures" },
          { id: "access", label: "Profitability scope" },
        ].map((s) => (
          <button
            className={section === s.id ? "active" : ""}
            key={s.id}
            onClick={() => setSection(s.id)}
          >
            {s.label}
            {s.id === "mappings" && <span>{unmapped.length} unmatched</span>}
          </button>
        ))}
      </div>
      {section === "mappings" && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Records requiring mapping review</h2>
                <p>
                  Matching display names do not establish identity. Create the
                  supplemental group first when needed.
                </p>
              </div>
              <button
                className="btn"
                onClick={() => setForm({ type: "mapping" })}
                disabled={!unmapped.length}
              >
                <Plus size={15} />
                Approve mapping
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source identity</th>
                    <th>Display name</th>
                    <th>Source object</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {unmapped.map((c) => (
                    <tr key={c.externalSourceId}>
                      <td>
                        <code>{c.externalSourceId}</code>
                      </td>
                      <td>{c.displayName}</td>
                      <td>{c.sourceObjectType}</td>
                      <td>
                        <Badge tone="sage">Review required</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!unmapped.length && (
              <p className="empty">
                All inspected source customer identities have explicit mappings.
              </p>
            )}
          </section>
          <section className="panel mapping-approved">
            <div className="panel-heading">
              <div>
                <h2>Approved source mappings</h2>
                <p>
                  Stable internal UUIDs remain independent of external source
                  identifiers.
                </p>
              </div>
              <FileCheck2 size={19} />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source system / object</th>
                    <th>External identity</th>
                    <th>Internal record</th>
                    <th>Type</th>
                    <th>Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {data.mappings.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.sourceSystem}
                        <small className="block muted">
                          {m.sourceObjectType}
                        </small>
                      </td>
                      <td>
                        <code>{m.externalSourceId}</code>
                      </td>
                      <td>
                        {m.recordName}
                        <small className="block muted">
                          {m.internalRecordId}
                        </small>
                      </td>
                      <td>{m.recordType}</td>
                      <td>{dateLabel(m.lastVerifiedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel source-schema-panel">
            <div className="panel-heading">
              <h2>Inspected synthetic schemas</h2>
              <Badge tone="sage">Not production Fabric identifiers</Badge>
            </div>
            {data.source.schemas.map((s) => (
              <div key={s.name}>
                <strong>{s.name}</strong>
                <p>{s.fields.join(" · ")}</p>
              </div>
            ))}
            <p className="financial-footnote">
              The connector contract exposes read operations only. A real Fabric
              adapter requires actual schema inspection, approved mappings and
              deployed authorization validation.
            </p>
          </section>
        </>
      )}
      {section === "imports" && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div>
                <h2>Import batches</h2>
                <p>
                  Latest 30 runs. Repeating a source revision skips existing
                  observations.
                </p>
              </div>
              <RefreshCw size={18} />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Started</th>
                    <th>Source</th>
                    <th>Result</th>
                    <th>Imported</th>
                    <th>Skipped</th>
                    <th>Exceptions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.batches.map((b) => (
                    <tr key={b.id}>
                      <td>{new Date(b.startedAt).toLocaleString()}</td>
                      <td>{b.sourceSystem}</td>
                      <td>
                        <Badge tone={b.errorCount ? "sage" : "green"}>
                          {b.status}
                        </Badge>
                      </td>
                      <td>{b.importedCount}</td>
                      <td>{b.skippedCount}</td>
                      <td>{b.errorCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel mapping-approved">
            <div className="panel-heading">
              <div>
                <h2>Import exceptions</h2>
                <p>
                  Latest 100 exception records. Correct the mapping or source
                  revision, then rerun.
                </p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source identity</th>
                    <th>Exception</th>
                    <th>Explanation</th>
                    <th>Recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.exceptions.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <code>{e.externalSourceId}</code>
                      </td>
                      <td>
                        <Badge tone="sage">{e.code}</Badge>
                      </td>
                      <td className="financial-reason">{e.message}</td>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {section === "lines" && (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>Service-line categories</h2>
              <button
                className="btn"
                onClick={() => setForm({ type: "serviceLine" })}
              >
                <Plus size={15} />
                Add service line
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Stable code</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.serviceLines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td>
                        <code>{l.code}</code>
                      </td>
                      <td>
                        <Badge tone={l.active ? "green" : "sage"}>
                          {l.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() =>
                            setForm({ type: "serviceLine", editLine: l })
                          }
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel hours-convention">
            <div className="panel-heading">
              <div>
                <h2>Staffing measurement convention</h2>
                <p>
                  {data.lookbackMonths} completed calendar months · monthly
                  average and annualized equivalent displayed separately
                </p>
              </div>
              <button
                className="btn"
                onClick={() => setForm({ type: "settings" })}
              >
                Configure lookback
              </button>
            </div>
            <p className="financial-footnote">
              Changes are recorded with their timestamp so earlier knowledge
              views retain their historical convention. Missing source months
              remain unavailable.
            </p>
          </section>
          <section className="panel mapping-approved">
            <div className="panel-heading">
              <div>
                <h2>Metric definitions</h2>
                <p>Source measures and derived calculations are explicit.</p>
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th>Dimensions / unit</th>
                    <th>Classification</th>
                    <th>Calculation / source convention</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.metrics.map((m) => (
                    <tr key={m.id}>
                      <td>
                        {m.name}
                        <small className="block muted">{m.code}</small>
                      </td>
                      <td>
                        {m.dimensions}
                        <small className="block muted">{m.unit}</small>
                      </td>
                      <td>
                        <Badge tone="sage">{m.classification}</Badge>
                      </td>
                      <td className="financial-reason">{m.calculation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {section === "access" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Explicit profitability scope</h2>
              <p>
                Partners, Directors and current assigned Relationship Managers
                qualify automatically within authorized groups.
              </p>
            </div>
            <button className="btn" onClick={() => setForm({ type: "grant" })}>
              <Plus size={15} />
              Grant scope
            </button>
          </div>
          <p className="financial-footnote">
            An explicit grant requires existing Client Group authorization.
            Administrator status alone does not confer profitability access.
            Revocation applies immediately, including historical views.
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Client Group</th>
                  <th>Effective interval</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.grants.map((g) => (
                  <tr key={g.id}>
                    <td>{g.employee}</td>
                    <td>{g.groupName}</td>
                    <td>
                      {dateLabel(g.startDate)} – {dateLabel(g.endDate)}
                    </td>
                    <td className="financial-reason">{g.reason}</td>
                    <td>
                      <Badge tone={g.revokedAt ? "sage" : "green"}>
                        {g.revokedAt ? "Revoked" : "Granted (date-dependent)"}
                      </Badge>
                    </td>
                    <td>
                      {!g.revokedAt && (
                        <button
                          className="text-link"
                          onClick={() => setRevoking(g.id)}
                        >
                          Revoke scope
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.grants.length && (
            <p className="empty">
              No explicit grants. Current roles and primary assignments govern
              profitability access.
            </p>
          )}
          {revoking && (
            <form className="withdraw-form" onSubmit={revoke}>
              <label className="field">
                <span>Reason for scope revocation</span>
                <input
                  aria-label="Reason for scope revocation"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
              <button
                type="button"
                className="btn"
                onClick={() => setRevoking(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                Confirm revocation
              </button>
            </form>
          )}
        </section>
      )}
      {form && (
        <FinancialForm
          request={form}
          boot={boot}
          catalog={catalog}
          admin={data}
          onClose={() => setForm(null)}
          onSaved={(message) => {
            setForm(null);
            setMessage(message);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
