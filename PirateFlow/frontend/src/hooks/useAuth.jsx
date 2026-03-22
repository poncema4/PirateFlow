import { useState, createContext, useContext } from "react";
import { tokenStorage } from "../api/client";

export const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("pf_user");
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData, tokens) => {
    const normalized = {
      ...userData,
      name:
        userData.name ??
        (`${userData.first_name ?? ""} ${userData.last_name ?? ""}`.trim() ||
          userData.email),
    };
    if (tokens) tokenStorage.set(tokens.access_token, tokens.refresh_token);
    localStorage.setItem("pf_user", JSON.stringify(normalized));
    setUser(normalized);
  };

  const logout = () => {
    tokenStorage.clear();
    localStorage.removeItem("pf_user");
    setUser(null);
  };

  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
