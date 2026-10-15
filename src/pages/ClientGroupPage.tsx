import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  ChevronDown,
  Clock3,
  Home,
  Landmark,
  Leaf,
  LockKeyhole,
  MoreHorizontal,
  Plus,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import type { Audit, Bootstrap, GroupDetail } from "../../shared/types";
import { api, dateLabel, dateToday, initials } from "../api";
import {
  FinancialOverview,
  FinancialTeaser,
} from "../components/financial/FinancialOverview";
import { RelationshipGraph } from "../components/Graph";
import { type FormRequest } from "../components/RecordForm";

import { PartyTable } from "../components/PartyTable";
import { Avatar, Badge, Empty, ErrorView, Loading } from "../components/ui";
const tabs = [
  "Overview",
  "Family & Households",
  "Entities & Ownership",
  "Advisors & Stakeholders",
  "Financial Overview",
];

export function GroupProfile({
  boot,
  version,
  onForm,
  onParty,
}: {
  boot: Bootstrap;
  version: number;
  onForm: (r: FormRequest, d: GroupDetail) => void;
  onParty: (id: string) => void;
}) {
  const { id } = useParams(),
    [params, setParams] = useSearchParams(),
    tab = [0, 1, 2, 3, 4].includes(Number(params.get("tab") || 0))
      ? Number(params.get("tab") || 0)
      : 0,
    asOf = params.get("asOf") || dateToday();
  const [data, setData] = useState<GroupDetail>(),
    [error, setError] = useState(""),
    [menu, setMenu] = useState(false),
    [audit, setAudit] = useState<Audit[] | null>(null);
  useEffect(() => {
    let valid = true;
    setError("");
    api<GroupDetail>(`/groups/${id}?asOf=${encodeURIComponent(asOf)}`)
      .then((d) => {
        if (valid) {
          setData(d);
          setAudit(null);
        }
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [id, asOf, version]);
  const paramsRef = useRef(params);
  useEffect(() => {
    paramsRef.current = params;
  }, [params]);
  function change(key: string, value: string) {
    const p = new URLSearchParams(paramsRef.current);
    p.set(key, value);
    paramsRef.current = p;
    setParams(p);
  }
  if (error)
    return <ErrorView error={error} retry={() => change("asOf", asOf)} />;
  if (!data || data.group.id !== id || data.asOf !== asOf) return <Loading />;
  const { group, people, entities, households, advisors, relationships } = data;
  const add = (type: string, extra: Partial<FormRequest> = {}) => {
    setMenu(false);
    onForm({ type, ...extra }, data);
  };
  const all = [...people, ...entities, ...advisors];
  const byId = new Map(all.map((p) => [p.id, p]));
  const familyRelationships = relationships.filter((r) =>
    ["parent", "spouse", "former-spouse", "sibling"].includes(r.code),
  );
  const entityRelationships = relationships.filter(
    (r) => !["parent", "spouse", "former-spouse", "sibling"].includes(r.code),
  );
  const entityIds = new Set([
    ...entityRelationships.flatMap((r) => [r.sourceId, r.targetId]),
    ...entities.map((e) => e.id),
  ]);
  const entityParties = [
    ...new Map(
      all.filter((p) => entityIds.has(p.id)).map((p) => [p.id, p]),
    ).values(),
  ];
  return (
    <>
      <Link to="/groups" className="back-link">
        <ArrowLeft size={14} />
        All client groups
      </Link>
      <div className="group-header">
        <div className="group-title">
          <Avatar name={group.name} size="large" />
          <div>
            <div className="inline">
              <h1>{group.name}</h1>
              <Badge tone={group.status === "Active" ? "green" : "sage"}>
                {group.status}
              </Badge>
            </div>
            <p>
              {group.displayName} <span>·</span> Client since{" "}
              {dateLabel(group.inceptionDate)}
            </p>
          </div>
        </div>
        <div className="inline">
          <button
            className="btn"
            onClick={async () => {
              try {
                setAudit(await api<Audit[]>(`/audit?groupId=${id}`));
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            <Clock3 size={16} />
            History
          </button>
          {group.canEdit ? (
            <div className="menu-wrap">
              <button
                className="btn primary"
                aria-expanded={menu}
                onClick={() => setMenu(!menu)}
              >
                <Plus size={16} />
                Add record
                <ChevronDown size={14} />
              </button>
              {menu && (
                <div className="action-menu">
                  {[
                    { type: "groupProfile", label: "Edit client group" },
                    { type: "person", label: "Individual" },
                    { type: "household", label: "Household" },
                    { type: "entity", label: "Legal entity" },
                    { type: "associate", label: "Associate existing entity" },
                    { type: "advisor", label: "New advisor" },
                    { type: "advisorExisting", label: "Link existing advisor" },
                    { type: "membership", label: "Household member" },
                    { type: "relationship", label: "Relationship" },
                    { type: "assignments", label: "Change assignments" },
                    { type: "archive", label: "Archive client group" },
                  ].map((x) => (
                    <button key={x.type} onClick={() => add(x.type)}>
                      {x.label}
                      <Plus size={13} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <Badge tone="sage">
              <LockKeyhole size={12} />
              Read-only
            </Badge>
          )}
        </div>
      </div>
      <div className="group-meta">
        <span>
          <span className="meta-label">PARTNER</span>
          <span className="mini-avatar">{initials(group.partner)}</span>
          {group.partner}
        </span>
        <span>
          <span className="meta-label">RELATIONSHIP MANAGER</span>
          <span className="mini-avatar">{initials(group.manager)}</span>
          {group.manager}
        </span>
        <span>
          <span className="meta-label">SERVICE TEAM</span>
          <i className="dot green" />
          {group.team}
        </span>
      </div>
      <div
        className="profile-tabs"
        role="tablist"
        aria-label="Client Group sections"
      >
        {tabs.map((label, i) => (
          <button
            key={label}
            role="tab"
            aria-selected={tab === i}
            className={tab === i ? "active" : ""}
            onClick={() => change("tab", String(i))}
          >
            {label}
            {i === 1 && <span>{people.length}</span>}
            {i === 2 && <span>{entities.length}</span>}
            {i === 3 && <span>{advisors.length}</span>}
          </button>
        ))}
      </div>
      <div className="profile-toolbar">
        <div className="inline">
          <span className="eyebrow">{tabs[tab].toUpperCase()}</span>
          <span className="muted small">
            {asOf < dateToday() ? "Historical view" : "Relationship view"}
          </span>
        </div>
        <label className="asof">
          <Clock3 size={15} />
          <span>As of</span>
          <input
            type="date"
            aria-label="As-of date"
            value={asOf}
            onChange={(e) => {
              if (e.target.value) change("asOf", e.target.value);
            }}
          />
        </label>
      </div>
      {audit && (
        <section className="panel history-panel">
          <div className="panel-heading">
            <h2>Audit history</h2>
            <button
              className="icon-btn"
              aria-label="Close history"
              onClick={() => setAudit(null)}
            >
              <X size={17} />
            </button>
          </div>
          {audit.length ? (
            audit.map((a) => (
              <div className="audit-row" key={a.id}>
                <Clock3 size={15} />
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
            ))
          ) : (
            <Empty
              title="No changes recorded"
              description="Material changes will appear here with their author and timestamp."
            />
          )}
        </section>
      )}
      {tab === 0 && (
        <>
          <FinancialTeaser
            groupId={group.id}
            asOf={asOf}
            onOpen={() => change("tab", "4")}
          />
          <div className="profile-stat-grid">
            {[
              {
                value: people.length,
                label: "Individuals",
                Icon: Users,
                index: 1,
              },
              {
                value: households.length,
                label: "Households",
                Icon: Home,
                index: 1,
              },
              {
                value: entities.length,
                label: "Entities & trusts",
                Icon: Landmark,
                index: 2,
              },
              {
                value: advisors.length,
                label: "External advisors",
                Icon: Building2,
                index: 3,
              },
            ].map(({ value, label, Icon, index }) => (
              <button
                key={label}
                className="profile-stat"
                onClick={() => change("tab", String(index))}
              >
                <span className="quick-icon">
                  <Icon size={20} />
                </span>
                <div>
                  <strong>{value.toString().padStart(2, "0")}</strong>
                  <span>{label}</span>
                </div>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
          <div className="overview-columns">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Family at a glance</h2>
                  <p>The people behind the relationship</p>
                </div>
                <button
                  className="text-link"
                  onClick={() => change("tab", "1")}
                >
                  View family
                  <ArrowRight size={14} />
                </button>
              </div>
              {households.length ? (
                households.map((h) => (
                  <div key={h.id} className="household-summary">
                    <div>
                      <Home size={17} />
                      <strong>{h.name}</strong>
                      <span>{h.members.length} members</span>
                    </div>
                    <div className="household-people">
                      {h.members.map((m) => (
                        <button key={m.id} onClick={() => onParty(m.personId)}>
                          <Avatar name={m.name} size="small" />
                          <span>
                            {m.name}
                            {m.isPrimary ? (
                              <small>Primary contact</small>
                            ) : null}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <Empty
                  title="No households at this date"
                  description="Create households and effective-dated memberships to organize family branches."
                />
              )}
            </section>
            <div className="overview-side">
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Relationship team</h2>
                    <p>Clear ownership. Connected service.</p>
                  </div>
                  {group.canEdit && (
                    <button
                      className="icon-btn"
                      aria-label="Edit assignments"
                      onClick={() => add("assignments")}
                    >
                      <MoreHorizontal size={19} />
                    </button>
                  )}
                </div>
                {[
                  { name: group.partner, role: "Primary Partner" },
                  { name: group.manager, role: "Relationship Manager" },
                ].map((p) => (
                  <div className="team-person" key={p.role}>
                    <Avatar name={p.name} />
                    <div>
                      <strong>{p.name}</strong>
                      <span>{p.role}</span>
                    </div>
                  </div>
                ))}
                <div className="service-team">
                  <Users size={18} />
                  <span>{group.team}</span>
                  <Badge tone="sage">Primary team</Badge>
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Workspace details</h2>
                  <Leaf size={18} />
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Client since</dt>
                    <dd>{dateLabel(group.inceptionDate)}</dd>
                  </div>
                  <div>
                    <dt>SharePoint folder</dt>
                    <dd>
                      {group.sharepointUrl ? (
                        <a
                          href={group.sharepointUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open folder
                          <ArrowUpRight size={12} />
                        </a>
                      ) : (
                        "Not linked"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Last updated</dt>
                    <dd>{dateLabel(group.updatedAt)}</dd>
                  </div>
                </dl>
                <p className="scope-text">
                  Contracts, tasks and activities are planned for subsequent
                  phases.
                </p>
              </section>
            </div>
          </div>
          <section className="panel assignment-panel">
            <div className="panel-heading">
              <h2>Assignment history</h2>
              <span className="muted small">Preserved across team changes</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Effective from</th>
                    <th>Until (exclusive)</th>
                    <th>Primary Partner</th>
                    <th>Relationship Manager</th>
                    <th>Service team</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assignments.map((a) => (
                    <tr key={a.id}>
                      <td>{dateLabel(a.startDate)}</td>
                      <td>{dateLabel(a.endDate)}</td>
                      <td>{a.partner}</td>
                      <td>{a.manager}</td>
                      <td>{a.team}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === 1 && (
        <>
          <RelationshipGraph
            key={`family-${id}`}
            mode="family"
            parties={people}
            relationships={familyRelationships}
            onSelect={onParty}
          />
          <div className="section-heading">
            <div>
              <h2>Family households</h2>
              <p>Explicit family branches with effective-dated membership</p>
            </div>
            {group.canEdit && (
              <button className="btn" onClick={() => add("household")}>
                <Plus size={15} />
                Add household
              </button>
            )}
          </div>
          <div className="household-grid">
            {households.map((h) => (
              <section className="panel household-card" key={h.id}>
                <div className="panel-heading">
                  <span className="quick-icon">
                    <Home size={19} />
                  </span>
                  <div>
                    <h3>{h.name}</h3>
                    <p>Since {dateLabel(h.startDate)}</p>
                  </div>
                </div>
                {h.members.map((m) => (
                  <button
                    className="member-row"
                    onClick={() => onParty(m.personId)}
                    key={m.id}
                  >
                    <Avatar name={m.name} size="small" />
                    <span>
                      <strong>{m.name}</strong>
                      <small>
                        {m.role} · from {dateLabel(m.startDate)}
                        {m.endDate ? ` until ${dateLabel(m.endDate)}` : ""}
                      </small>
                    </span>
                    {!!m.isPrimary && <Badge tone="sage">Primary</Badge>}
                  </button>
                ))}
                {!h.members.length && (
                  <p className="empty">No members at this date</p>
                )}
                {group.canEdit &&
                  h.members.map((m) => (
                    <button
                      key={`end-${m.id}`}
                      className="text-link end-membership"
                      onClick={() =>
                        add("endRecord", {
                          recordType: "membership",
                          recordId: m.id,
                        })
                      }
                    >
                      End {m.name} membership
                    </button>
                  ))}
                {group.canEdit && (
                  <button
                    className="text-link add-member"
                    onClick={() => add("membership")}
                  >
                    <Plus size={14} />
                    Add household member
                  </button>
                )}
              </section>
            ))}
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>All family individuals</h2>
              {group.canEdit && (
                <button className="text-link" onClick={() => add("person")}>
                  <Plus size={14} />
                  Add individual
                </button>
              )}
            </div>
            <PartyTable
              parties={people}
              onParty={onParty}
              canEdit={group.canEdit}
              onNotes={(p) =>
                add("notes", { associationId: p.associationId, notes: p.notes })
              }
            />
          </section>
          <section className="panel assignment-panel">
            <div className="panel-heading">
              <h2>Family relationships</h2>
              {group.canEdit && (
                <button
                  className="text-link"
                  onClick={() => add("relationship")}
                >
                  <Plus size={14} />
                  Add relationship
                </button>
              )}
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>Relationship</th>
                    <th>To</th>
                    <th>Effective from</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {familyRelationships.map((r) => (
                    <tr key={r.id}>
                      <td>{byId.get(r.sourceId)?.displayName}</td>
                      <td>{r.type}</td>
                      <td>{byId.get(r.targetId)?.displayName}</td>
                      <td>{dateLabel(r.startDate)}</td>
                      <td>
                        {group.canEdit && (
                          <button
                            className="text-link"
                            onClick={() =>
                              add("endRecord", {
                                recordType: "relationship",
                                recordId: r.id,
                              })
                            }
                          >
                            End interval
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
      {tab === 2 && (
        <>
          <RelationshipGraph
            key={`entity-${id}`}
            mode="entity"
            parties={entityParties}
            relationships={entityRelationships}
            onSelect={onParty}
          />
          <div className="section-heading">
            <div>
              <h2>Entities & trusts</h2>
              <p>Shared master records with confidential group context</p>
            </div>
            {group.canEdit && (
              <button className="btn" onClick={() => add("entity")}>
                <Plus size={15} />
                Add entity
              </button>
            )}
          </div>
          <section className="panel">
            <PartyTable
              parties={entities}
              onParty={onParty}
              canEdit={group.canEdit}
              onNotes={(p) =>
                add("notes", { associationId: p.associationId, notes: p.notes })
              }
            />
          </section>
          <section className="panel ownership-table">
            <div className="panel-heading">
              <div>
                <h2>Relationships as of {dateLabel(asOf)}</h2>
                <p>
                  Direct interests only. Indirect ownership is not calculated.
                </p>
              </div>
              {group.canEdit && (
                <button
                  className="text-link"
                  onClick={() => add("relationship")}
                >
                  <Plus size={14} />
                  Add relationship
                </button>
              )}
            </div>
            {entityRelationships.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>From</th>
                      <th>Relationship</th>
                      <th>To</th>
                      <th>Interest</th>
                      <th>Effective from</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {entityRelationships.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => onParty(r.sourceId)}
                          >
                            {byId.get(r.sourceId)?.displayName}
                          </button>
                        </td>
                        <td>{r.type}</td>
                        <td>
                          <button
                            className="text-link"
                            onClick={() => onParty(r.targetId)}
                          >
                            {byId.get(r.targetId)?.displayName}
                          </button>
                        </td>
                        <td>
                          {r.ownershipPercentage !== null
                            ? `${r.ownershipPercentage}% ${r.ownershipClass}`
                            : "—"}
                          {r.votingPercentage !== null && (
                            <small className="block">
                              Voting: {r.votingPercentage}%
                            </small>
                          )}
                          {r.economicPercentage !== null && (
                            <small className="block">
                              Economic: {r.economicPercentage}%
                            </small>
                          )}
                        </td>
                        <td>{dateLabel(r.startDate)}</td>
                        <td>
                          {!!r.ownership && group.canEdit && (
                            <button
                              className="text-link"
                              onClick={() =>
                                add("ownership", { relationshipId: r.id })
                              }
                            >
                              Record change
                            </button>
                          )}
                          {group.canEdit && (
                            <button
                              className="text-link end-action"
                              onClick={() =>
                                add("endRecord", {
                                  recordType: "relationship",
                                  recordId: r.id,
                                })
                              }
                            >
                              End interval
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
                title="No relationships at this date"
                description="Add ownership, trustee, beneficiary or other relationship records."
              />
            )}
          </section>
        </>
      )}
      {tab === 3 && (
        <>
          <div className="notice">
            <ShieldCheck size={18} />
            <span>
              Advisor master records may be shared. Scope and notes below are
              confidential to {group.name}.
            </span>
          </div>
          <div className="advisor-grid">
            {advisors.map((p) => (
              <section className="panel advisor-card" key={p.stakeholderId}>
                <div className="advisor-card-head">
                  <Avatar
                    name={p.displayName}
                    entity={p.kind === "ADVISOR_ORGANIZATION"}
                  />
                  <div>
                    <button
                      className="record-link"
                      onClick={() => onParty(p.id)}
                    >
                      {p.displayName}
                    </button>
                    <p>{p.advisorType}</p>
                  </div>
                  {!!p.primaryAdvisor && <Badge>Primary</Badge>}
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Record type</dt>
                    <dd>
                      {p.kind === "PERSON" ? "Professional" : "Organization"}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      {p.email ? (
                        <a href={`mailto:${p.email}`}>{p.email}</a>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Effective from</dt>
                    <dd>{dateLabel(p.startDate)}</dd>
                  </div>
                </dl>
                {group.canEdit && (
                  <button
                    className="text-link"
                    onClick={() =>
                      add("advisorNotes", {
                        stakeholderId: p.stakeholderId,
                        notes: p.notes,
                        scope: p.scope,
                      })
                    }
                  >
                    Edit group context
                  </button>
                )}
                <h4>Scope of advice</h4>
                <p>{p.scope || "No scope recorded."}</p>
                <div className="private-note">
                  <LockKeyhole size={13} />
                  <strong>Private group notes</strong>
                  <p>{p.notes || "No notes recorded."}</p>
                </div>
                <button className="text-link" onClick={() => onParty(p.id)}>
                  View master profile
                  <ArrowRight size={14} />
                </button>
                {group.canEdit && (
                  <button
                    className="text-link end-action"
                    onClick={() =>
                      add("endRecord", {
                        recordType: "stakeholder",
                        recordId: p.stakeholderId,
                      })
                    }
                  >
                    End association
                  </button>
                )}
              </section>
            ))}
          </div>
          {!advisors.length && (
            <Empty
              title="No advisors associated at this date"
              description="Create a professional or link an existing advisor from your authorized records."
            />
          )}
        </>
      )}
      {tab === 4 && (
        <FinancialOverview
          key={group.id}
          boot={boot}
          group={group}
          asOf={asOf}
        />
      )}
      <div className="below-table">
        <ShieldCheck size={15} />
        <p>
          Current team permissions apply to every historical view. End dates are
          exclusive.
        </p>
      </div>
    </>
  );
}
