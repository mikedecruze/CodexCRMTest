import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Clock3,
  History,
  Info,
  Landmark,
  LockKeyhole,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { Bootstrap, Group } from "../../../shared/types";
import type {
  FinancialCatalog,
  FinancialOverview as Overview,
  FinancialPoint,
  MetricCode,
  ResolvedMetric,
  ServiceStatus,
} from "../../../shared/financial";
import { api, dateLabel } from "../../api";
import { Badge, ErrorView, Loading } from "../ui";
import { FinancialForm, type FinancialFormRequest } from "./FinancialForm";
import { MetricHistory } from "./MetricHistory";
import { TrendChart, type TrendMetric } from "./TrendChart";
import { metricValue, money, number, percentage } from "./format";
interface Slice {
  metricCode: MetricCode;
  serviceLineId: string | null;
  employeeLevel: string | null;
}
export function FinancialOverview({
  boot,
  group,
  asOf,
}: {
  boot: Bootstrap;
  group: Group;
  asOf: string;
}) {
  const [catalog, setCatalog] = useState<FinancialCatalog>(),
    [data, setData] = useState<Overview>(),
    [trend, setTrend] = useState<FinancialPoint[]>([]),
    [services, setServices] = useState<ServiceStatus[]>([]),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [known, setKnown] = useState(""),
    [knownInput, setKnownInput] = useState(""),
    [line, setLine] = useState(""),
    [granularity, setGranularity] = useState<"monthly" | "quarterly">(
      "monthly",
    ),
    [metric, setMetric] = useState<TrendMetric>("arr"),
    [history, setHistory] = useState<Slice | null>(null),
    [form, setForm] = useState<FinancialFormRequest | null>(null),
    [message, setMessage] = useState(""),
    [section, setSection] = useState("financials"),
    [historyMetric, setHistoryMetric] = useState<MetricCode>("ARR"),
    [historyLevel, setHistoryLevel] = useState("Manager"),
    [historyLine, setHistoryLine] = useState("");
  useEffect(() => {
    let valid = true;
    api<FinancialCatalog>("/financial/catalog")
      .then((c) => {
        if (valid) {
          setCatalog(c);
          setHistoryLine(
            c.serviceLines.find((s) => s.code === "FAMILY_OFFICE")?.id ||
              c.serviceLines[0]?.id ||
              "",
          );
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, []);
  const requestKey = JSON.stringify([
    group.id,
    asOf,
    known,
    line,
    granularity,
    version,
  ]);
  const [loadedKey, setLoadedKey] = useState("");
  useEffect(() => {
    let valid = true;
    setError("");
    const q = new URLSearchParams({
      asOf,
      ...(known ? { recordedAsOf: known } : {}),
      ...(line ? { serviceLineId: line } : {}),
    });
    Promise.all([
      api<Overview>(`/groups/${group.id}/financials?${q}`),
      api<FinancialPoint[]>(
        `/groups/${group.id}/financials/trend?${q}&granularity=${granularity}`,
      ),
      api<ServiceStatus[]>(`/groups/${group.id}/services?${q}`),
    ])
      .then(([d, t, s]) => {
        if (valid) {
          setData(d);
          setTrend(t);
          setServices(s);
          setLoadedKey(
            JSON.stringify([group.id, asOf, known, line, granularity, version]),
          );
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [group.id, asOf, known, line, granularity, version]);
  if (error)
    return <ErrorView error={error} retry={() => setVersion((v) => v + 1)} />;
  if (!catalog || !data || data.asOf !== asOf || loadedKey !== requestKey)
    return <Loading />;
  const inspect = (
    metricCode: MetricCode,
    serviceLineId: string | null,
    employeeLevel: string | null = null,
  ) => {
    setHistory({ metricCode, serviceLineId, employeeLevel });
    setSection("history");
  };
  const cell = (
    resolved: ResolvedMetric | null,
    code: MetricCode,
    service: string | null,
    unit = "USD",
  ) => (
    <button
      className="financial-value"
      disabled={!resolved}
      onClick={() => inspect(code, service)}
      aria-label={`Inspect ${code} ${catalog.serviceLines.find((s) => s.id === service)?.name || "Client Group"}`}
    >
      <span>{metricValue(resolved?.value, unit)}</span>
      {resolved?.overrideId && <Badge tone="sage">Override</Badge>}
      {resolved && <History size={12} />}
    </button>
  );
  const headline = [
    {
      label: "Total annual recurring revenue",
      value: money(data.summary.totalARR, true),
      note: data.summary.arrSource,
    },
    {
      label: "Client net worth",
      value: money(data.summary.netWorth?.value, true),
      note: "Latest eligible source snapshot",
    },
    {
      label: "Client tenure",
      value: `${number(data.summary.tenureYears, 1)} years`,
      note: "From relationship inception",
    },
    ...(data.canViewProfitability
      ? [
          {
            label: "Gross margin",
            value: percentage(data.summary.grossMarginPercentage),
            note: data.summary.periodStart
              ? `Period ${dateLabel(data.summary.periodStart)} – ${dateLabel(data.summary.periodEnd)}`
              : "Matching source periods required",
          },
        ]
      : []),
  ];
  const selectedDef = catalog.metrics.find((m) => m.code === historyMetric)!;
  async function loadHistory() {
    inspect(
      historyMetric,
      selectedDef.dimensions === "GROUP" ? null : historyLine || null,
      selectedDef.dimensions === "SERVICE_LEVEL" ? historyLevel : null,
    );
  }
  return (
    <div className="financial-workspace">
      <div className="financial-context-bar">
        <div>
          <Badge tone="sage">
            <Landmark size={12} />
            Mock Fabric source
          </Badge>
          <span>USD · source history preserved</span>
        </div>
        <form
          className="knowledge-control"
          onSubmit={(e) => {
            e.preventDefault();
            setKnown(knownInput ? new Date(knownInput).toISOString() : "");
          }}
        >
          <Clock3 size={14} />
          <label htmlFor="known-at">Known at</label>
          <input
            id="known-at"
            aria-label="Known at timestamp"
            type="datetime-local"
            value={knownInput}
            onChange={(e) => setKnownInput(e.target.value)}
          />
          <button className="btn" type="submit">
            Apply
          </button>
          {known && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setKnown("");
                setKnownInput("");
              }}
            >
              Latest knowledge
            </button>
          )}
        </form>
      </div>
      {known && (
        <div className="notice">
          <Clock3 size={16} />
          <span>
            Historical knowledge: only events recorded by{" "}
            {new Date(known).toLocaleString()} are eligible. Current access
            permissions still apply.
          </span>
        </div>
      )}
      {message && (
        <div role="status" className="notice financial-message">
          {message}
          <button className="text-link" onClick={() => setMessage("")}>
            Dismiss
          </button>
        </div>
      )}
      <div
        className={`financial-stats ${!data.canViewProfitability ? "three-stats" : ""}`}
      >
        {headline.map((h) => (
          <div className="financial-stat" key={h.label}>
            <span>{h.label}</span>
            <strong>{h.value}</strong>
            <small>{h.note}</small>
          </div>
        ))}
      </div>
      {!data.canViewProfitability && (
        <div className="financial-permission-note">
          <LockKeyhole size={15} />
          <p>
            Labor cost and profitability are restricted. You can view other
            financial measures for this authorized Client Group.
          </p>
        </div>
      )}
      <div className="financial-subnav">
        <div>
          {[
            { id: "financials", label: "Financial overview" },
            { id: "hours", label: "Staffing hours" },
            { id: "history", label: "Source & overrides" },
            { id: "services", label: "Service history" },
          ].map((s) => (
            <button
              key={s.id}
              className={section === s.id ? "active" : ""}
              onClick={() => setSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Financial service line"
          value={line}
          onChange={(e) => setLine(e.target.value)}
        >
          <option value="">All service lines</option>
          {catalog.serviceLines.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {!s.active ? " (inactive)" : ""}
            </option>
          ))}
        </select>
      </div>
      {section === "financials" && (
        <>
          <section className="panel financial-trend-panel">
            <div className="panel-heading">
              <div>
                <h2>Relationship economics over time</h2>
                <p>
                  Snapshots remain point-in-time values. Revenue and margin use
                  matching measurement periods.
                </p>
              </div>
              <div className="chart-options">
                <select
                  aria-label="Chart metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as TrendMetric)}
                >
                  {[
                    { id: "arr", label: "ARR" },
                    { id: "netWorth", label: "Net worth" },
                    { id: "revenue", label: "Revenue" },
                    ...(data.canViewProfitability
                      ? [
                          { id: "grossMargin", label: "Gross margin" },
                          {
                            id: "grossMarginPercentage",
                            label: "Gross margin %",
                          },
                        ]
                      : []),
                  ].map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="segmented">
                  <button
                    className={granularity === "monthly" ? "active" : ""}
                    onClick={() => setGranularity("monthly")}
                  >
                    Monthly
                  </button>
                  <button
                    className={granularity === "quarterly" ? "active" : ""}
                    onClick={() => setGranularity("quarterly")}
                  >
                    Quarterly
                  </button>
                </div>
              </div>
            </div>
            <TrendChart
              points={trend}
              metric={metric}
              granularity={granularity}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>As of</th>
                    <th>ARR snapshot</th>
                    <th>Net worth snapshot</th>
                    <th>
                      {granularity === "quarterly"
                        ? "Quarter revenue"
                        : "Period revenue"}
                    </th>
                    {data.canViewProfitability && (
                      <>
                        <th>Gross margin</th>
                        <th>Gross margin %</th>
                      </>
                    )}
                    <th>Measurement period</th>
                  </tr>
                </thead>
                <tbody>
                  {trend.map((p, i) => (
                    <tr key={p.date}>
                      <td>{dateLabel(p.date)}</td>
                      <td>{money(p.arr)}</td>
                      <td>{money(p.netWorth)}</td>
                      <td>{money(p.revenue)}</td>
                      {data.canViewProfitability && (
                        <>
                          <td>{money(p.grossMargin)}</td>
                          <td>{percentage(p.grossMarginPercentage)}</td>
                        </>
                      )}
                      <td>
                        {p.periodStart
                          ? `${p.periodStart} – ${p.periodEnd}`
                          : "Unavailable"}
                        {i === trend.length - 1 && (
                          <small className="block muted">
                            {granularity === "quarterly"
                              ? "Completed months only"
                              : ""}
                          </small>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PeriodComparison points={trend} />
          </section>
          <section className="panel service-financials">
            <div className="panel-heading">
              <div>
                <h2>Financial measures by service line</h2>
                <p>
                  Select a value to inspect its source, revisions and overrides.
                </p>
              </div>
              <Info size={17} />
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Service line / status</th>
                    <th>ARR</th>
                    <th>Revenue</th>
                    {data.canViewProfitability && (
                      <>
                        <th>Direct labor cost</th>
                        <th>Gross margin</th>
                        <th>Margin %</th>
                      </>
                    )}
                    <th>Realization</th>
                    <th>Source effective / recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((l) => (
                    <tr key={l.serviceLine.id}>
                      <td>
                        <strong>{l.serviceLine.name}</strong>
                        <span className="block">
                          <Badge
                            tone={
                              l.status?.status === "Active" ? "green" : "sage"
                            }
                          >
                            {l.status?.status || "Not recorded"}
                          </Badge>
                        </span>
                      </td>
                      <td>{cell(l.arr, "ARR", l.serviceLine.id)}</td>
                      <td>{cell(l.revenue, "REVENUE", l.serviceLine.id)}</td>
                      {data.canViewProfitability && (
                        <>
                          <td>
                            {cell(
                              l.laborCost ?? null,
                              "LABOR_COST",
                              l.serviceLine.id,
                            )}
                          </td>
                          <td>{money(l.grossMargin)}</td>
                          <td>{percentage(l.grossMarginPercentage)}</td>
                        </>
                      )}
                      <td>
                        {cell(
                          l.realization,
                          "REALIZATION",
                          l.serviceLine.id,
                          "PERCENT",
                        )}
                      </td>
                      <td>
                        <span className="source-stamp">
                          {l.arr
                            ? dateLabel(l.arr.effectiveDate)
                            : "No ARR observation"}
                          <small>
                            {l.arr
                              ? `${l.arr.sourceSystem} · ${dateLabel(l.arr.recordedAt)}`
                              : "—"}
                          </small>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="financial-footnote">
              Realization is a synthetic source-defined measure. The approved
              production calculation will be mapped when Fabric is connected.
              Revenue and cost periods are visible in source history.
            </p>
          </section>
        </>
      )}
      {section === "hours" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Staffing hours by employee level</h2>
              <p>
                {catalog.lookbackMonths}-month configured default · selected
                knowledge uses {data.hoursWindow.months} completed months:{" "}
                {dateLabel(data.hoursWindow.start)} to{" "}
                {dateLabel(data.hoursWindow.end)} (exclusive)
              </p>
            </div>
            <Clock3 size={19} />
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Service line</th>
                  <th>Employee level</th>
                  <th>Monthly average</th>
                  <th>Annualized equivalent</th>
                  <th>Source coverage</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.lines.flatMap((l) =>
                  l.hours.map((h) => (
                    <tr key={l.serviceLine.id + h.employeeLevel}>
                      <td>{l.serviceLine.name}</td>
                      <td>{h.employeeLevel}</td>
                      <td>{number(h.monthlyAverage, 2)} hrs</td>
                      <td>{number(h.annualized, 2)} hrs</td>
                      <td>
                        <Badge
                          tone={
                            h.coveredMonths === h.expectedMonths
                              ? "green"
                              : "sage"
                          }
                        >
                          {h.coveredMonths}/{h.expectedMonths} months
                        </Badge>
                        {h.overrideCount > 0 && (
                          <small className="block muted">
                            {h.overrideCount} overridden months
                          </small>
                        )}
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() =>
                            inspect("HOURS", l.serviceLine.id, h.employeeLevel)
                          }
                        >
                          Monthly source history
                          <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
          <p className="financial-footnote">
            Monthly average = complete source hours ÷ lookback months.
            Annualized equivalent = monthly average × 12. Missing months produce
            unavailable values rather than invented zeroes.
          </p>
        </section>
      )}
      {section === "history" && (
        <>
          <section className="panel history-selector">
            <div>
              <h2>Inspect a financial measure</h2>
              <p>
                View original source values, revisions and attributed manual
                overrides.
              </p>
            </div>
            <div className="history-selector-fields">
              <label className="field">
                <span>Metric</span>
                <select
                  aria-label="History metric"
                  value={historyMetric}
                  onChange={(e) =>
                    setHistoryMetric(e.target.value as MetricCode)
                  }
                >
                  {catalog.metrics
                    .filter(
                      (m) =>
                        !m.derived &&
                        (data.canViewProfitability ||
                          m.classification !== "PROFITABILITY"),
                    )
                    .map((m) => (
                      <option key={m.id} value={m.code}>
                        {m.name}
                      </option>
                    ))}
                </select>
              </label>
              {selectedDef.dimensions !== "GROUP" && (
                <label className="field">
                  <span>Service line</span>
                  <select
                    aria-label="History service line"
                    value={historyLine}
                    onChange={(e) => setHistoryLine(e.target.value)}
                  >
                    {selectedDef.dimensions === "GROUP_OR_SERVICE" && (
                      <option value="">Imported family total</option>
                    )}
                    {catalog.serviceLines.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedDef.dimensions === "SERVICE_LEVEL" && (
                <label className="field">
                  <span>Employee level</span>
                  <select
                    aria-label="History employee level"
                    value={historyLevel}
                    onChange={(e) => setHistoryLevel(e.target.value)}
                  >
                    {catalog.employeeLevels.map((l) => (
                      <option key={l}>{l}</option>
                    ))}
                  </select>
                </label>
              )}
              <button className="btn" onClick={loadHistory}>
                <History size={15} />
                Inspect history
              </button>
            </div>
          </section>
          {history && (
            <MetricHistory
              key={`${history.metricCode}-${history.serviceLineId}-${history.employeeLevel}-${version}`}
              groupId={group.id}
              {...history}
              asOf={asOf}
              recordedAsOf={known}
              canEdit={data.canEdit}
              onClose={() => setHistory(null)}
              onOverride={setForm}
              onChanged={() => setVersion((v) => v + 1)}
            />
          )}
        </>
      )}
      {section === "services" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Effective-dated service history</h2>
              <p>
                Service status is separate from ARR. Each change retains its
                prior state.
              </p>
            </div>
            {data.canEdit && (
              <button
                className="btn"
                onClick={() =>
                  setForm({
                    type: "serviceStatus",
                    groupId: group.id,
                    serviceLineId: line || catalog.serviceLines[0]?.id,
                  })
                }
              >
                <Plus size={15} />
                Record service change
              </button>
            )}
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Service line</th>
                  <th>Status</th>
                  <th>Effective from / until</th>
                  <th>Responsible team</th>
                  <th>Reason / source</th>
                  <th>Recorded by</th>
                </tr>
              </thead>
              <tbody>
                {services
                  .filter((s) => !line || s.serviceLineId === line)
                  .map((s) => (
                    <tr key={s.id}>
                      <td>
                        {
                          catalog.serviceLines.find(
                            (l) => l.id === s.serviceLineId,
                          )?.name
                        }
                      </td>
                      <td>
                        <Badge tone={s.status === "Active" ? "green" : "sage"}>
                          {s.status}
                        </Badge>
                      </td>
                      <td>
                        {dateLabel(s.startDate)}
                        <small className="block muted">
                          until {dateLabel(s.endDate)}; later transitions take
                          precedence
                        </small>
                      </td>
                      <td>{s.team}</td>
                      <td className="financial-reason">
                        {s.reason}
                        <small className="block muted">{s.source}</small>
                      </td>
                      <td>
                        {s.actor}
                        <small className="block muted">
                          {new Date(s.recordedAt).toLocaleString()}
                        </small>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {data.warnings.length > 0 && (
        <div className="financial-warnings">
          <Info size={17} />
          <div>
            <strong>Data-quality observations</strong>
            {data.warnings.map((w) => (
              <p key={w}>{w}</p>
            ))}
          </div>
        </div>
      )}
      <div className="below-table">
        <ShieldCheck size={15} />
        <p>
          Mock data · USD · current permissions apply to historical views ·
          imported observations are immutable
        </p>
      </div>
      {form && (
        <FinancialForm
          request={form}
          boot={boot}
          catalog={catalog}
          onClose={() => setForm(null)}
          onSaved={(msg) => {
            setForm(null);
            setVersion((v) => v + 1);
            setMessage(
              msg +
                (known
                  ? " The historical knowledge cutoff remains applied."
                  : ""),
            );
          }}
        />
      )}
    </div>
  );
}
function PeriodComparison({ points }: { points: FinancialPoint[] }) {
  const current = points.at(-1)?.arr,
    previous = points.at(-2)?.arr,
    difference =
      current !== null &&
      current !== undefined &&
      previous !== null &&
      previous !== undefined
        ? current - previous
        : null;
  return (
    <div className="period-comparison">
      <History size={15} />
      <span>ARR change versus previous displayed date</span>
      <strong>
        {difference === null
          ? "Unavailable"
          : `${difference >= 0 ? "+" : ""}${money(difference)}`}
      </strong>
      <span>
        {difference !== null && previous
          ? `(${percentage((difference / previous) * 100)})`
          : "Percentage unavailable at zero or missing prior ARR"}
      </span>
    </div>
  );
}
export function FinancialTeaser({
  groupId,
  asOf,
  onOpen,
}: {
  groupId: string;
  asOf: string;
  onOpen: () => void;
}) {
  const [data, setData] = useState<Overview>(),
    [error, setError] = useState("");
  useEffect(() => {
    let valid = true;
    api<Overview>(`/groups/${groupId}/financials?asOf=${asOf}`)
      .then((d) => {
        if (valid) setData(d);
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [groupId, asOf]);
  return (
    <section className="panel financial-teaser">
      <div className="panel-heading">
        <div>
          <h2>Relationship financial overview</h2>
          <p>Mock Fabric data · as of {dateLabel(asOf)}</p>
        </div>
        <button className="text-link" onClick={onOpen}>
          View financial history
          <ArrowUpRight size={14} />
        </button>
      </div>
      {error ? (
        <p className="error-box">{error}</p>
      ) : data && data.asOf === asOf ? (
        <div className="teaser-values">
          <div>
            <span>Total ARR</span>
            <strong>{money(data.summary.totalARR, true)}</strong>
          </div>
          <div>
            <span>Net worth</span>
            <strong>{money(data.summary.netWorth?.value, true)}</strong>
          </div>
          {data.canViewProfitability && (
            <div>
              <span>Gross margin</span>
              <strong>{percentage(data.summary.grossMarginPercentage)}</strong>
            </div>
          )}
          <div>
            <span>Active service lines</span>
            <div className="group-tags">
              {data.lines
                .filter((l) => l.status?.status === "Active")
                .map((l) => (
                  <Badge key={l.serviceLine.id} tone="sage">
                    {l.serviceLine.name}
                  </Badge>
                ))}
            </div>
          </div>
        </div>
      ) : (
        <Loading />
      )}
    </section>
  );
}
