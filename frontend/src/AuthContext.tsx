import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isAxiosError } from "axios";
import { api, type User } from "./api";

const TOKEN_KEY = "clearcheck_token";
const USER_KEY = "clearcheck_user";

function isUser(user: unknown): user is User {
  return (
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    typeof user.id === "string" &&
    "email" in user &&
    typeof user.email === "string" &&
    (!("role" in user) || user.role === "user" || user.role === "admin") &&
    (!("name" in user) || typeof user.name === "string")
  );
}

interface AuthValue {
  user: User | null;
  profilePhotoUrl: string | null;
  profilePhotoRequired: boolean;
  profilePhotoLoading: boolean;
  profilePhotoError: string;
  loading: boolean;
  refreshProfilePhoto: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

function getStoredUser(): User | null {
  const storedUser = localStorage.getItem(USER_KEY);
  if (!storedUser) return null;

  try {
    const user: unknown = JSON.parse(storedUser);
    if (isUser(user)) return user;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }

  localStorage.removeItem(USER_KEY);
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    localStorage.getItem(TOKEN_KEY) ? getStoredUser() : null,
  );
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [profilePhotoRequired, setProfilePhotoRequired] = useState(false);
  const [profilePhotoLoading, setProfilePhotoLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)));
  const [profilePhotoError, setProfilePhotoError] = useState("");
  const profilePhotoUrlRef = useRef<string | null>(null);

  const refreshProfilePhoto = useCallback(async () => {
    setProfilePhotoError("");
    setProfilePhotoLoading(true);
    try {
      const { data } = await api.get<Blob>("/profile/photo", { responseType: "blob" });
      const nextUrl = URL.createObjectURL(data);
      if (profilePhotoUrlRef.current) URL.revokeObjectURL(profilePhotoUrlRef.current);
      profilePhotoUrlRef.current = nextUrl;
      setProfilePhotoUrl(nextUrl);
      setProfilePhotoRequired(false);
    } catch (issue: unknown) {
      if (isAxiosError(issue) && issue.response?.status === 404) {
        if (profilePhotoUrlRef.current) URL.revokeObjectURL(profilePhotoUrlRef.current);
        profilePhotoUrlRef.current = null;
        setProfilePhotoUrl(null);
        setProfilePhotoRequired(true);
        return;
      }
      setProfilePhotoError(issue instanceof Error ? issue.message : "Unable to load your profile photo.");
      throw issue;
    } finally {
      setProfilePhotoLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;
    api.get<{ user: User }>("/auth/me")
      .then(({ data }) => {
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch((issue: unknown) => {
        if (isAxiosError(issue) && issue.response?.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!user) {
      if (profilePhotoUrlRef.current) URL.revokeObjectURL(profilePhotoUrlRef.current);
      profilePhotoUrlRef.current = null;
      setProfilePhotoUrl(null);
      setProfilePhotoRequired(false);
      setProfilePhotoLoading(false);
      return;
    }
    void refreshProfilePhoto().catch(() => undefined);
  }, [user?.id, refreshProfilePhoto]);

  const value = useMemo<AuthValue>(() => ({
    user,
    profilePhotoUrl,
    profilePhotoRequired,
    profilePhotoLoading,
    profilePhotoError,
    loading,
    refreshProfilePhoto,
    async signIn(email, password) {
      const { data } = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setProfilePhotoLoading(true);
      setProfilePhotoRequired(false);
      setUser(data.user);
    },
    async signUp(name, email, password) {
      const { data } = await api.post<{ token: string; user: User }>("/auth/register", { name, email, password });
      localStorage.setItem(TOKEN_KEY, data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      setProfilePhotoLoading(true);
      setProfilePhotoRequired(false);
      setUser(data.user);
    },
    signOut() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setProfilePhotoLoading(false);
      setUser(null);
    },
  }), [user, profilePhotoUrl, profilePhotoRequired, profilePhotoLoading, profilePhotoError, loading, refreshProfilePhoto]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
