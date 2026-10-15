import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  BarChart3,
  Landmark,
  LockKeyhole,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { Bootstrap } from "../../shared/types";
import type { FinancialCatalog, FinancialReport } from "../../shared/financial";
import { api, dateLabel, dateToday } from "../api";
import { Badge, ErrorView, Loading, PageHeading } from "../components/ui";
import { money, percentage } from "../components/financial/format";
export function FinancialReporting({ boot }: { boot: Bootstrap }) {
  const [catalog, setCatalog] = useState<FinancialCatalog>(),
    [data, setData] = useState<FinancialReport>(),
    [asOf, setAsOf] = useState(dateToday()),
    [knownInput, setKnownInput] = useState(""),
    [known, setKnown] = useState(""),
    [service, setService] = useState(""),
    [team, setTeam] = useState(""),
    [partner, setPartner] = useState(""),
    [manager, setManager] = useState(""),
    [status, setStatus] = useState(""),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [page, setPage] = useState(1);
  useEffect(() => {
    api<FinancialCatalog>("/financial/catalog")
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let valid = true;
    setPage(1);
    const q = new URLSearchParams({
      asOf,
      ...(known ? { recordedAsOf: known } : {}),
      ...(service ? { serviceLineId: service } : {}),
      ...(team ? { teamId: team } : {}),
      ...(partner ? { partnerId: partner } : {}),
      ...(manager ? { managerId: manager } : {}),
      ...(status ? { status } : {}),
    });
    api<FinancialReport>(`/financial/reports?${q}`)
      .then((r) => {
        if (valid) {
          setData(r);
          setError("");
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [asOf, known, service, team, partner, manager, status, version]);
  if (error)
    return <ErrorView error={error} retry={() => setVersion((v) => v + 1)} />;
  if (!catalog || !data || data.asOf !== asOf) return <Loading />;
  const options = (
    values: { id: string; name?: string; displayName?: string }[],
  ) =>
    values.map((o) => (
      <option key={o.id} value={o.id}>
        {o.name || o.displayName}
      </option>
    ));
  const lineTotals = data.serviceTotals.map((l) => ({
    ...l,
    count: l.groupCount,
  }));
  const max = Math.max(1, ...lineTotals.map((l) => l.arr ?? 0));
  return (
    <>
      <PageHeading
        eyebrow="HISTORICAL FINANCIAL REPORTING"
        title="A clearer view of relationship economics."
        description="Authorized Client Groups, consistent source measures and preserved history."
        action={
          boot.user.role === "admin" ? (
            <Link className="btn" to="/admin/financial">
              <Landmark size={16} />
              Manage financial data
            </Link>
          ) : (
            <Badge tone="sage">Mock Fabric source</Badge>
          )
        }
      />
      <section className="panel report-filter-panel">
        <div className="panel-heading">
          <div className="inline">
            <SlidersHorizontal size={16} />
            <h2>Report scope</h2>
          </div>
          <Badge tone="sage">USD · synthetic data</Badge>
        </div>
        <div className="report-filters">
          <label className="field">
            <span>As-of date</span>
            <input
              aria-label="Report as-of date"
              type="date"
              value={asOf}
              onChange={(e) => {
                if (e.target.value) setAsOf(e.target.value);
              }}
            />
          </label>
          <label className="field">
            <span>Active service line</span>
            <select
              aria-label="Report service line"
              value={service}
              onChange={(e) => setService(e.target.value)}
            >
              <option value="">All service lines</option>
              {options(catalog.serviceLines)}
            </select>
          </label>
          <label className="field">
            <span>Service team</span>
            <select
              aria-label="Report service team"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
            >
              <option value="">All teams</option>
              {options(boot.teams)}
            </select>
          </label>
          <label className="field">
            <span>Partner</span>
            <select
              aria-label="Report Partner"
              value={partner}
              onChange={(e) => setPartner(e.target.value)}
            >
              <option value="">All Partners</option>
              {options(boot.employees.filter((e) => e.level === "Partner"))}
            </select>
          </label>
          <label className="field">
            <span>Relationship Manager</span>
            <select
              aria-label="Report Relationship Manager"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
            >
              <option value="">All managers</option>
              {options(boot.employees)}
            </select>
          </label>
          <label className="field">
            <span>Client status</span>
            <select
              aria-label="Report client status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All statuses</option>
              {["Active", "Prospective", "Inactive", "Archived"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <form
          className="report-knowledge"
          onSubmit={(e) => {
            e.preventDefault();
            setKnown(knownInput ? new Date(knownInput).toISOString() : "");
          }}
        >
          <label htmlFor="report-known">Known at</label>
          <input
            id="report-known"
            aria-label="Report known at timestamp"
            type="datetime-local"
            value={knownInput}
            onChange={(e) => setKnownInput(e.target.value)}
          />
          <button className="btn">Apply knowledge cutoff</button>
          {known && (
            <button
              type="button"
              className="text-link"
              onClick={() => {
                setKnown("");
                setKnownInput("");
              }}
            >
              Use latest
            </button>
          )}
          <small>
            {known
              ? "Historical recorded knowledge; current permissions."
              : "Latest recorded knowledge."}
          </small>
        </form>
      </section>
      <div className="financial-stats">
        <div className="financial-stat">
          <span>Client Groups in scope</span>
          <strong>{data.rows.length}</strong>
          <small>Only authorized relationships</small>
        </div>
        <div className="financial-stat">
          <span>Total ARR</span>
          <strong>{money(data.totals.arr, true)}</strong>
          <small>One snapshot per selected date</small>
        </div>
        <div className="financial-stat">
          <span>Client net worth</span>
          <strong>{money(data.totals.netWorth, true)}</strong>
          <small>Group-level snapshots</small>
        </div>
        <div className="financial-stat">
          <span>Portfolio gross margin</span>
          <strong>
            {data.canViewAllProfitability ? (
              percentage(data.totals.grossMarginPercentage)
            ) : (
              <LockKeyhole size={24} />
            )}
          </strong>
          <small>
            {data.canViewAllProfitability
              ? "Weighted from revenue and labor cost"
              : "Requires approved scope for every group"}
          </small>
        </div>
      </div>
      <section className="panel reporting-service-panel">
        <div className="panel-heading">
          <div>
            <h2>ARR by service line</h2>
            <p>
              Service-line values only; imported family totals are excluded from
              dimensional sums.
            </p>
          </div>
          <BarChart3 size={18} />
        </div>
        <div className="service-bars">
          {lineTotals.map((l) => (
            <div className="service-bar" key={l.name}>
              <span>{l.name}</span>
              <div>
                <i style={{ width: `${((l.arr ?? 0) / max) * 100}%` }} />
              </div>
              <strong>{money(l.arr)}</strong>
              <small>
                {l.coverage}/{l.count} groups with data
              </small>
            </div>
          ))}
        </div>
      </section>
      <section className="panel reporting-service-panel">
        <div className="panel-heading">
          <div>
            <h2>Service-line economics</h2>
            <p>
              Compatible monthly components across the selected authorized
              cohort.
            </p>
          </div>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Service line</th>
                <th>ARR snapshot</th>
                <th>Period revenue</th>
                <th>Gross margin</th>
                <th>Margin %</th>
                <th>Measurement period</th>
              </tr>
            </thead>
            <tbody>
              {data.serviceTotals.map((l) => (
                <tr key={l.serviceLineId}>
                  <td>{l.name}</td>
                  <td>{money(l.arr)}</td>
                  <td>{money(l.revenue)}</td>
                  <td>
                    {data.canViewAllProfitability
                      ? money(l.grossMargin)
                      : "Restricted"}
                  </td>
                  <td>
                    {data.canViewAllProfitability
                      ? percentage(l.grossMarginPercentage)
                      : "Restricted"}
                  </td>
                  <td>
                    {l.periodStart
                      ? `${l.periodStart} – ${l.periodEnd}`
                      : "Unavailable"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel reporting-service-panel">
        <div className="panel-heading">
          <div>
            <h2>Client net worth distribution</h2>
            <p>
              One group-level snapshot per Client Group ·{" "}
              {data.missingNetWorthCount} without eligible source data
            </p>
          </div>
        </div>
        <div className="net-worth-buckets">
          {data.netWorthDistribution.map((b) => (
            <div key={b.label}>
              <strong>{b.count}</strong>
              <span>{b.label}</span>
            </div>
          ))}
        </div>
      </section>
      {data.warnings.map((w) => (
        <div className="notice financial-report-warning" key={w}>
          <LockKeyhole size={16} />
          <span>{w}</span>
        </div>
      ))}
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Historical client economics</h2>
            <p>
              As of {dateLabel(asOf)}
              {data.periodStart
                ? ` · revenue measurement ${data.periodStart} to ${data.periodEnd} (exclusive)`
                : ""}
            </p>
          </div>
          <Badge tone="sage">{data.rows.length} relationships</Badge>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Client Group</th>
                <th>Total ARR</th>
                <th>Net worth</th>
                <th>Tenure</th>
                <th>Period revenue</th>
                <th>Gross margin</th>
                <th>Margin %</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows
                .slice((page - 1) * 20, page * 20)
                .map(({ group, financial: f }) => (
                  <tr key={group.id}>
                    <td>
                      <Link
                        className="record-link"
                        to={`/groups/${group.id}?tab=4&asOf=${asOf}`}
                      >
                        {group.name}
                      </Link>
                      <small className="block muted">
                        {group.team} · {group.manager}
                      </small>
                    </td>
                    <td>{money(f.summary.totalARR)}</td>
                    <td>{money(f.summary.netWorth?.value)}</td>
                    <td>{f.summary.tenureYears.toFixed(1)} years</td>
                    <td>{money(f.summary.revenue)}</td>
                    <td>
                      {f.canViewProfitability ? (
                        money(f.summary.grossMargin)
                      ) : (
                        <span className="restricted-cell">
                          <LockKeyhole size={12} />
                          Restricted
                        </span>
                      )}
                    </td>
                    <td>
                      {f.canViewProfitability
                        ? percentage(f.summary.grossMarginPercentage)
                        : "Restricted"}
                    </td>
                    <td>
                      <Link
                        className="text-link"
                        aria-label={`View financials for ${group.name}`}
                        to={`/groups/${group.id}?tab=4&asOf=${asOf}`}
                      >
                        Inspect
                        <ArrowUpRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!data.rows.length && (
          <p className="empty">
            No authorized Client Groups match these filters.
          </p>
        )}
        <div className="pagination">
          <span>
            {data.rows.length} authorized records · missing data remains
            unavailable
          </span>
          <div>
            <button
              className="btn"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              className="btn"
              disabled={page * 20 >= data.rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </section>
      <div className="below-table">
        <LockKeyhole size={15} />
        <p>
          No point-in-time snapshots are summed across months. Service filters
          use active effective-dated status, independent of ARR.
        </p>
      </div>
    </>
  );
}
