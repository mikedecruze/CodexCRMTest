import type { Party } from "../../shared/types";
import { dateLabel } from "../api";

import { Avatar, Badge, Empty } from "../components/ui";

export function PartyTable({
  parties,
  onParty,
  canEdit,
  onNotes,
}: {
  parties: Party[];
  onParty: (id: string) => void;
  canEdit: boolean;
  onNotes: (p: Party) => void;
}) {
  if (!parties.length)
    return (
      <Empty
        title="No records at this date"
        description="Add a record or choose a different as-of date."
      />
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type / role</th>
            <th>Effective from</th>
            <th>Customer</th>
            <th>Private group notes</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {parties.map((p) => (
            <tr key={p.associationId}>
              <td>
                <button className="table-name" onClick={() => onParty(p.id)}>
                  <Avatar name={p.displayName} entity={p.kind !== "PERSON"} />
                  <strong>{p.displayName}</strong>
                </button>
              </td>
              <td>{p.entityType || p.occupation || "Family member"}</td>
              <td>{dateLabel(p.startDate)}</td>
              <td>
                {p.billable ? (
                  <Badge tone="sage">Billable</Badge>
                ) : (
                  <span className="muted">Not designated</span>
                )}
              </td>
              <td>
                <span className="note-preview">{p.notes || "—"}</span>
              </td>
              <td>
                {canEdit && (
                  <button
                    className="text-link"
                    aria-label={`Edit notes for ${p.displayName}`}
                    onClick={() => onNotes(p)}
                  >
                    Edit notes
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
