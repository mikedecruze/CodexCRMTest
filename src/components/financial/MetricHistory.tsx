import { useEffect, useState } from "react";
import { Clock3, Plus, ShieldCheck, X } from "lucide-react";
import type { FinancialHistory, MetricCode } from "../../../shared/financial";
import { api, dateLabel, post } from "../../api";
import { Badge, Empty, Loading } from "../ui";
import { metricValue } from "./format";
import type { FinancialFormRequest } from "./FinancialForm";
export function MetricHistory({
  groupId,
  metricCode,
  serviceLineId,
  employeeLevel,
  asOf,
  recordedAsOf,
  canEdit,
  onClose,
  onOverride,
  onChanged,
}: {
  groupId: string;
  metricCode: MetricCode;
  serviceLineId: string | null;
  employeeLevel: string | null;
  asOf: string;
  recordedAsOf: string;
  canEdit: boolean;
  onClose: () => void;
  onOverride: (r: FinancialFormRequest) => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<FinancialHistory>(),
    [error, setError] = useState(""),
    [withdrawing, setWithdrawing] = useState<string | null>(null),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [version, setVersion] = useState(0);
  useEffect(() => {
    let valid = true;
    const q = new URLSearchParams({
      metricCode,
      asOf,
      ...(serviceLineId ? { serviceLineId } : {}),
      ...(employeeLevel ? { employeeLevel } : {}),
      ...(recordedAsOf ? { recordedAsOf } : {}),
    });
    api<FinancialHistory>(`/groups/${groupId}/financials/history?${q}`)
      .then((d) => {
        if (valid) setData(d);
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [
    groupId,
    metricCode,
    serviceLineId,
    employeeLevel,
    asOf,
    recordedAsOf,
    version,
  ]);
  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    if (!withdrawing) return;
    setBusy(true);
    try {
      await post(
        `/groups/${groupId}/financials/overrides/${withdrawing}/withdraw`,
        { reason },
      );
      setWithdrawing(null);
      setReason("");
      setVersion((v) => v + 1);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="panel metric-history"
      aria-label="Metric source and override history"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SOURCE & OVERRIDE INSPECTION</span>
          <h2>
            {data?.definition.name || metricCode}{" "}
            {employeeLevel ? `· ${employeeLevel}` : ""}
          </h2>
          <p>
            Only events recorded by the selected knowledge timestamp are
            included.
          </p>
        </div>
        <button
          className="icon-btn"
          aria-label="Close metric history"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="history-resolution">
            <div>
              <small>IMPORTED VALUE</small>
              <strong>
                {metricValue(data.resolved?.sourceValue, data.definition.unit)}
              </strong>
            </div>
            <div>
              <small>MANUAL OVERRIDE</small>
              <strong>
                {metricValue(
                  data.resolved?.overrideValue,
                  data.definition.unit,
                )}
              </strong>
            </div>
            <div>
              <small>EFFECTIVE VALUE</small>
              <strong>
                {metricValue(data.resolved?.value, data.definition.unit)}
              </strong>
            </div>
            {canEdit && data.resolved && (
              <button
                className="btn"
                onClick={() =>
                  onOverride({
                    type: "override",
                    groupId,
                    metricCode,
                    serviceLineId,
                    employeeLevel,
                    resolved: data.resolved,
                  })
                }
              >
                <Plus size={14} />
                Record override
              </button>
            )}
          </div>
          <div className="history-source-note">
            <ShieldCheck size={15} />
            <p>{data.definition.calculation}</p>
          </div>
          <div className="section-heading compact-heading">
            <h3>Override events</h3>
            <span className="muted small">
              {data.totalOverrides} retained events
            </span>
          </div>
          {data.overrides.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Event / value</th>
                    <th>Business interval</th>
                    <th>Recorded at / author</th>
                    <th>Reason</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.overrides.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <Badge tone={o.action === "VALUE" ? "green" : "sage"}>
                          {o.action === "VALUE"
                            ? metricValue(o.numericValue, data.definition.unit)
                            : "Withdrawn"}
                        </Badge>
                      </td>
                      <td>
                        {dateLabel(o.effectiveDate)}
                        <small className="block muted">
                          until {dateLabel(o.endDate)}
                        </small>
                        {o.periodStart && (
                          <small className="block muted">
                            Period: {o.periodStart} – {o.periodEnd}
                          </small>
                        )}
                      </td>
                      <td>
                        {new Date(o.recordedAt).toLocaleString()}
                        <small className="block muted">{o.actor}</small>
                      </td>
                      <td className="financial-reason">{o.reason}</td>
                      <td>
                        {canEdit &&
                          o.action === "VALUE" &&
                          !data.overrides.some(
                            (x) => x.supersedesId === o.id,
                          ) && (
                            <button
                              className="text-link"
                              onClick={() => setWithdrawing(o.id)}
                            >
                              Withdraw
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              title="No manual overrides"
              description="The displayed value resolves from immutable source observations."
            />
          )}
          {withdrawing && (
            <form className="withdraw-form" onSubmit={withdraw}>
              <label className="field">
                <span>Reason for withdrawal</span>
                <input
                  aria-label="Reason for withdrawal"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  minLength={5}
                  maxLength={2000}
                />
              </label>
              <button
                className="btn"
                type="button"
                onClick={() => setWithdrawing(null)}
              >
                Cancel
              </button>
              <button className="btn primary" disabled={busy}>
                Confirm withdrawal
              </button>
            </form>
          )}
          <div className="section-heading compact-heading">
            <h3>Immutable source observations</h3>
            <span className="muted small">
              Showing {data.observations.length} of {data.totalObservations}
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Effective date</th>
                  <th>Source value</th>
                  <th>Measurement period</th>
                  <th>Source / revision</th>
                  <th>Recorded timestamp</th>
                </tr>
              </thead>
              <tbody>
                {data.observations.map((o) => (
                  <tr key={o.id}>
                    <td>{dateLabel(o.effectiveDate)}</td>
                    <td>{metricValue(o.numericValue, data.definition.unit)}</td>
                    <td>
                      {o.periodStart
                        ? `${o.periodStart} – ${o.periodEnd}`
                        : "Snapshot"}
                    </td>
                    <td>
                      {o.sourceSystem}
                      <small className="block muted">
                        Revision {o.sourceRevision}
                      </small>
                      <details>
                        <summary className="text-link">
                          Source reference
                        </summary>
                        <code className="source-reference">
                          {o.externalReference}
                        </code>
                      </details>
                    </td>
                    <td>{new Date(o.recordedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.observations.length && (
            <p className="empty">
              No source observations were known by this timestamp.
            </p>
          )}
          <div className="history-source-note">
            <Clock3 size={14} />
            <p>
              Imported data and prior override events are preserved. History
              uses current Client Group and profitability permissions.
            </p>
          </div>
        </>
      )}
    </section>
  );
}
