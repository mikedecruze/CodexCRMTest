import { ArrowUpRight, Search, ShieldCheck, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Group, Party } from "../../shared/types";
import { api } from "../api";

import { Avatar } from "../components/ui";

export function GlobalSearch({ onParty }: { onParty: (id: string) => void }) {
  const [query, setQuery] = useState(""),
    [result, setResult] = useState<{
      groups: Group[];
      parties: Party[];
    } | null>(null),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  useEffect(() => {
    if (query.trim().length < 2) {
      setResult(null);
      return;
    }
    let valid = true;
    const timer = setTimeout(
      () =>
        api<{ groups: Group[]; parties: Party[] }>(
          `/search?q=${encodeURIComponent(query)}`,
        )
          .then((r) => {
            if (valid) {
              setResult(r);
              setError("");
            }
          })
          .catch((e) => {
            if (valid) setError(e.message);
          }),
      250,
    );
    return () => {
      valid = false;
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <div className="global-search" ref={root}>
      <Search size={16} />
      <input
        aria-label="Search all authorized records"
        placeholder="Search relationships, people, entities…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <span className="search-key">Search</span>
      {open && query.trim().length >= 2 && (
        <div className="search-popover">
          {error ? (
            <p className="error-box">{error}</p>
          ) : result ? (
            <>
              {result.groups.map((g) => (
                <Link
                  key={g.id}
                  to={`/groups/${g.id}`}
                  onClick={() => setOpen(false)}
                >
                  <Users size={17} />
                  <span>
                    <strong>{g.name}</strong>
                    <small>Client Group</small>
                  </span>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
              {result.parties.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onParty(p.id);
                    setOpen(false);
                  }}
                >
                  <Avatar name={p.displayName} entity={p.kind !== "PERSON"} />
                  <span>
                    <strong>{p.displayName}</strong>
                    <small>
                      {p.kind === "PERSON"
                        ? "Individual"
                        : p.kind === "LEGAL_ENTITY"
                          ? "Legal entity"
                          : "Advisor organization"}
                    </small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
              {!result.groups.length && !result.parties.length && (
                <p className="empty">No authorized records found.</p>
              )}
            </>
          ) : (
            <p className="empty">Searching…</p>
          )}
          <div className="search-foot">
            <ShieldCheck size={12} />
            Results are restricted to your authorized relationships.
          </div>
        </div>
      )}
    </div>
  );
}
