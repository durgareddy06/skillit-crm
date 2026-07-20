import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchMe, loginRequest } from "../api/auth";

const AuthContext = createContext(null);

const parseStoredUser = () => {
  const token = localStorage.getItem("skillit_token");
  const savedUser = localStorage.getItem("skillit_user");

  if (!token || !savedUser) {
    if (!token) localStorage.removeItem("skillit_user");
    return null;
  }

  try {
    const parsedUser = JSON.parse(savedUser);
    return parsedUser && typeof parsedUser === "object" ? parsedUser : null;
  } catch {
    localStorage.removeItem("skillit_user");
    return null;
  }
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("skillit_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const { user: freshUser } = await fetchMe();
      if (freshUser) {
        localStorage.setItem("skillit_user", JSON.stringify(freshUser));
        setUser(freshUser);
        return freshUser;
      }
    } catch {
      // Keep the stored session if the backend is temporarily unavailable.
    } finally {
      setLoading(false);
    }

    return null;
  }, []);

  useEffect(() => {
    const storedUser = parseStoredUser();
    if (storedUser) setUser(storedUser);
    refreshUser();

    // If the axios interceptor clears the token on a 401, react to it here.
    const onStorage = (e) => {
      if (e.key === "skillit_token" && !e.newValue) setUser(null);
      if (e.key === "skillit_permissions_updated_at") refreshUser();
    };

    const onFocus = () => {
      refreshUser();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshUser();
    };

    const pollId = window.setInterval(() => {
      if (localStorage.getItem("skillit_token")) refreshUser();
    }, 60000);

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(pollId);
    };
  }, [refreshUser]);

  const login = async (phone, password) => {
    try {
      const { token, user: loggedInUser } = await loginRequest(phone, password);
      localStorage.setItem("skillit_token", token);
      localStorage.setItem("skillit_user", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      return { ok: true };
    } catch (err) {
      const message = err?.response?.data?.message || "Couldn't log in. Check your details and try again.";
      return { ok: false, message };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("skillit_user");
    localStorage.removeItem("skillit_token");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
