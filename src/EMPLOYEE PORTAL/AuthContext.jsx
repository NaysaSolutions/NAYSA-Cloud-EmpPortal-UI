import React, { createContext, useContext, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "naysa_auth_user";

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = (userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUserState(userData);
  };

  const setUser = (userData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
    setUserState(userData);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      setUser, // ✅ exposed
      isAuthenticated: !!user,
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);