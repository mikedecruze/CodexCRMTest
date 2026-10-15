import {
  ArrowDown,
  ArrowUpRight,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import type { Bootstrap, Group, Page } from "../../shared/types";
import { api, dateLabel, initials } from "../api";

import {
  Avatar,
  Badge,
  Empty,
  ErrorView,
  Loading,
  PageHeading,
  Pager,
} from "../components/ui";

export function GroupDirectory({
  boot,
  version,
  onCreate,
}: {
  boot: Bootstrap;
  version: number;
  onCreate: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const query = params.get("q") || "",
    status = params.get("status") || "",
    team = params.get("team") || "",
    partner = params.get("partner") || "",
    manager = params.get("manager") || "";
  const [data, setData] = useState<Page<Group> | null>(null),
    [error, setError] = useState("");
  const [filters, setFilters] = useState(!!(team || partner || manager)),
    [viewName, setViewName] = useState("");
  const storageKey = `trove.views.${boot.user.id}`;
  const [views, setViews] = useState<{ name: string; query: string }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || "[]");
    } catch {
      return [];
    }
  });
  function update(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  useEffect(() => {
    let valid = true;
    setError("");
    const timer = setTimeout(
      () =>
        api<Page<Group>>(`/groups?${params.toString()}`)
          .then((d) => {
            if (valid) setData(d);
          })
          .catch((e) => {
            if (valid) setError(e.message);
          }),
      150,
    );
    return () => {
      valid = false;
      clearTimeout(timer);
    };
  }, [params, version]);
  function save() {
    if (!viewName.trim()) return;
    const next = [
      ...views.filter((v) => v.name !== viewName.trim()),
      { name: viewName.trim(), query: params.toString() },
    ].slice(-10);
    setViews(next);
    localStorage.setItem(storageKey, JSON.stringify(next));
    setViewName("");
  }
  return (
    <>
      <PageHeading
        eyebrow="RELATIONSHIP DIRECTORY"
        title="Client Groups"
        description="The families at the center of everything you do."
        action={
          boot.user.level !== "Associate" || boot.user.role === "admin" ? (
            <button className="btn primary" onClick={onCreate}>
              <Plus size={17} />
              New client group
            </button>
          ) : (
            <Badge tone="sage">Read-only access</Badge>
          )
        }
      />
      <div className="directory-summary">
        <span>
          <i className="dot green" />
          {boot.stats.groups} client groups in your workspace
        </span>
        <span>
          <ShieldCheck size={14} />
          Team-authorized view
        </span>
      </div>
      <section className="panel directory-panel">
        <div className="directory-tabs">
          <button
            className={!status ? "active" : ""}
            onClick={() => update("status", "")}
          >
            All groups<span>{boot.groups.length}</span>
          </button>
          {["Active", "Prospective", "Inactive", "Archived"].map((s) => (
            <button
              key={s}
              className={status === s ? "active" : ""}
              onClick={() => update("status", s)}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="table-tools">
          <div className="input-search">
            <Search size={16} />
            <input
              aria-label="Search client groups"
              placeholder="Search client groups…"
              value={query}
              onChange={(e) => update("q", e.target.value)}
            />
          </div>
          <div className="inline">
            <button
              className={`btn ${filters ? "selected" : ""}`}
              onClick={() => setFilters(!filters)}
            >
              <SlidersHorizontal size={15} />
              Filters
            </button>
            <select
              aria-label="Saved view"
              value=""
              onChange={(e) => {
                const v = views.find((v) => v.name === e.target.value);
                if (v) setParams(v.query);
              }}
            >
              <option value="">Saved views</option>
              {views.map((v) => (
                <option key={v.name}>{v.name}</option>
              ))}
            </select>
          </div>
        </div>
        {filters && (
          <div className="filter-row">
            {[
              {
                key: "team",
                label: "Service team",
                value: team,
                options: boot.teams.map((t) => ({ id: t.id, name: t.name })),
              },
              {
                key: "partner",
                label: "Partner",
                value: partner,
                options: boot.employees
                  .filter((e) => e.level === "Partner")
                  .map((e) => ({ id: e.id, name: e.displayName })),
              },
              {
                key: "manager",
                label: "Relationship Manager",
                value: manager,
                options: boot.employees.map((e) => ({
                  id: e.id,
                  name: e.displayName,
                })),
              },
            ].map((f) => (
              <label key={f.key}>
                <span>{f.label}</span>
                <select
                  value={f.value}
                  onChange={(e) => update(f.key, e.target.value)}
                >
                  <option value="">All</option>
                  {f.options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <div>
              <input
                aria-label="New saved view name"
                placeholder="Name this view"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
              />
              <button
                className="text-link"
                onClick={save}
                disabled={!viewName.trim()}
              >
                Save view
              </button>
              <button className="text-link" onClick={() => setParams({})}>
                Clear filters
              </button>
            </div>
          </div>
        )}
        {error ? (
          <ErrorView
            error={error}
            retry={() => setParams(new URLSearchParams(params))}
          />
        ) : !data ? (
          <Loading />
        ) : !data.items.length ? (
          <Empty
            title="No client groups found"
            description="Try adjusting your filters, or create a group to start building relationships."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>
                    Client group <ArrowDown size={12} />
                  </th>
                  <th>Status</th>
                  <th>Primary Partner</th>
                  <th>Relationship Manager</th>
                  <th>Service team</th>
                  <th>Client since</th>
                  <th aria-label="Open" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <Link className="table-name" to={`/groups/${g.id}`}>
                        <Avatar name={g.name} />
                        <span>
                          <strong>{g.name}</strong>
                          <small>
                            {g.peopleCount} individuals · {g.entityCount}{" "}
                            entities
                          </small>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <Badge tone={g.status === "Active" ? "green" : "sage"}>
                        {g.status}
                      </Badge>
                    </td>
                    <td>
                      <div className="person-cell">
                        <span className="mini-avatar">
                          {initials(g.partner)}
                        </span>
                        {g.partner}
                      </div>
                    </td>
                    <td>{g.manager}</td>
                    <td>
                      <span className="team-pill">
                        <i />
                        {g.team}
                      </span>
                    </td>
                    <td className="muted">{dateLabel(g.inceptionDate)}</td>
                    <td>
                      <Link
                        aria-label={`Open ${g.name}`}
                        to={`/groups/${g.id}`}
                      >
                        <ArrowUpRight size={17} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && (
          <Pager {...data} onChange={(n) => update("page", String(n))} />
        )}
      </section>
      <div className="below-table">
        <ShieldCheck size={15} />
        <p>
          Shared people, entities and advisors stay connected. Confidential
          family information stays within its authorized team.
        </p>
      </div>
    </>
  );
}
