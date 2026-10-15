import {
  ArrowUpRight,
  Building2,
  ChevronRight,
  LockKeyhole,
  Users,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { Party } from "../../shared/types";
import { api, dateLabel } from "../api";

import { Avatar, Badge, Loading } from "../components/ui";
type PartyDetail = Party & {
  groups: { id: string; name: string }[];
  canEdit: boolean;
};

export function PartyDrawer({
  id,
  onClose,
  onEdit,
}: {
  id: string;
  onClose: () => void;
  onEdit: (p: PartyDetail) => void;
}) {
  const [party, setParty] = useState<PartyDetail>(),
    [error, setError] = useState("");
  useEffect(() => {
    let valid = true;
    api<PartyDetail>(`/parties/${id}`)
      .then((p) => {
        if (valid) setParty(p);
      })
      .catch((e) => {
        if (valid) setError(e.message);
      });
    return () => {
      valid = false;
    };
  }, [id]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);
  return (
    <div
      className="drawer-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="profile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Master record profile"
      >
        <div className="drawer-top">
          <span className="eyebrow">MASTER RECORD</span>
          <button
            className="icon-btn"
            aria-label="Close profile"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {error ? (
          <p className="error-box" role="alert">
            {error}
          </p>
        ) : !party ? (
          <Loading />
        ) : (
          <>
            <div className="drawer-identity">
              <Avatar
                name={party.displayName}
                size="large"
                entity={party.kind !== "PERSON"}
              />
              <h2>{party.displayName}</h2>
              <p>
                {party.entityType ||
                  party.occupation ||
                  party.organizationType ||
                  "Individual"}
              </p>
              <Badge tone={party.status === "Active" ? "green" : "sage"}>
                {party.status}
              </Badge>
            </div>
            <div className="drawer-section">
              <h3>Core information</h3>
              <dl className="detail-list">
                {[
                  {
                    label: "Record type",
                    value:
                      party.kind === "PERSON"
                        ? "Individual"
                        : party.kind === "LEGAL_ENTITY"
                          ? "Legal entity"
                          : "Advisor organization",
                  },
                  ...(party.kind === "PERSON"
                    ? [
                        {
                          label: "Date of birth",
                          value: party.birthDate
                            ? dateLabel(party.birthDate)
                            : "Not recorded",
                        },
                        { label: "Occupation", value: party.occupation },
                      ]
                    : []),
                  ...(party.kind === "LEGAL_ENTITY"
                    ? [
                        { label: "Legal name", value: party.legalName },
                        { label: "Jurisdiction", value: party.jurisdiction },
                        {
                          label: "Formation date",
                          value: party.formationDate
                            ? dateLabel(party.formationDate)
                            : "Not recorded",
                        },
                        {
                          label: "Tax classification",
                          value: party.taxClassification,
                        },
                      ]
                    : []),
                  { label: "Email", value: party.email },
                  { label: "Phone", value: party.phone },
                ]
                  .filter((x) => x.value)
                  .map((f) => (
                    <div key={f.label}>
                      <dt>{f.label}</dt>
                      <dd>{f.value}</dd>
                    </div>
                  ))}
              </dl>
              {party.description && <p>{party.description}</p>}
              {party.canEdit && (
                <button className="btn wide" onClick={() => onEdit(party)}>
                  Edit shared master
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
            {!!party.affiliations?.length && (
              <div className="drawer-section">
                <h3>Professional affiliations</h3>
                {party.affiliations.map((a) => (
                  <div className="affiliation" key={a.id}>
                    <Building2 size={18} />
                    <div>
                      <strong>{a.organization}</strong>
                      <p>{a.position}</p>
                      <small>
                        {dateLabel(a.startDate)} – {dateLabel(a.endDate)}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="drawer-section">
              <h3>Client relationships</h3>
              <p className="muted small">
                Only associations you are authorized to view.
              </p>
              {party.groups.map((g) => (
                <Link
                  className="drawer-group"
                  key={g.id}
                  to={`/groups/${g.id}`}
                  onClick={onClose}
                >
                  <Users size={17} />
                  {g.name}
                  <ChevronRight size={16} />
                </Link>
              ))}
            </div>
            <div className="drawer-section">
              <div className="notice">
                <LockKeyhole size={17} />
                <span>
                  Confidential notes and relationships are available within the
                  relevant Client Group.
                </span>
              </div>
              <p className="record-id">
                RECORD ID
                <br />
                {party.id}
              </p>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
