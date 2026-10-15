import {
  ArrowRight,
  GitBranch,
  Landmark,
  Layers3,
  Leaf,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Employee } from "../../shared/types";
import { api, post } from "../api";

import { Loading } from "../components/ui";

export function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [config, setConfig] = useState<{
      demo: boolean;
      entraConfigured: boolean;
      personas: Employee[];
    } | null>(null),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ demo: boolean; entraConfigured: boolean; personas: Employee[] }>(
      "/auth/config",
    )
      .then((c) => {
        setConfig(c);
        setSelected(
          c.personas.find((p) => p.displayName === "James Carter")?.id ||
            c.personas[0]?.id ||
            "",
        );
      })
      .catch((e) => setError(e.message));
  }, []);
  async function login() {
    setBusy(true);
    try {
      await post("/auth/demo", { employeeId: selected });
      onSignedIn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="signin">
      <div className="signin-story">
        <div className="brand">
          <span className="brand-mark">
            <Layers3 size={28} />
          </span>
          <span>
            trove<span className="brand-period">.</span>
          </span>
        </div>
        <div>
          <span className="eyebrow">RELATIONSHIPS, THOUGHTFULLY CONNECTED</span>
          <h1>
            A complete picture.
            <br />A closer relationship.
          </h1>
          <p>
            Bring every family, individual, entity and trusted advisor into one
            connected view.
          </p>
          <div className="signin-lines">
            <div>
              <Users />
              <span>Families & households</span>
            </div>
            <div>
              <Landmark />
              <span>Entities & ownership</span>
            </div>
            <div>
              <GitBranch />
              <span>Relationships through time</span>
            </div>
          </div>
        </div>
        <small>TROVE FS, LLC · RELATIONSHIP MANAGER</small>
      </div>
      <div className="signin-side">
        <div className="signin-card">
          <span className="eyebrow">YOUR RELATIONSHIP WORKSPACE</span>
          <h2>Welcome to Trove</h2>
          <p>Sign in to access your authorized client relationships.</p>
          {config?.demo ? (
            <>
              <div className="notice">
                <Leaf size={17} />
                <span>
                  <strong>Synthetic data workspace</strong>
                  <br />
                  Choose a test identity to explore team access. This is demo
                  authentication.
                </span>
              </div>
              <label className="field">
                <span>Demo employee</span>
                <select
                  aria-label="Demo employee"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {config.personas.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName} ·{" "}
                      {p.role === "admin" ? "Administrator" : p.level}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn primary wide"
                onClick={login}
                disabled={busy || !selected}
              >
                {busy ? "Signing in…" : "Enter demo workspace"}
                <ArrowRight size={17} />
              </button>
            </>
          ) : (
            <a className="btn primary wide" href="/auth/entra">
              <span className="microsoft-mark">
                <i />
                <i />
                <i />
                <i />
              </span>
              Sign in with Microsoft
            </a>
          )}
          {!config && !error && <Loading />}
          {error && (
            <div role="alert" className="error-box">
              {error}
            </div>
          )}
          <div className="signin-security">
            <ShieldCheck size={15} />
            Team-restricted access · Private by design
          </div>
          <small>
            Phase 2 · Core relationships and historical financials. Contracts
            and workflows follow.
          </small>
        </div>
      </div>
    </div>
  );
}
