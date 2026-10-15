import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import type {
  Bootstrap,
  GroupDetail,
  Party,
  Reference,
} from "../../shared/types";
import { api, dateToday, post } from "../api";
export interface FormRequest {
  type: string;
  record?: Party & { canEdit?: boolean };
  relationshipId?: string;
  associationId?: string;
  notes?: string;
  reference?: Reference;
  recordType?: string;
  recordId?: string;
  stakeholderId?: string;
  scope?: string;
}
interface Field {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  value?: string;
  hint?: string;
}
export function RecordForm({
  request,
  boot,
  detail,
  onClose,
  onSaved,
}: {
  request: FormRequest;
  boot: Bootstrap;
  detail?: GroupDetail;
  onClose: () => void;
  onSaved: (id?: string) => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const opts = (
    items: {
      id: string;
      displayName?: string;
      name?: string;
      label?: string;
    }[],
  ) =>
    items.map((x) => ({
      value: x.id,
      label: x.displayName || x.name || x.label || "",
    }));
  const refOpts = (category: string) =>
    opts(boot.references.filter((r) => r.category === category && r.active));
  const groupOpts = opts(boot.groups.filter((g) => g.canEdit));
  const employees = opts(boot.employees.filter((e) => e.active)),
    partners = opts(
      boot.employees.filter((e) => e.level === "Partner" && e.active),
    );
  const range: Field[] = [
    {
      key: "startDate",
      label: "Effective from",
      type: "date",
      required: true,
      value: dateToday(),
    },
    { key: "endDate", label: "Effective until (exclusive)", type: "date" },
  ];
  const select = (
    key: string,
    label: string,
    options: Field["options"],
    required = true,
    value?: string,
  ): Field => ({ key, label, options, required, value });
  const allParties = [
    ...(detail?.people || []),
    ...(detail?.entities || []),
    ...(detail?.advisors || []),
  ];
  const unique = [...new Map(allParties.map((p) => [p.id, p])).values()];
  const groupSelect: Field[] = detail
    ? []
    : [select("groupId", "Client Group", groupOpts)];
  const titles: Record<string, string> = {
    group: "Create client group",
    groupProfile: "Edit client group",
    person: "Add an individual",
    entity: "Add a legal entity",
    household: "Create a household",
    membership: "Add household member",
    relationship: "Add a relationship",
    ownership: "Record ownership change",
    assignments: "Update primary assignments",
    advisor: "Add an advisor",
    associate: "Associate an existing entity",
    advisorExisting: "Link an existing advisor",
    notes: "Edit confidential group notes",
    edit: "Edit shared master",
    reference: "Add a reference type",
    referenceEdit: "Edit reference type",
    teamMembership: "Add team membership",
    archive: "Archive client group",
    endRecord: "End an effective interval",
    advisorNotes: "Edit advisor group context",
  };
  const r = request.record;
  const fields: Record<string, Field[]> = {
    group: [
      { key: "name", label: "Client Group name", required: true },
      { key: "displayName", label: "Display name", required: true },
      select(
        "status",
        "Status",
        ["Active", "Prospective", "Inactive"].map((x) => ({
          value: x,
          label: x,
        })),
      ),
      {
        key: "inceptionDate",
        label: "Client since",
        type: "date",
        required: true,
        value: dateToday(),
      },
      select("partnerId", "Primary Partner", partners),
      select("managerId", "Relationship Manager", employees),
      select(
        "teamId",
        "Primary service team",
        opts(boot.teams.filter((t) => t.active)),
      ),
      {
        key: "sharepointUrl",
        label: "SharePoint folder URL",
        type: "url",
        hint: "Optional. Existing SharePoint permissions still apply.",
      },
    ],
    groupProfile: [
      {
        key: "name",
        label: "Client Group name",
        required: true,
        value: detail?.group.name,
      },
      {
        key: "displayName",
        label: "Display name",
        required: true,
        value: detail?.group.displayName,
      },
      select(
        "status",
        "Status",
        ["Active", "Prospective", "Inactive", "Archived"].map((x) => ({
          value: x,
          label: x,
        })),
        true,
        detail?.group.status,
      ),
      {
        key: "sharepointUrl",
        label: "SharePoint folder URL",
        type: "url",
        value: detail?.group.sharepointUrl || "",
      },
    ],
    person: [
      ...groupSelect,
      { key: "firstName", label: "First name", required: true },
      { key: "lastName", label: "Last name", required: true },
      {
        key: "displayName",
        label: "Display name",
        hint: "Optional; defaults to first and last name.",
      },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      { key: "birthDate", label: "Date of birth", type: "date" },
      { key: "occupation", label: "Occupation" },
      ...(detail
        ? [select("householdId", "Household", opts(detail.households), false)]
        : []),
      ...range,
      { key: "billable", label: "Billable customer", type: "checkbox" },
      { key: "notes", label: "Private group notes", type: "textarea" },
    ],
    entity: [
      ...groupSelect,
      { key: "displayName", label: "Legal name", required: true },
      select("entityTypeId", "Entity type", refOpts("entity")),
      { key: "jurisdiction", label: "Formation jurisdiction" },
      { key: "formationDate", label: "Formation date", type: "date" },
      { key: "taxClassification", label: "Tax classification" },
      { key: "description", label: "Shared description", type: "textarea" },
      ...range,
      { key: "billable", label: "Billable customer", type: "checkbox" },
      { key: "notes", label: "Private group notes", type: "textarea" },
    ],
    household: [
      ...groupSelect,
      { key: "name", label: "Household name", required: true },
      { key: "description", label: "Description", type: "textarea" },
      ...range,
    ],
    membership: [
      select("householdId", "Household", opts(detail?.households || [])),
      select("personId", "Family member", opts(detail?.people || [])),
      {
        key: "role",
        label: "Relationship to household",
        required: true,
        value: "Family member",
      },
      { key: "isPrimary", label: "Primary contact", type: "checkbox" },
      ...range,
    ],
    relationship: [
      select("sourceId", "From record", opts(unique)),
      select("typeId", "Relationship type", refOpts("relationship")),
      select("targetId", "To record", opts(unique)),
      ...range,
      {
        key: "ownershipPercentage",
        label: "Ownership % (ownership types only)",
        type: "number",
      },
      { key: "votingPercentage", label: "Voting %", type: "number" },
      { key: "economicPercentage", label: "Economic %", type: "number" },
      { key: "ownershipClass", label: "Ownership class" },
      { key: "sourceDocument", label: "Source document reference" },
      { key: "notes", label: "Private relationship notes", type: "textarea" },
    ],
    ownership: [
      {
        key: "effectiveDate",
        label: "Change effective on",
        type: "date",
        required: true,
        value: dateToday(),
      },
      {
        key: "ownershipPercentage",
        label: "New ownership percentage",
        type: "number",
        required: true,
      },
      {
        key: "reason",
        label: "Reason for change",
        type: "textarea",
        required: true,
        hint: "The old value is preserved for earlier dates.",
      },
    ],
    assignments: [
      select(
        "partnerId",
        "Primary Partner",
        partners,
        true,
        detail?.group.partnerId,
      ),
      select(
        "managerId",
        "Relationship Manager",
        employees,
        true,
        detail?.group.managerId,
      ),
      select(
        "teamId",
        "Primary service team",
        opts(boot.teams.filter((t) => t.active)),
        true,
        detail?.group.teamId,
      ),
      {
        key: "effectiveDate",
        label: "Effective date",
        type: "date",
        required: true,
        value: dateToday(),
      },
    ],
    advisor: [
      ...groupSelect,
      select("kind", "Record type", [
        { value: "PERSON", label: "Professional individual" },
        { value: "ADVISOR_ORGANIZATION", label: "Advisor organization" },
      ]),
      { key: "displayName", label: "Display name", required: true },
      { key: "firstName", label: "First name (individual)" },
      { key: "lastName", label: "Last name (individual)" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone" },
      select("typeId", "Advisor category", refOpts("advisor")),
      select(
        "organizationId",
        "Professional organization",
        opts(
          (detail?.advisors || []).filter(
            (p) => p.kind === "ADVISOR_ORGANIZATION",
          ),
        ),
        false,
      ),
      { key: "position", label: "Position" },
      { key: "scope", label: "Scope of advice", type: "textarea" },
      { key: "notes", label: "Confidential group notes", type: "textarea" },
      { key: "primaryAdvisor", label: "Primary advisor", type: "checkbox" },
      ...range,
    ],
    associate: [
      select("partyId", "Existing legal entity", []),
      ...range,
      { key: "billable", label: "Billable customer", type: "checkbox" },
      { key: "notes", label: "Private group notes", type: "textarea" },
    ],
    advisorExisting: [
      select("existingPartyId", "Existing advisor", []),
      select("typeId", "Advisor category", refOpts("advisor")),
      { key: "scope", label: "Scope of advice", type: "textarea" },
      { key: "notes", label: "Confidential group notes", type: "textarea" },
      ...range,
    ],
    edit: [
      {
        key: "displayName",
        label: "Display name",
        required: true,
        value: r?.displayName,
      },
      select(
        "status",
        "Record status",
        ["Active", "Archived"].map((x) => ({ value: x, label: x })),
        true,
        r?.status,
      ),
      ...(r?.kind === "LEGAL_ENTITY"
        ? [
            {
              key: "description",
              label: "Shared description",
              type: "textarea",
              value: r.description,
            },
          ]
        : [
            { key: "email", label: "Email", type: "email", value: r?.email },
            { key: "phone", label: "Phone", value: r?.phone },
            ...(r?.kind === "PERSON"
              ? [
                  {
                    key: "occupation",
                    label: "Occupation",
                    value: r.occupation,
                  },
                ]
              : []),
          ]),
    ],
    notes: [
      {
        key: "notes",
        label: "Confidential notes for this group",
        type: "textarea",
        value: request.notes,
      },
    ],
    reference: [
      select(
        "category",
        "Category",
        ["entity", "relationship", "advisor", "contact"].map((x) => ({
          value: x,
          label: x,
        })),
      ),
      {
        key: "code",
        label: "Stable code",
        required: true,
        hint: "Lowercase letters, digits and hyphens; at least 2 characters.",
      },
      { key: "label", label: "Display label", required: true },
      {
        key: "symmetric",
        label: "Symmetric relationship (e.g. spouse)",
        type: "checkbox",
      },
      {
        key: "ownership",
        label: "Carries ownership percentages",
        type: "checkbox",
      },
    ],
    referenceEdit: [
      {
        key: "label",
        label: "Display label",
        required: true,
        value: request.reference?.label,
      },
      {
        key: "active",
        label: "Active",
        type: "checkbox",
        value: request.reference?.active ? "true" : "",
      },
    ],
    teamMembership: [
      select("employeeId", "Employee", employees),
      select(
        "teamId",
        "Service team",
        opts(boot.teams.filter((t) => t.active)),
      ),
      ...range,
    ],
    endRecord: [
      {
        key: "effectiveEndDate",
        label: "Effective end date (exclusive)",
        type: "date",
        required: true,
        value: dateToday(),
      },
      {
        key: "reason",
        label: "Reason for change",
        type: "textarea",
        required: true,
        hint: "The record is retained and remains visible at earlier as-of dates.",
      },
    ],
    advisorNotes: [
      {
        key: "scope",
        label: "Scope of advice",
        type: "textarea",
        value: request.scope,
      },
      {
        key: "notes",
        label: "Private group notes",
        type: "textarea",
        value: request.notes,
      },
    ],
    archive: [],
  };
  const [masters, setMasters] = useState<Party[] | null>(null);
  // Lazy, bounded server pages for the reusable-master selector.
  const [masterQuery, setMasterQuery] = useState("");
  const [masterLoading, setMasterLoading] = useState(false);
  async function searchMasters() {
    setMasterLoading(true);
    try {
      const data = await api<{ items: Party[] }>(
        `/parties?kind=${request.type === "associate" ? "LEGAL_ENTITY" : "advisor"}&status=Active&q=${encodeURIComponent(masterQuery)}`,
      );
      setMasters(data.items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMasterLoading(false);
    }
  }
  const selectedFields = fields[request.type] || [];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.currentTarget),
      payload: Record<string, unknown> = {};
    for (const f of selectedFields) {
      const value = String(data.get(f.key) || "").trim();
      if (f.type === "checkbox") payload[f.key] = data.has(f.key);
      else if (f.type === "number")
        payload[f.key] = value === "" ? null : Number(value);
      else if (f.type === "date") payload[f.key] = value || null;
      else payload[f.key] = value;
    }
    for (const key of ["householdId", "organizationId"])
      if (!payload[key]) delete payload[key];
    try {
      let result: { id: string };
      if (request.type === "group") result = await post("/groups", payload);
      else if (request.type === "edit")
        result = await api(`/parties/${r!.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      else if (request.type === "reference")
        result = await post("/admin/references", payload);
      else if (request.type === "referenceEdit")
        result = await api(`/admin/references/${request.reference!.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      else if (request.type === "teamMembership")
        result = await post("/admin/memberships", payload);
      else {
        const groupId = String(payload.groupId || detail?.group.id || "");
        delete payload.groupId;
        payload.action =
          request.type === "advisorExisting" ? "advisor" : request.type;
        if (request.type === "person" && !payload.displayName)
          payload.displayName = `${payload.firstName} ${payload.lastName}`;
        if (request.type === "advisorExisting") {
          const p = masters?.find((p) => p.id === payload.existingPartyId);
          payload.displayName = p?.displayName || "Existing advisor";
          payload.kind = p?.kind || "PERSON";
        }
        if (request.type === "endRecord") {
          payload.recordType = request.recordType;
          payload.recordId = request.recordId;
        }
        if (request.type === "advisorNotes")
          payload.stakeholderId = request.stakeholderId;
        if (request.type === "ownership")
          payload.relationshipId = request.relationshipId;
        if (request.type === "notes")
          payload.associationId = request.associationId;
        result = await post(`/groups/${groupId}/commands`, payload);
      }
      onSaved(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="form-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="modal-heading">
          <div>
            <span className="eyebrow">RELATIONSHIP MANAGEMENT</span>
            <h2 id="form-title">{titles[request.type]}</h2>
            <p>
              {detail?.group.name ||
                "Build a connected, complete client record."}
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="Close form"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={submit}>
          {(request.type === "associate" ||
            request.type === "advisorExisting") && (
            <div className="master-search">
              <label htmlFor="master-search">
                Find an authorized existing record
              </label>
              <div className="inline">
                <input
                  id="master-search"
                  value={masterQuery}
                  onChange={(e) => setMasterQuery(e.target.value)}
                  placeholder="Search by name"
                />
                <button
                  type="button"
                  className="btn"
                  onClick={searchMasters}
                  disabled={masterLoading}
                >
                  {masterLoading ? "Searching…" : "Find records"}
                </button>
              </div>
              <small>
                Search includes records visible to your teams. No records are
                merged by name.
              </small>
            </div>
          )}
          <div className="form-fields">
            {selectedFields.map((f) => (
              <label
                key={f.key}
                className={`field ${f.type === "textarea" ? "full" : ""} ${f.type === "checkbox" ? "checkbox-field" : ""}`}
              >
                <span>
                  {f.label}
                  {f.required && <b> *</b>}
                </span>
                {f.options ? (
                  <select
                    aria-label={f.label}
                    name={f.key}
                    required={f.required}
                    defaultValue={f.value || ""}
                  >
                    <option value="">Choose…</option>
                    {(f.key === "partyId" || f.key === "existingPartyId"
                      ? opts(masters || [])
                      : f.options
                    ).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    aria-label={f.label}
                    name={f.key}
                    defaultValue={f.value || ""}
                    required={f.required}
                    rows={3}
                    maxLength={2000}
                  />
                ) : (
                  <input
                    aria-label={f.label}
                    name={f.key}
                    type={f.type || "text"}
                    defaultValue={
                      f.type === "checkbox" ? undefined : f.value || ""
                    }
                    defaultChecked={
                      f.type === "checkbox" ? f.value === "true" : undefined
                    }
                    required={f.required}
                    min={f.type === "number" ? 0 : undefined}
                    max={f.type === "number" ? 100 : undefined}
                    step={f.type === "number" ? "any" : undefined}
                    maxLength={f.type === "text" || !f.type ? 160 : undefined}
                  />
                )}{" "}
                {f.hint && <small>{f.hint}</small>}
              </label>
            ))}
          </div>
          {request.type === "archive" && (
            <p className="notice">
              Archive {detail?.group.name}? Its records and relationship history
              will be retained.
            </p>
          )}
          {request.type === "edit" && (
            <p className="notice">
              These are shared master fields. Confidential group notes are
              managed separately.
            </p>
          )}
          {error && (
            <div role="alert" className="error-box">
              {error}
            </div>
          )}
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <ArrowRight size={16} />
              )}{" "}
              {busy
                ? "Saving…"
                : request.type === "archive"
                  ? "Archive group"
                  : "Save record"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
