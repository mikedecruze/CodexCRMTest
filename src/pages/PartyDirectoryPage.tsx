import { ArrowUpRight, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Page, Party } from "../../shared/types";
import { api } from "../api";

import {
  Avatar,
  Badge,
  Empty,
  Loading,
  PageHeading,
  Pager,
} from "../components/ui";

export function PartyDirectory({
  kind,
  version,
  onParty,
  onCreate,
  canCreate,
}: {
  kind: string;
  version: number;
  onParty: (id: string) => void;
  onCreate: () => void;
  canCreate: boolean;
}) {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [data, setData] =
      useState<Page<Party & { groups: { id: string; name: string }[] }>>(),
    [error, setError] = useState("");
  const type =
      kind === "individuals"
        ? "PERSON"
        : kind === "entities"
          ? "LEGAL_ENTITY"
          : "advisor",
    title =
      kind === "individuals"
        ? "Individuals"
        : kind === "entities"
          ? "Entities & Trusts"
          : "Advisors";
  useEffect(() => {
    let valid = true;
    const timer = setTimeout(
      () =>
        api<Page<Party & { groups: { id: string; name: string }[] }>>(
          `/parties?kind=${type}&q=${encodeURIComponent(q)}&page=${page}`,
        )
          .then((d) => {
            if (valid) {
              setData(d);
              setError("");
            }
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
  }, [type, q, page, version]);
  return (
    <>
      <PageHeading
        eyebrow="CONNECTED RECORDS"
        title={title}
        description={
          kind === "individuals"
            ? "The people and generations behind your relationships."
            : kind === "entities"
              ? "A complete inventory of structures, trusts and shared entities."
              : "Reusable professionals and organizations. Confidential context belongs to each family."
        }
        action={
          canCreate && (
            <button className="btn primary" onClick={onCreate}>
              <Plus size={16} />
              Add{" "}
              {kind === "individuals"
                ? "individual"
                : kind === "entities"
                  ? "entity"
                  : "advisor"}
            </button>
          )
        }
      />
      <section className="panel">
        <div className="table-tools">
          <div className="input-search">
            <Search size={16} />
            <input
              aria-label={`Search ${title.toLowerCase()}`}
              placeholder={`Search ${title.toLowerCase()}…`}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <span className="muted small">
            Shared master records · Authorized associations only
          </span>
        </div>
        {error ? (
          <p role="alert" className="error-box">
            {error}
          </p>
        ) : !data ? (
          <Loading />
        ) : !data.items.length ? (
          <Empty
            title="No records found"
            description="Adjust your search or add a new record to an authorized Client Group."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type / role</th>
                  <th>Client relationships</th>
                  <th>{kind === "entities" ? "Jurisdiction" : "Contact"}</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        className="table-name"
                        onClick={() => onParty(p.id)}
                      >
                        <Avatar
                          name={p.displayName}
                          entity={p.kind !== "PERSON"}
                        />
                        <strong>{p.displayName}</strong>
                      </button>
                    </td>
                    <td>
                      {p.entityType ||
                        p.occupation ||
                        p.organizationType ||
                        "Individual"}
                    </td>
                    <td>
                      <div className="group-tags">
                        {p.groups.map((g) => (
                          <Link
                            key={g.id}
                            to={`/groups/${g.id}`}
                            className="tag"
                          >
                            {g.name}
                          </Link>
                        ))}
                      </div>
                    </td>
                    <td className="muted">
                      {p.jurisdiction || p.email || "—"}
                    </td>
                    <td>
                      <Badge tone={p.status === "Active" ? "green" : "sage"}>
                        {p.status}
                      </Badge>
                    </td>
                    <td>
                      <button
                        className="icon-btn"
                        aria-label={`View ${p.displayName}`}
                        onClick={() => onParty(p.id)}
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pager {...data} onChange={setPage} />}
      </section>
    </>
  );
}
