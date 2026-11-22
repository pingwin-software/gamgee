import { useCallback, useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { createPasskey, PasskeyCancelled, passkeysSupported, suggestedName } from "../passkeys";
import "../whatsnew/WhatsNew.css";

type AuthFetch = (url: string, opts?: RequestInit) => Promise<Response>;

interface PasskeyRow {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

const json = { "Content-Type": "application/json" };

/** Settings, Account: the passkeys on this account, add one (asks for the
 * password again, then the device's own prompt), remove one. */
export default function PasskeysCard({ authFetch }: { authFetch: AuthFetch }) {
  const [rows, setRows] = useState<PasskeyRow[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [password, setPassword] = useState("");
  const [name, setName] = useState(() => suggestedName(navigator.userAgent));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const supported = passkeysSupported();

  const load = useCallback(() => {
    authFetch("/api/auth/passkeys")
      .then(r => (r.ok ? r.json() : []))
      .then(setRows)
      .catch(() => setRows([]));
  }, [authFetch]);
  useEffect(load, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      const start = await authFetch("/api/auth/passkeys/options", {
        method: "POST", headers: json, body: JSON.stringify({ current_password: password }),
      });
      if (!start.ok) { setErr((await start.json().catch(() => ({}))).detail ?? "Couldn't start. Try again."); return; }
      const { token, options } = await start.json();
      const credential = await createPasskey(options);
      const res = await authFetch("/api/auth/passkeys", {
        method: "POST", headers: json, body: JSON.stringify({ token, credential, name: name.trim() }),
      });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).detail ?? "That passkey couldn't be added."); return; }
      setPassword(""); setAdding(false); load();
    } catch (error) {
      if (!(error instanceof PasskeyCancelled)) setErr(error instanceof Error ? error.message : "Network error");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: number) => {
    // Optimistic: the row goes at once and comes back if the server refuses.
    const before = rows;
    setRows(prev => (prev ?? []).filter(p => p.id !== id));
    const res = await authFetch(`/api/auth/passkeys/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) { setRows(before); setErr("Couldn't remove that passkey."); }
  };

  return (
    <div className="profile-card" style={{ marginTop: 12 }}>
      <div className="modal-title" style={{ marginBottom: 6 }}><KeyRound size={15} /> Passkeys</div>
      <p className="pk-hint">
        Sign in with your fingerprint, face or screen lock instead of typing a password.
      </p>
      {rows && rows.length > 0 && (
        <ul className="pk-list">
          {rows.map(p => (
            <li key={p.id} className="pk-row">
              <div className="pk-row-main">
                <div className="pk-row-name">{p.name}</div>
                <div className="pk-row-meta">
                  Added {day(p.created_at)}{p.last_used_at ? ` · last used ${day(p.last_used_at)}` : ""}
                </div>
              </div>
              <button className="pk-remove" onClick={() => remove(p.id)} aria-label={`Remove passkey ${p.name}`} title="Remove">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!supported ? (
        <p className="pk-hint" style={{ margin: 0 }}>This browser can't make passkeys.</p>
      ) : !adding ? (
        <button className="auth-toggle" style={{ width: "100%", textAlign: "left" }} onClick={() => { setAdding(true); setErr(""); }}>
          Add a passkey
        </button>
      ) : (
        <form className="pk-form" onSubmit={add}>
          <input
            className="field-input" type="password" placeholder="Your password, to confirm it's you"
            value={password} onChange={e => setPassword(e.target.value)}
            autoComplete="current-password" required autoFocus
          />
          <input
            className="field-input" type="text" placeholder="Name (e.g. My phone)" maxLength={40}
            value={name} onChange={e => setName(e.target.value)} aria-label="Passkey name"
          />
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={() => { setAdding(false); setPassword(""); setErr(""); }}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy || !password}>{busy ? "Waiting…" : "Continue"}</button>
          </div>
        </form>
      )}
      {err && <p className="auth-err" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  );
}
