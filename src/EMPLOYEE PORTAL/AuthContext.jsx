import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const AuthContext = createContext(null);
const STORAGE_KEY = "naysa_auth_user";

const getStoredUser = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

const saveStoredUser = (userData) => {
  if (userData) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
  } else {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("token");
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(getStoredUser);

  const login = useCallback((userData) => {
    saveStoredUser(userData);
    setUserState(userData);
  }, []);

  const setUser = useCallback((userDataOrUpdater) => {
    setUserState((currentUser) => {
      const nextUser =
        typeof userDataOrUpdater === "function"
          ? userDataOrUpdater(currentUser)
          : userDataOrUpdater;

      saveStoredUser(nextUser);
      return nextUser;
    });
  }, []);

  const logout = useCallback(() => {
    saveStoredUser(null);
    setUserState(null);
  }, []);

  useEffect(() => {
    const syncAuthFromStorage = () => {
      setUserState(getStoredUser());
    };

    window.addEventListener("pageshow", syncAuthFromStorage);
    window.addEventListener("focus", syncAuthFromStorage);
    window.addEventListener("storage", syncAuthFromStorage);

    return () => {
      window.removeEventListener("pageshow", syncAuthFromStorage);
      window.removeEventListener("focus", syncAuthFromStorage);
      window.removeEventListener("storage", syncAuthFromStorage);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      setUser,
      isAuthenticated: !!user,
      authLoading: false,
    }),
    [user, login, logout, setUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
