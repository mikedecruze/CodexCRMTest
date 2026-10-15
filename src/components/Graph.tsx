import dagre from "@dagrejs/dagre";
import { Expand, GitBranch, Minus, Plus, RotateCcw } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { Party, Relationship } from "../../shared/types";
import { initials } from "../api";
interface Props {
  parties: Party[];
  relationships: Relationship[];
  mode: "family" | "entity";
  onSelect: (id: string) => void;
}
export function RelationshipGraph({
  parties,
  relationships,
  mode,
  onSelect,
}: Props) {
  const [filter, setFilter] = useState(""),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [scale, setScale] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const types = [
    ...new Map(relationships.map((r) => [r.typeId, r.type])).entries(),
  ];
  const layout = useMemo(() => {
    const edges = relationships.filter((r) => !filter || r.typeId === filter);
    const hidden = new Set<string>();
    function hide(id: string, seen: Set<string>) {
      if (seen.has(id)) return;
      seen.add(id);
      for (const e of edges.filter((e) => e.sourceId === id && !e.symmetric)) {
        if (collapsed.has(e.targetId)) continue;
        hidden.add(e.targetId);
        hide(e.targetId, seen);
      }
    }
    for (const id of collapsed) hide(id, new Set());
    const visible = parties.filter((p) => !hidden.has(p.id));
    const ids = new Set(visible.map((p) => p.id));
    const shown = edges.filter(
      (e) => ids.has(e.sourceId) && ids.has(e.targetId),
    );
    const g = new dagre.graphlib.Graph({ multigraph: true });
    g.setGraph({
      rankdir: "TB",
      nodesep: 32,
      ranksep: 90,
      marginx: 40,
      marginy: 35,
    });
    g.setDefaultEdgeLabel(() => ({}));
    for (const p of visible) g.setNode(p.id, { width: 184, height: 70 });
    for (const e of shown.filter((e) => !e.symmetric))
      g.setEdge(
        e.sourceId,
        e.targetId,
        { label: e.type, width: 110, height: 20 },
        e.id,
      );
    dagre.layout(g);
    return {
      nodes: visible.map((p) => ({ ...p, ...g.node(p.id) })),
      edges: shown,
      width: Math.max(600, g.graph().width || 600),
      height: Math.max(320, g.graph().height || 320),
    };
  }, [parties, relationships, filter, collapsed]);
  const positions = new Map(layout.nodes.map((n) => [n.id, n]));
  function reset() {
    setPan({ x: 0, y: 0 });
    setScale(1);
    setCollapsed(new Set());
  }
  return (
    <section
      className="graph-panel"
      aria-label={
        mode === "family" ? "Family tree" : "Entity ownership diagram"
      }
    >
      <div className="graph-toolbar">
        <div className="graph-title">
          <GitBranch size={16} />
          <strong>
            {mode === "family" ? "Family tree" : "Relationship map"}
          </strong>
          <span className="tag">{layout.nodes.length} records</span>
        </div>
        <select
          aria-label="Filter relationship type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">All relationships</option>
          {types.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <div className="graph-controls">
          <button
            aria-label="Zoom out"
            onClick={() => setScale((s) => Math.max(0.35, s - 0.15))}
          >
            <Minus size={15} />
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button
            aria-label="Zoom in"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
          >
            <Plus size={15} />
          </button>
          <button aria-label="Reset graph" onClick={reset}>
            <RotateCcw size={15} />
          </button>
          <button
            aria-label="Fit graph"
            onClick={() => {
              setScale(0.7);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Expand size={15} />
          </button>
        </div>
      </div>
      <div
        className="graph-canvas"
        onPointerDown={(e) => {
          if ((e.target as Element).closest('[role="button"]')) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current)
            setPan({
              x: drag.current.px + e.clientX - drag.current.x,
              y: drag.current.py + e.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        {!layout.nodes.length ? (
          <div className="empty">
            No records match this view. Add a record to begin.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{
              minWidth: Math.min(layout.width, 1100),
              height: Math.max(330, Math.min(540, layout.height)),
            }}
            aria-label="Interactive relationship diagram"
          >
            <defs>
              <marker
                id={`arrow-${mode}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M0 0 L10 5 L0 10z" fill="#8a9e96" />
              </marker>
            </defs>
            <g transform={`translate(${pan.x},${pan.y}) scale(${scale})`}>
              {layout.edges.map((e) => {
                const a = positions.get(e.sourceId)!,
                  b = positions.get(e.targetId)!;
                const x1 = a.x,
                  y1 = a.y + (b.y > a.y ? 35 : 0),
                  x2 = b.x,
                  y2 = b.y - (b.y > a.y ? 35 : 0),
                  mid = (y1 + y2) / 2;
                const d = e.symmetric
                  ? `M${x1} ${y1} Q${(x1 + x2) / 2} ${Math.min(y1, y2) - 60} ${x2} ${y2}`
                  : `M${x1} ${y1} C${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
                const label =
                  e.ownershipPercentage !== null
                    ? `${e.ownershipPercentage}% · ${e.ownershipClass || e.type}`
                    : e.type;
                return (
                  <g key={e.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={e.ownership ? "#5e8c78" : "#b9c7c1"}
                      strokeWidth="1.7"
                      strokeDasharray={e.symmetric ? "5 4" : undefined}
                      markerEnd={
                        e.symmetric ? undefined : `url(#arrow-${mode})`
                      }
                    />
                    <rect
                      x={(x1 + x2) / 2 - 58}
                      y={(e.symmetric ? Math.min(y1, y2) - 31 : mid) - 9}
                      width="116"
                      height="18"
                      rx="5"
                      fill="#f9fbfa"
                    />
                    <text
                      x={(x1 + x2) / 2}
                      y={(e.symmetric ? Math.min(y1, y2) - 31 : mid) + 3}
                      textAnchor="middle"
                      fontSize="10"
                      fill="#536b60"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
              {layout.nodes.map((n) => (
                <g key={n.id} transform={`translate(${n.x - 92},${n.y - 35})`}>
                  <g
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${n.displayName}`}
                    onClick={() => onSelect(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(n.id);
                      }
                    }}
                    className="graph-node"
                  >
                    <rect
                      width="184"
                      height="70"
                      rx="9"
                      fill="white"
                      stroke={n.kind === "PERSON" ? "#d8e1dc" : "#b8cdbf"}
                    />
                    <rect
                      x="12"
                      y="17"
                      width="34"
                      height="34"
                      rx={n.kind === "PERSON" ? 17 : 8}
                      fill={n.kind === "PERSON" ? "#eef2ed" : "#e3eee6"}
                    />
                    <text
                      x="29"
                      y="39"
                      textAnchor="middle"
                      fill="#426b54"
                      fontSize="10"
                      fontWeight="600"
                    >
                      {initials(n.displayName)}
                    </text>
                    <text
                      x="56"
                      y="30"
                      fill="#263f32"
                      fontSize="11"
                      fontWeight="600"
                    >
                      {n.displayName.length > 20
                        ? `${n.displayName.slice(0, 19)}…`
                        : n.displayName}
                    </text>
                    <text x="56" y="47" fill="#859189" fontSize="9">
                      {n.kind === "PERSON"
                        ? n.birthDate
                          ? `Born ${n.birthDate.slice(0, 4)}`
                          : "Individual"
                        : n.entityType || "Organization"}
                    </text>
                  </g>
                  {relationships.some(
                    (e) => e.sourceId === n.id && !e.symmetric,
                  ) && (
                    <g
                      role="button"
                      tabIndex={0}
                      aria-label={`${collapsed.has(n.id) ? "Expand" : "Collapse"} ${n.displayName} branch`}
                      className="branch-toggle"
                      onClick={() =>
                        setCollapsed((s) => {
                          const v = new Set(s);
                          if (v.has(n.id)) v.delete(n.id);
                          else v.add(n.id);
                          return v;
                        })
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = new Set(collapsed);
                          if (v.has(n.id)) v.delete(n.id);
                          else v.add(n.id);
                          setCollapsed(v);
                        }
                      }}
                    >
                      <circle
                        cx="92"
                        cy="74"
                        r="8"
                        fill="white"
                        stroke="#b8cdbf"
                      />
                      <text
                        x="92"
                        y="78"
                        textAnchor="middle"
                        fontSize="12"
                        fill="#426b54"
                      >
                        {collapsed.has(n.id) ? "+" : "−"}
                      </text>
                    </g>
                  )}
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>
      <div className="graph-legend">
        <span>
          <i className="dot sage" />
          Individual
        </span>
        <span>
          <i className="dot green" />
          Entity / organization
        </span>
        <span className="muted">
          Drag to pan · Select a record to open · ± on a node hides its
          descendants
        </span>
      </div>
    </section>
  );
}
