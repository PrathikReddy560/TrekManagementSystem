import { createContext, useContext, useEffect, useState } from "react";
import { api } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("trekai_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("trekai_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) localStorage.setItem("trekai_token", token);
    else localStorage.removeItem("trekai_token");
  }, [token]);

  useEffect(() => {
    if (user) localStorage.setItem("trekai_user", JSON.stringify(user));
    else localStorage.removeItem("trekai_user");
  }, [user]);

  async function login(email, password) {
    const data = await api.login({ email, password });
    setToken(data.token);
    setUser(data.user);
  }

  async function signup(name, email, password) {
    const data = await api.signup({ name, email, password });
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ token, user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
