import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY = "naysa_auth_user"; // change name if you want

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Always use this to update user so it syncs to storage
  const setUser = (nextUser) => {
    setUserState(nextUser);

    try {
      if (nextUser) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextUser));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // storage may fail in private mode / policy — still keep app working
      console.warn("Auth storage warning:", e);
    }
  };

  // Restore user on refresh (rehydrate)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        setUserState(JSON.parse(raw));
      }
    } catch (e) {
      console.warn("Auth restore warning:", e);
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // Optional helpers (useful for login/logout calls)
  const login = (userObj) => setUser(userObj);
  const logout = () => setUser(null);

  const value = useMemo(
    () => ({
      user,
      setUser,      // keep compatibility with your existing code
      login,        // optional
      logout,       // optional
      authLoading,  // IMPORTANT: use this in route guard to avoid early redirect
      isAuthenticated: !!user,
    }),
    [user, authLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
