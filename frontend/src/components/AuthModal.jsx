import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";

export default function AuthModal({ onClose }) {
  const { login, signup } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await signup(name, email, password);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return createPortal((
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" onClick={(e) => e.stopPropagation()}>
        <div className="modal-heading"><span className="modal-kicker">TREKAI MEMBER ACCESS</span><button type="button" className="modal-close" onClick={onClose} aria-label="Close sign in">×</button></div>
        <h2 id="auth-title">{mode === "login" ? "Sign in" : "Create an account"}</h2>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "0.8rem" }}>
          {mode === "signup" && (
            <div>
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          )}
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p style={{ color: "var(--blaze)", margin: 0 }}>{error}</p>}
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Please wait…" : mode === "login" ? "Sign in" : "Sign up"}
          </button>
        </form>
        <p style={{ marginTop: "1rem", fontSize: "0.88rem" }}>
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button
            className="btn-outline btn"
            style={{ padding: "0.2em 0.6em", fontSize: "0.85rem" }}
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  ), document.body);
}
