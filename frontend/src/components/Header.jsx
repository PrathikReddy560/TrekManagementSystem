import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header({ onOpenAuth }) {
  const { user, logout } = useAuth();
  const [theme, setTheme] = useState(() => localStorage.getItem("trekai-theme") || "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("trekai-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return (
    <header
      className="site-header"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "1rem 1.5rem",
        borderBottom: "1px solid var(--mist-line)",
        background: "var(--header-bg)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="site-brand" style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "1.4rem" }}>⛰️</span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: "1.25rem",
            background: "linear-gradient(90deg, var(--accent), var(--accent2))",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          TrekAI
        </span>
      </div>

      <nav className="site-nav" style={{ display: "flex", gap: "1.5rem", fontSize: "0.92rem", fontWeight: 500 }}>
        <NavLink to="/" end style={({ isActive }) => ({ color: isActive ? "var(--accent2)" : "var(--text)" })}>
          Explore
        </NavLink>
        <NavLink to="/plan" style={({ isActive }) => ({ color: isActive ? "var(--accent2)" : "var(--text)" })}>
          AI Planner
        </NavLink>
        <NavLink to="/trips" style={({ isActive }) => ({ color: isActive ? "var(--accent2)" : "var(--text)" })}>
          My Trips
        </NavLink>
        {user?.isAdmin && (
          <NavLink to="/admin" style={({ isActive }) => ({ color: isActive ? "var(--accent2)" : "var(--text)" })}>
            Catalogue
          </NavLink>
        )}
      </nav>

      <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
        <button
          className="theme-toggle"
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
        </button>
        {user ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
            <span className="auth-name" style={{ fontSize: "0.88rem" }}>{user.name}</span>
            <button className="btn btn-outline" onClick={logout}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="btn" onClick={onOpenAuth}>
            Sign in
          </button>
        )}
      </div>
    </header>
  );
}
