import React, { createContext, useContext, useState } from "react";

// Create the Auth Context
// The context will hold and share authentication-related data (like the current user) across the app.
const AuthContext = createContext();

// AuthProvider Component
// This is the provider component that will wrap parts of the application needing access to the authentication state.
export const AuthProvider = ({ children }) => {
  // `user` state holds the current authenticated user's data. Initially, it is `null` (meaning no user is logged in).
  const [user, setUser] = useState(null);

  // The `AuthContext.Provider` will allow any component inside it (i.e., `children`) to access `user` and `setUser`.
  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}  {/* All components that are wrapped inside `AuthProvider` will have access to `user` and `setUser` */}
    </AuthContext.Provider>
  );
};

// Custom hook for easy access
// This custom hook allows components to access the `user` and `setUser` without directly using `useContext(AuthContext)`.
// It's a cleaner way to access context values.
export const useAuth = () => useContext(AuthContext);
