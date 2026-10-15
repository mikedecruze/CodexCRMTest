import {
  Building2,
  BarChart3,
  Check,
  ChevronRight,
  CircleHelp,
  Home,
  Landmark,
  Layers3,
  Leaf,
  LockKeyhole,
  LogOut,
  Settings2,
  ShieldCheck,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import type { Bootstrap, GroupDetail } from "../shared/types";
import { api, ApiError, post } from "./api";
import { RecordForm, type FormRequest } from "./components/RecordForm";

import { FinancialReporting } from "./pages/FinancialReportingPage";
import { FinancialAdmin } from "./pages/FinancialAdminPage";
import { GlobalSearch } from "./components/GlobalSearch";
import { PartyDrawer } from "./components/PartyDrawer";
import { SignIn } from "./components/SignIn";
import { Avatar, Badge, Empty, ErrorView, Loading } from "./components/ui";
import { AboutPage } from "./pages/AboutPage";
import { Administration } from "./pages/AdministrationPage";
import { GroupProfile } from "./pages/ClientGroupPage";
import { GroupDirectory } from "./pages/ClientGroupsPage";
import { HomePage } from "./pages/HomePage";
import { PartyDirectory } from "./pages/PartyDirectoryPage";

export default function App() {
  const [boot, setBoot] = useState<Bootstrap | null>(null),
    [signedOut, setSignedOut] = useState(false),
    [error, setError] = useState(""),
    [version, setVersion] = useState(0),
    [form, setForm] = useState<FormRequest | null>(null),
    [detail, setDetail] = useState<GroupDetail | undefined>(),
    [partyId, setPartyId] = useState<string | null>(null),
    [toast, setToast] = useState("");
  const navigate = useNavigate();
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let valid = true;
    api<Bootstrap>("/bootstrap")
      .then((b) => {
        if (valid) {
          setBoot(b);
          setSignedOut(false);
          setError("");
        }
      })
      .catch((e) => {
        if (valid) {
          if (e instanceof ApiError && e.status === 401) {
            setSignedOut(true);
            setBoot(null);
          } else setError(e.message);
        }
      });
    return () => {
      valid = false;
    };
  }, [version]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(timer);
  }, [toast]);
  async function logout() {
    try {
      await post("/auth/logout", {});
      setBoot(null);
      setSignedOut(true);
      setForm(null);
      setPartyId(null);
      setDetail(undefined);
      navigate("/");
    } catch (e) {
      setToast((e as Error).message);
    }
  }
  const openForm = (request: FormRequest, d?: GroupDetail) => {
    setDetail(d);
    setForm(request);
    setPartyId(null);
  };
  if (signedOut)
    return (
      <SignIn
        onSignedIn={() => {
          setSignedOut(false);
          refresh();
        }}
      />
    );
  if (error && !boot) return <ErrorView error={error} retry={refresh} />;
  if (!boot) return <Loading />;
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">
            <Layers3 size={25} />
          </span>
          <span>
            trove<span className="brand-period">.</span>
          </span>
        </Link>
        <span className="workspace-label">RELATIONSHIP MANAGER</span>
        <div className="sidebar-rule" />
        <span className="nav-section">WORKSPACE</span>
        <nav>
          {[
            { to: "/", label: "Home", Icon: Home },
            { to: "/groups", label: "Client Groups", Icon: Users },
            { to: "/individuals", label: "Individuals", Icon: Users },
            { to: "/entities", label: "Entities & Trusts", Icon: Landmark },
            { to: "/advisors", label: "Advisors", Icon: Building2 },
            { to: "/reporting", label: "Reporting", Icon: BarChart3 },
          ].map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={18} />
              {label}
              {to === "/groups" && (
                <span className="nav-count">{boot.stats.groups}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <span className="nav-section management">MANAGEMENT</span>
        <nav>
          <NavLink to="/admin">
            <Settings2 size={18} />
            Administration
          </NavLink>
        </nav>
        <div className="sidebar-bottom">
          <div className="phase-note">
            <Leaf size={20} />
            <strong>A foundation for connection</strong>
            <p>Core relationships, one clear view.</p>
            <Badge tone="sage">PHASE 2</Badge>
          </div>
          <div className="sidebar-foot">
            <ShieldCheck size={15} /> Internal workspace<span>v0.2</span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Trove FS</span>
            <ChevronRight size={13} />
            <strong>Relationship Manager</strong>
          </div>
          <GlobalSearch onParty={setPartyId} />
          <div className="topbar-right">
            <span className="demo-indicator">
              <i />
              {boot.demo ? "Demo data" : "Synthetic data · Entra"}
            </span>
            <button
              className="icon-btn"
              aria-label="About this workspace"
              onClick={() => navigate("/about")}
            >
              <CircleHelp size={19} />
            </button>
            <div className="topbar-divider" />
            <div className="user-block">
              <Avatar name={boot.user.displayName} size="small" />
              <div>
                <strong>{boot.user.displayName}</strong>
                <span>
                  {boot.user.role === "admin"
                    ? "Administrator"
                    : boot.user.level}
                </span>
              </div>
            </div>
            <button
              className="icon-btn"
              aria-label="Sign out"
              title="Sign out / switch demo employee"
              onClick={logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main>
          <Routes>
            <Route
              path="/"
              element={<HomePage boot={boot} onForm={openForm} />}
            />
            <Route
              path="/groups"
              element={
                <GroupDirectory
                  boot={boot}
                  version={version}
                  onCreate={() => openForm({ type: "group" })}
                />
              }
            />
            <Route
              path="/groups/:id"
              element={
                <GroupProfile
                  boot={boot}
                  version={version}
                  onForm={openForm}
                  onParty={setPartyId}
                />
              }
            />
            {["individuals", "entities", "advisors"].map((kind) => (
              <Route
                key={kind}
                path={`/${kind}`}
                element={
                  <PartyDirectory
                    kind={kind}
                    version={version}
                    canCreate={boot.groups.some((g) => g.canEdit)}
                    onParty={setPartyId}
                    onCreate={() =>
                      openForm({
                        type:
                          kind === "individuals"
                            ? "person"
                            : kind === "entities"
                              ? "entity"
                              : "advisor",
                      })
                    }
                  />
                }
              />
            ))}
            <Route
              path="/admin"
              element={
                <Administration
                  boot={boot}
                  version={version}
                  onForm={openForm}
                />
              }
            />
            <Route
              path="/reporting"
              element={<FinancialReporting boot={boot} />}
            />
            <Route
              path="/admin/financial"
              element={<FinancialAdmin boot={boot} />}
            />
            <Route path="/about" element={<AboutPage />} />
            <Route
              path="*"
              element={
                <Empty
                  title="Page not found"
                  description="Use the navigation to return to your workspace."
                />
              }
            />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>TROVE FS, LLC</span>
          <span>
            <LockKeyhole size={12} /> Your view includes only authorized client
            relationships.
          </span>
          <span>Relationships & financial history · Phase 2</span>
        </footer>
      </div>
      {form && (
        <RecordForm
          key={form.type + (form.record?.id || "")}
          request={form}
          boot={boot}
          detail={detail}
          onClose={() => setForm(null)}
          onSaved={(id) => {
            const isGroup = form.type === "group";
            setForm(null);
            refresh();
            setToast("Record saved. Relationship history is preserved.");
            if (isGroup && id) navigate(`/groups/${id}`);
          }}
        />
      )}
      {partyId && (
        <PartyDrawer
          id={partyId}
          onClose={() => setPartyId(null)}
          onEdit={(p) => openForm({ type: "edit", record: p })}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            className="icon-btn"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
