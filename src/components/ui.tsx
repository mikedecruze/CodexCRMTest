import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Landmark,
  LoaderCircle,
} from "lucide-react";
import { initials } from "../api";

export function Badge({
  children,
  tone = "green",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function Avatar({
  name,
  size = "normal",
  entity = false,
}: {
  name: string;
  size?: string;
  entity?: boolean;
}) {
  return (
    <span className={`avatar ${size} ${entity ? "entity-avatar" : ""}`}>
      {entity ? <Landmark size={size === "large" ? 26 : 17} /> : initials(name)}
    </span>
  );
}

export function Empty({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <FolderOpen size={32} />
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="loading">
      <LoaderCircle size={22} className="spin" /> Loading your workspace…
    </div>
  );
}

export function ErrorView({
  error,
  retry,
}: {
  error: string;
  retry: () => void;
}) {
  return (
    <div role="alert" className="error-box">
      {error}
      <button className="btn" onClick={retry}>
        Try again
      </button>
    </div>
  );
}

export function Pager({
  page,
  total,
  pageSize,
  onChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="pagination">
      <span>
        {total
          ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} records`
          : "0 records"}
      </span>
      <div>
        <button
          className="icon-btn"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        <span>Page {page}</span>
        <button
          className="icon-btn"
          aria-label="Next page"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
