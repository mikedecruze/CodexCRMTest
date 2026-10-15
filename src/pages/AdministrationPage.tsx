import { Clock3, Plus, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import type { Audit, Bootstrap, Reference } from "../../shared/types";
import { api, dateLabel } from "../api";
import { type FormRequest } from "../components/RecordForm";

import { Badge, PageHeading } from "../components/ui";

export function Administration({
  boot,
  version,
  onForm,
}: {
  boot: Bootstrap;
  version: number;
  onForm: (r: FormRequest) => void;
}) {
  const [tab, setTab] = useState("references"),
    [category, setCategory] = useState("entity"),
    [data, setData] = useState<{
      memberships: {
        id: string;
        employee: string;
        team: string;
        startDate: string;
        endDate: string | null;
      }[];
      audit: Audit[];
    }>(),
    [error, setError] = useState("");
  useEffect(() => {
    if (boot.user.role !== "admin") return;
    let valid = true;
    api<typeof data>("/admin")
      .then((d) => {
        if (valid) setData(d);
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
          eyebrow="ADMINISTRATION"
          title="Access is restricted"
          description="Reference definitions, team memberships and firmwide audit history require administrator access."
        />
        <div className="notice">
          <ShieldCheck size={22} />
          <span>
            Your {boot.user.level} access is enforced by the API. Contact an
            administrator to request changes.
          </span>
        </div>
      </>
    );
  return (
    <>
      <PageHeading
        eyebrow="WORKSPACE SETTINGS"
        title="Administration"
        description="Maintain consistent definitions, team access and an accountable record of change."
        action={
          <Link className="btn" to="/admin/financial">
            Financial data & imports
          </Link>
        }
      />
      <div className="profile-tabs">
        {[
          { id: "references", label: "Reference types" },
          { id: "teams", label: "Teams & employees" },
          { id: "audit", label: "Audit history" },
        ].map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && <p className="error-box">{error}</p>}
      {tab === "references" && (
        <section className="panel">
          <div className="table-tools">
            <select
              aria-label="Reference category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {["entity", "relationship", "advisor", "contact"].map((c) => (
                <option key={c} value={c}>
                  {c === "entity"
                    ? "Legal entity types"
                    : c === "relationship"
                      ? "Relationship types"
                      : c === "advisor"
                        ? "Advisor categories"
                        : "Contact roles"}
                </option>
              ))}
            </select>
            <button
              className="btn primary"
              onClick={() => onForm({ type: "reference" })}
            >
              <Plus size={15} />
              Add definition
            </button>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Display label</th>
                  <th>Stable code</th>
                  <th>Behavior</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {boot.references
                  .filter((r) => r.category === category)
                  .map((r: Reference) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.label}</strong>
                      </td>
                      <td>
                        <code>{r.code}</code>
                      </td>
                      <td>
                        {r.symmetric
                          ? "Symmetric"
                          : r.ownership
                            ? "Ownership"
                            : "Standard"}
                      </td>
                      <td>
                        <Badge tone={r.active ? "green" : "sage"}>
                          {r.active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="text-link"
                          onClick={() =>
                            onForm({ type: "referenceEdit", reference: r })
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
      )}
      {tab === "teams" && (
        <>
          <div className="team-grid">
            {boot.teams.map((t) => (
              <section className="panel" key={t.id}>
                <div className="panel-heading">
                  <Users size={22} />
                  <div>
                    <h2>{t.name}</h2>
                    <p>{t.description}</p>
                  </div>
                  <Badge>{t.active ? "Active" : "Inactive"}</Badge>
                </div>
              </section>
            ))}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Effective-dated team memberships</h2>
              <button
                className="btn"
                onClick={() => onForm({ type: "teamMembership" })}
              >
                <Plus size={15} />
                Add membership
              </button>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Service team</th>
                    <th>Effective from</th>
                    <th>Until (exclusive)</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.memberships.map((m) => (
                    <tr key={m.id}>
                      <td>{m.employee}</td>
                      <td>{m.team}</td>
                      <td>{dateLabel(m.startDate)}</td>
                      <td>{dateLabel(m.endDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === "audit" && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Material changes</h2>
              <p>Latest 100 authorized events · append-only</p>
            </div>
            <ShieldCheck size={19} />
          </div>
          {data?.audit.map((a) => (
            <div className="audit-row" key={a.id}>
              <Clock3 size={17} />
              <div>
                <strong>{a.action}</strong>
                <p>
                  {a.actor} · {new Date(a.createdAt).toLocaleString()}
                </p>
                <details>
                  <summary>Inspect change</summary>
                  <pre>
                    {JSON.stringify(
                      {
                        before: a.before ? JSON.parse(a.before) : null,
                        after: a.after ? JSON.parse(a.after) : null,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
