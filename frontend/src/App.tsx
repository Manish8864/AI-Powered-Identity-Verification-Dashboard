import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Activity, AlertCircle, ArrowDown, ArrowLeft, ArrowRight, Bell, Check, CheckCircle2,
  ChevronLeft, ChevronRight, ClipboardCheck, Clock3, FileCheck2,
  FileText, Fingerprint, Gauge, LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal,
  Plus, Search, Settings, ShieldAlert, ShieldCheck, SlidersHorizontal, UploadCloud,
  UserRound, Users, X,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api, type AdminDashboard, type AdminReport, type AdminReportRange, type Application, type CustomerRecord, type DemoDocument, type ListResponse, type ScreeningRun, type User } from "./api";
import { AuthProvider, useAuth } from "./AuthContext";

const userNav = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/app/verification", label: "Start verification", icon: Fingerprint },
  { to: "/app/documents", label: "My documents", icon: FileText },
  { to: "/app/history", label: "Verification history", icon: Clock3 },
  { to: "/app/risk", label: "Risk explanation", icon: ShieldCheck },
  { to: "/app/settings", label: "Settings", icon: Settings },
];
const adminNav = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/applications", label: "Applications", icon: ClipboardCheck },
  { to: "/admin/review", label: "Review queue", icon: FileCheck2 },
  { to: "/admin/review-history", label: "Review history", icon: Clock3 },
  { to: "/admin/risk", label: "Risk monitoring", icon: ShieldAlert },
  { to: "/admin/reports", label: "Reports", icon: Activity },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];
const documentCategories = [
  ["identity", "Identity"],
  ["passport", "Passport"],
  ["national-id", "National ID"],
  ["driver-license", "Driver license"],
  ["residence-permit", "Residence permit"],
  ["voter-id", "Voter ID"],
  ["birth-certificate", "Birth certificate"],
  ["address-proof", "Address proof"],
  ["utility-bill", "Utility bill"],
  ["bank-statement", "Bank statement"],
  ["lease-agreement", "Lease agreement"],
  ["tax-document", "Tax document"],
  ["employment-letter", "Employment letter"],
  ["business-registration", "Business registration"],
  ["supporting", "Supporting document"],
] as const;
const businessEntityTypes = [
  "Private Limited Company",
  "Public Limited Company",
  "Limited Liability Partnership",
  "Partnership Firm",
  "Sole Proprietorship",
  "Trust or NGO",
  "Other",
] as const;
const businessDocumentLabels: Record<string, Record<string, string>> = {
  "Private Limited Company": {
    "business-registration": "Certificate of incorporation / CIN",
    "tax-document": "Company PAN / GSTIN",
    "address-proof": "Registered office address proof",
    "bank-statement": "Company bank statement",
    supporting: "MOA/AOA, ownership, or authorization",
  },
  "Public Limited Company": {
    "business-registration": "Certificate of incorporation / CIN",
    "tax-document": "Company PAN / GSTIN",
    "address-proof": "Registered office address proof",
    "bank-statement": "Company bank statement",
    supporting: "MOA/AOA, ownership, or authorization",
  },
  "Limited Liability Partnership": {
    "business-registration": "LLP incorporation certificate / LLPIN",
    "tax-document": "LLP PAN / GSTIN",
    "address-proof": "Registered office address proof",
    "bank-statement": "LLP bank statement",
    supporting: "LLP agreement / partner authorization",
  },
  "Partnership Firm": {
    "business-registration": "Partnership deed / firm registration",
    "tax-document": "Firm PAN / GSTIN",
    "address-proof": "Principal place of business proof",
    "bank-statement": "Firm bank statement",
    supporting: "Partner authorization / ownership",
  },
  "Sole Proprietorship": {
    "business-registration": "Udyam / shop or trade registration",
    "tax-document": "Proprietor PAN / GSTIN",
    "address-proof": "Business address proof",
    "bank-statement": "Business bank statement",
    supporting: "Trade licence / business authorization",
  },
  "Trust or NGO": {
    "business-registration": "Trust deed / NGO registration",
    "tax-document": "Organization PAN / tax registration",
    "address-proof": "Registered office address proof",
    "bank-statement": "Organization bank statement",
    supporting: "Trustee / governing document",
  },
};
const businessDocumentTypes = ["identity", "business-registration", "tax-document", "address-proof", "bank-statement", "supporting"] as const;
function getDocumentCategories(workflow: "individual" | "business", entityType: string) {
  if (workflow === "individual") {
    return documentCategories.filter(([value]) => value !== "business-registration");
  }
  if (!entityType) return [];
  const labels = businessDocumentLabels[entityType] ?? {};
  return businessDocumentTypes.map((value) => [
    value,
    value === "identity"
      ? "Authorized representative identity"
      : labels[value] ?? (value === "business-registration" ? "Business registration evidence" : value === "tax-document" ? "Tax registration" : value === "address-proof" ? "Business address proof" : value === "bank-statement" ? "Business bank statement" : "Supporting document"),
  ] as const);
}
const dateLabel = (value?: string) => value ? new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";
const dateTimeLabel = (value?: string) => value ? new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
const statusClass = (status = "Pending") => `status status-${status.toLowerCase().replace(/[^a-z]/g, "")}`;
const getError = (error: unknown) => {
  if (typeof error === "object" && error && "response" in error) {
    const data = (error as { response?: { data?: { error?: string; message?: string } } }).response?.data;
    return data?.error ?? data?.message ?? "Something went wrong. Please try again.";
  }
  return "Could not reach the service. Check your connection and try again.";
};

function App() {
  return <AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider>;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return <div className="full-loading"><div className="spinner" />Restoring your secure session…</div>;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to={homeFor(user)} replace /> : <AuthScreen mode="login" />} />
    <Route path="/signup" element={user ? <Navigate to={homeFor(user)} replace /> : <AuthScreen mode="signup" />} />
    <Route path="/" element={<Navigate to={user ? homeFor(user) : "/login"} replace />} />
    <Route path="/app/*" element={<Protected admin={false}><Workspace admin={false} /></Protected>} />
    <Route path="/admin/*" element={<Protected admin><Workspace admin /></Protected>} />
    <Route path="*" element={<Navigate to={user ? homeFor(user) : "/login"} replace />} />
  </Routes>;
}

function homeFor(user: User) { return user.role === "admin" ? "/admin" : "/app"; }

function Protected({ admin, children }: { admin: boolean; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== "admin") return <Navigate to="/app" replace />;
  if (!admin && user.role === "admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

const authSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
  confirmPassword: z.string().optional(),
});
type AuthFields = z.infer<typeof authSchema>;

function AuthScreen({ mode }: { mode: "login" | "signup" }) {
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors }, setError: setFieldError } = useForm<AuthFields>({
    resolver: zodResolver(authSchema),
  });
  const submit = handleSubmit(async (fields) => {
    setError(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!fields.name?.trim()) {
          setFieldError("name", { message: "Enter your full name" });
          return;
        }
        if (fields.password.length < 12) {
          setFieldError("password", { message: "Use at least 12 characters" });
          return;
        }
        if (fields.password !== fields.confirmPassword) {
          setFieldError("confirmPassword", { message: "Passwords do not match" });
          return;
        }
        await signUp(fields.name.trim(), fields.email, fields.password);
      } else {
        await signIn(fields.email, fields.password);
      }
      navigate("/app", { replace: true });
    } catch (issue) { setError(getError(issue)); } finally { setBusy(false); }
  });
  return <main className="auth-page">
    <section className="auth-promo">
      <Brand />
      <div className="promo-copy">
        <span className="eyebrow">CLEARCHECK · COMPLIANCE WORKSPACE</span>
        <h1>Better oversight.<br />More confident decisions.</h1>
        <p>A considered workspace for customer onboarding and compliance operations.</p>
        <div className="promo-note"><ShieldCheck size={19} /><span><b>Built for thoughtful review</b><br />Keep customer activity organized in one place.</span></div>
      </div>
    </section>
    <section className="auth-form-wrap">
      <div className="auth-form">
        <div className="mobile-brand"><Brand /></div>
        <p className="eyebrow">{mode === "login" ? "WELCOME BACK" : "GET STARTED"}</p>
        <h2>{mode === "login" ? "Sign in to your account" : "Create your account"}</h2>
        <p className="muted">{mode === "login" ? "Enter your details to continue to your workspace." : "Create a secure account to begin your demo."}</p>
        {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
        <form onSubmit={submit} className="stack">
          {mode === "signup" && <label>Full name<input autoComplete="name" placeholder="Alex Morgan" {...register("name")} />{errors.name && <small className="field-error">{errors.name.message}</small>}</label>}
          <label>Email address<input type="email" autoComplete="email" placeholder="you@company.com" {...register("email")} />{errors.email && <small className="field-error">{errors.email.message}</small>}</label>
          <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "At least 12 characters" : "Enter your password"} {...register("password")} />{errors.password && <small className="field-error">{errors.password.message}</small>}</label>
          {mode === "signup" && <label>Confirm password<input type="password" autoComplete="new-password" placeholder="Repeat your password" {...register("confirmPassword")} />{errors.confirmPassword && <small className="field-error">{errors.confirmPassword.message}</small>}</label>}
          <button className="button primary wide" disabled={busy}>{busy ? <><span className="spinner light" />Please wait…</> : mode === "login" ? "Sign in" : "Create account"}<ArrowRight size={17} /></button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to Clearcheck?" : "Already have an account?"} <Link to={mode === "login" ? "/signup" : "/login"}>{mode === "login" ? "Create an account" : "Sign in"}</Link></p>
        <p className="auth-legal"><LockKeyhole size={13} /> Your account is protected with secure sign-in.</p>
      </div>
    </section>
  </main>;
}

function Brand() { return <Link className="brand" to="/"><span className="brand-symbol">C</span><span>clearcheck<span className="brand-dot">.</span></span></Link>; }
function Workspace({ admin }: { admin: boolean }) {
  const { user, profilePhotoUrl, profilePhotoRequired, profilePhotoLoading, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    _id: string;
    message: string;
    applicationId?: string;
    readAt?: string | null;
    createdAt: string;
  }>>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);
  const [notificationError, setNotificationError] = useState("");
  const [notificationFilter, setNotificationFilter] = useState<"all" | "today" | "7days" | "unread">("all");
  const location = useLocation();
  const navigate = useNavigate();
  const nav = admin ? adminNav : userNav;
  const active = nav.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to));
  const title = active?.label ?? (admin ? "Overview" : "Overview");
  const profileName = admin
    ? user?.name?.replace(/^demo\s+/i, "") || user?.email?.split("@")[0]
    : user?.name ?? user?.email?.split("@")[0];
  const settingsPath = admin ? "/admin/settings" : "/app/settings";
  const loadNotifications = useCallback(async () => {
    setNotificationsLoading(true);
    setNotificationError("");
    try {
      const { data } = await api.get<{ items: typeof notifications }>("/notifications");
      setNotifications([...data.items].sort((a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (issue) {
      setNotificationError(getError(issue));
    } finally {
      setNotificationsLoading(false);
    }
  }, []);
  useEffect(() => { void loadNotifications(); }, [user?.id, loadNotifications]);
  useEffect(() => {
    if (notificationsOpen) void loadNotifications();
  }, [notificationsOpen, loadNotifications]);
  useEffect(() => {
    const interval = window.setInterval(() => void loadNotifications(), 30000);
    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadNotifications]);
  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest(".notification-wrap")) {
        setNotificationsOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [notificationsOpen]);
  const unreadCount = notifications.filter((item) => !item.readAt).length;
  const filteredNotifications = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 7);
    return notifications.filter((item) => {
      if (notificationFilter === "unread") return !item.readAt;
      const createdAt = new Date(item.createdAt);
      if (notificationFilter === "today") return createdAt >= startOfToday;
      if (notificationFilter === "7days") return createdAt >= cutoff;
      return true;
    });
  }, [notifications, notificationFilter]);
  async function markNotificationRead(id: string) {
    setNotificationError("");
    try {
      const { data } = await api.patch<{ notification: { readAt?: string | null } }>(`/notifications/${id}/read`);
      setNotifications((items) => items.map((item) =>
        item._id === id ? { ...item, readAt: data.notification.readAt ?? new Date().toISOString() } : item,
      ));
      await loadNotifications();
    } catch (issue) {
      setNotificationError(getError(issue));
    }
  }
  async function markAllNotificationsRead() {
    setNotificationError("");
    try {
      await api.patch("/notifications/read-all");
      await loadNotifications();
    } catch (issue) {
      setNotificationError(getError(issue));
    }
  }
  async function openNotification(item: (typeof notifications)[number]) {
    if (!item.readAt) await markNotificationRead(item._id);
    setNotificationsOpen(false);
    if (item.applicationId) {
      navigate(admin ? `/admin/review/${item.applicationId}` : "/app/history");
    }
  }
  return <div className={`workspace ${admin ? "admin-workspace" : "user-workspace"}`}>
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><Brand /><button className="icon-btn sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
      <div className="workspace-select"><span className="workspace-avatar">{admin ? "A" : "C"}</span><span><b>{admin ? "Admin workspace" : "Personal workspace"}</b><small>{admin ? "Compliance team" : "Individual account"}</small></span></div>
      <div className="nav-caption">WORKSPACE</div>
      <nav className="side-nav">{nav.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} onClick={() => setSidebarOpen(false)} className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}><Icon size={18} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="profile"><span className="profile-avatar">{profilePhotoUrl ? <img src={profilePhotoUrl} alt="" /> : (profileName ?? "U").slice(0, 1).toUpperCase()}</span><span className="profile-info"><b>{profileName}</b><small>{user?.email}</small></span><button aria-label="Sign out" className="icon-btn" onClick={signOut}><LogOut size={17} /></button></div></div>
    </aside>
    {sidebarOpen && <button className="mobile-shade" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
    <main className="main-panel">
      <header className="topbar">
        <button className="icon-btn menu-trigger" onClick={() => setSidebarOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
        <div className="breadcrumb">Workspace <span>/</span> <b>{title}</b></div>
        <div className="top-actions">
          <span className="secure-label"><LockKeyhole size={13} /> Secure workspace</span>
          <div className="notification-wrap">
            <button
              className="icon-btn notification-btn"
              aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
              aria-expanded={notificationsOpen}
              aria-controls="notifications-panel"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <Bell size={18} />
              {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span>}
            </button>
            {notificationsOpen && <div className="notification-popover" id="notifications-panel">
              <div className="notification-header">
                <b>Notifications {unreadCount > 0 && <span className="pill neutral">{unreadCount} new</span>}</b>
                <div className="notification-header-actions">
                  {unreadCount > 0 && <button className="text-button" onClick={() => void markAllNotificationsRead()}>Mark all read</button>}
                  <button className="icon-btn" onClick={() => void loadNotifications()} aria-label="Refresh notifications"><Clock3 size={15} /></button>
                  <button className="icon-btn" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={15} /></button>
                </div>
              </div>
              <div className="notification-filters" aria-label="Filter notifications">
                {([
                  ["all", "All"],
                  ["today", "Today"],
                  ["7days", "Last 7 days"],
                  ["unread", "Unread"],
                ] as const).map(([value, label]) => (
                  <button key={value} className={notificationFilter === value ? "active" : ""} onClick={() => setNotificationFilter(value)}>{label}</button>
                ))}
              </div>
              {notificationError && <p className="notification-error">{notificationError}</p>}
              {notificationsLoading && !notifications.length
                ? <p className="notification-loading">Loading notifications…</p>
                : filteredNotifications.length
                  ? <div className="notification-list">{filteredNotifications.slice(0, 8).map((item) => (
                    <button
                      key={item._id}
                      className={`notification-item ${item.readAt ? "" : "unread"}`}
                      onClick={() => void openNotification(item)}
                    >
                      {!item.readAt && <span className="notification-dot" />}
                      <span><b>{item.message}</b><small>{dateLabel(item.createdAt)}</small></span>
                    </button>
                  ))}</div>
                  : !notificationError && <p className="notification-empty">{notificationFilter === "unread" ? "No unread notifications." : "No notifications for this period."}</p>}
            </div>}
          </div>
        </div>
      </header>
      <div className="page-content">
        {profilePhotoLoading
          ? <PageLoading label="Loading profile photo…" />
          : profilePhotoRequired && !admin && location.pathname !== settingsPath
            ? <Navigate to={settingsPath} replace />
            : admin ? <AdminRoutes /> : <UserRoutes />}
        <footer className="page-footer"><span>© 2025 Clearcheck · Built for better oversight</span></footer>
      </div>
    </main>
  </div>;
}

function PageHeading({ eyebrow, title, description, action }: { eyebrow?: string; title: ReactNode; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="muted">{description}</p>}</div>{action}</div>;
}

function UserRoutes() {
  return <Routes>
    <Route index element={<UserOverview />} /><Route path="verification" element={<Verification />} />
    <Route path="documents" element={<Documents />} /><Route path="history" element={<History />} />
    <Route path="risk" element={<RiskExplanation />} /><Route path="settings" element={<SettingsPage />} />
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes>;
}

function UserOverview() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshError, setRefreshError] = useState("");
  useEffect(() => {
    let active = true;
    const refreshApplications = () => {
      if (document.visibilityState !== "visible") return;
      void api.get<ListResponse<Application>>("/applications/my")
        .then(({ data }) => {
          if (!active) return;
          setApplications(data.items ?? []);
          setRefreshError("");
        })
        .catch((issue) => {
          if (active) setRefreshError(getError(issue));
        });
    };
    Promise.all([
      api.get<ListResponse<Application>>("/applications/my"),
      api.get<{ items: unknown[] }>("/documents/my"),
    ])
      .then(([applicationResponse, documentResponse]) => {
        if (!active) return;
        setApplications(applicationResponse.data.items ?? []);
        setDocumentCount(documentResponse.data.items?.length ?? 0);
      })
      .catch((issue) => { if (active) setError(getError(issue)); })
      .finally(() => { if (active) setLoading(false); });
    const interval = window.setInterval(refreshApplications, 30000);
    window.addEventListener("focus", refreshApplications);
    document.addEventListener("visibilitychange", refreshApplications);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshApplications);
      document.removeEventListener("visibilitychange", refreshApplications);
    };
  }, []);
  const current = applications[0];
  const personal = current?.personalInformation;
  const identity = current?.identityInformation;
  const completionFields = [
    personal?.fullName, personal?.dateOfBirth, personal?.email, personal?.phone,
    personal?.country, personal?.city, personal?.address, identity?.documentType,
    identity?.documentReference, identity?.nationality,
  ];
  const completion = Math.round(
    (completionFields.filter(Boolean).length / completionFields.length) * 100,
  );
  const status = current?.status ?? "Not Started";
  const statusSummary = current
    ? [current.applicationId, current.statusChangedAt ?? current.updatedAt ?? current.createdAt
      ? `Updated ${dateTimeLabel(current.statusChangedAt ?? current.updatedAt ?? current.createdAt)}`
      : undefined].filter(Boolean).join(" · ")
    : "Begin when you're ready";
  return <>
    <PageHeading eyebrow="YOUR WORKSPACE" title={<>Good day, <span className="greeting-name">{user?.name ?? user?.email?.split("@")[0] ?? "there"}</span></>} description="Here's the latest from your compliance workspace." action={<Link className="button primary" to="/app/verification"><Plus size={16} /> {current ? "Continue verification" : "Start verification"}</Link>} />
    {(error || refreshError) && <div className="alert error"><AlertCircle size={16} />{error || refreshError}</div>}
    {loading ? <PageLoading label="Loading your verification status…" /> : <>
      <div className="stat-grid three"><StatCard icon={<ClipboardCheck />} label="Verification status" value={status} sub={statusSummary} color="blue" /><StatCard icon={<FileText />} label="Documents submitted" value={documentCount} sub="Attached files" color="purple" /><StatCard icon={<ShieldCheck />} label="Profile completion" value={`${completion}%`} sub={current?.riskScore !== undefined ? `Simulated score: ${current.riskScore}/100` : "Complete your profile"} color="green" /></div>
      <div className="content-grid overview-grid"><section className="panel"><div className="panel-head"><div><h2>Verification progress</h2><p className="muted">Your onboarding steps at a glance</p></div><span className={statusClass(status)}>{status}</span></div><div className="progress-steps">{["Personal details", "Identity information", "Review & submit"].map((step, index) => <div className="progress-step" key={step}><span className="step-number">{index + 1}</span><div><b>{step}</b><small>{index === 0 ? "Enter your personal details" : index === 1 ? "Add your document details" : "Review and submit for simulated checks"}</small></div><span className="step-state">{completion >= (index + 1) * 33 ? "Complete" : index === 0 ? "Ready" : "Upcoming"}</span></div>)}</div><Link to="/app/verification" className="button secondary">Continue onboarding <ArrowRight size={16} /></Link></section><section className="panel"><div className="panel-head"><div><h2>Recent activity</h2><p className="muted">Your latest workspace updates</p></div><Link to="/app/history" className="subtle-link">View history</Link></div>{applications.length ? <ApplicationTable rows={applications.slice(0, 3)} /> : <EmptyState icon={<Activity />} title="Nothing here yet" text="Your verification activity will appear here once you get started." />}</section></div>
    </>}
  </>;
}

function StatCard({ icon, label, value, sub, color = "blue", change }: { icon: ReactNode; label: string; value: ReactNode; sub?: string; color?: string; change?: string }) {
  return <div className="stat-card"><span className={`stat-icon ${color}`}>{icon}</span><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{change && <span className="positive"><ArrowDown size={12} />{change}</span>} {sub}</div></div>;
}

function AdminRoutes() {
  return <Routes>
    <Route index element={<AdminOverview />} /><Route path="customers" element={<AdminCustomers />} />
    <Route path="applications" element={<AdminList kind="applications" />} /><Route path="review" element={<AdminList kind="review" />} />
    <Route path="review/:id" element={<ReviewDetail />} /><Route path="review-history" element={<AdminReviewHistory />} /><Route path="risk" element={<AdminList kind="risk" />} />
    <Route path="reports" element={<AdminReports />} /><Route path="settings" element={<SettingsPage />} />
    <Route path="*" element={<Navigate to="/admin" replace />} />
  </Routes>;
}

function AdminOverview() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reportRange, setReportRange] = useState<AdminReportRange>("30d");
  const [report, setReport] = useState<AdminReport | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  useEffect(() => {
    let active = true;
    const refreshDashboard = () => {
      void api.get<AdminDashboard>("/admin/dashboard")
        .then(({ data }) => {
          if (!active) return;
          setDashboard(data);
          setError("");
        })
        .catch((issue) => { if (active) setError(getError(issue)); })
        .finally(() => { if (active) setLoading(false); });
    };
    refreshDashboard();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refreshDashboard();
    }, 30000);
    window.addEventListener("focus", refreshDashboard);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshDashboard);
    };
  }, []);
  useEffect(() => {
    let active = true;
    setReport(null);
    setReportLoading(true);
    setReportError("");
    api.get<AdminReport>("/admin/reports", { params: { range: reportRange } })
      .then(({ data }) => { if (active) setReport(data); })
      .catch((issue) => { if (active) setReportError(getError(issue)); })
      .finally(() => { if (active) setReportLoading(false); });
    return () => { active = false; };
  }, [reportRange]);
  if (loading) return <PageLoading label="Loading your dashboard…" />;
  return <>
    <PageHeading eyebrow="ADMIN WORKSPACE" title="Compliance overview" description="Monitor applications, customer onboarding and risk signals." action={<Link to="/admin/applications" className="button secondary">View applications <ArrowRight size={16} /></Link>} />
    {error && <div className="alert error"><AlertCircle size={17} />{error}<span className="alert-extra">The admin dashboard API is currently unavailable.</span></div>}
    {dashboard && <>
      <div className="stat-grid three">{[
        ["totalCustomers", "Total customers", <Users />, "blue"],
        ["verifiedCustomers", "Verified customers", <ShieldCheck />, "green"],
        ["pendingReviews", "Pending reviews", <Clock3 />, "amber"],
        ["rejectedApplications", "Rejected applications", <ShieldAlert />, "red"],
        ["correctionRequests", "Correction requests", <FileCheck2 />, "purple"],
        ["highRiskApplications", "High-risk applications", <Gauge />, "amber"],
      ].map(([key, label, icon, color]) => <StatCard key={String(key)} icon={icon as ReactNode} label={String(label)} value={(dashboard.stats?.[String(key)] ?? 0).toLocaleString()} sub="All-time demo data" color={String(color)} />)}</div>
      <div className="content-grid chart-grid">
        <section className="panel chart-panel">
          <div className="panel-head"><div><h2>Application activity</h2><p className="muted">{report ? `${dateLabel(report.period.start)} – ${dateLabel(report.period.end)}` : "Submissions and approvals over time"}</p></div>
            <label className="filter-select"><select aria-label="Overview reporting period" value={reportRange} onChange={(event) => setReportRange(event.target.value as AdminReportRange)}>
              <option value="3d">Last 3 days</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option>
            </select></label>
          </div>
          {reportLoading ? <PageLoading label="Loading application activity…" /> : report ? <TrendChart data={report.trends} /> : <EmptyState compact title="Activity unavailable" text={reportError || "Application activity could not be loaded."} />}
        </section>
        <section className="panel">
          <div className="panel-head"><div><h2>Risk distribution</h2><p className="muted">{report ? `${report.summary.applicationsSubmitted} submissions in this period` : "Current period application profile"}</p></div></div>
          {reportLoading ? <PageLoading label="Loading risk distribution…" /> : report ? <DistributionChart data={report.riskDistribution} /> : <EmptyState compact title="Risk data unavailable" text={reportError || "Risk distribution could not be loaded."} />}
        </section>
      </div>
      <section className="panel table-panel"><div className="panel-head"><div><h2>New applications</h2><p className="muted">Submitted applications waiting to be opened</p></div></div>{dashboard.recentApplications.length ? <ApplicationTable rows={dashboard.recentApplications} review /> : <EmptyState compact icon={<FileText />} title="No new applications" text="New submissions will appear here until opened for review." />}</section>
    </>}
    {!dashboard && !error && <EmptyState icon={<Gauge />} title="No dashboard data" text="Metrics will appear here when the service provides them." />}
  </>;
}

const chartColors = ["#7188ef", "#9d80e8", "#e7ad61", "#55b996", "#e47777"];

function TrendChart({ data }: { data: Array<Record<string, string | number>> }) {
  const keys = data[0]
    ? Object.keys(data[0]).filter((item) =>
        !["date", "month", "name"].includes(item) && typeof data[0][item] === "number",
      )
    : [];
  if (!data.length || !keys.length) return <EmptyState compact title="No trend data available" text="Application trends will appear once data is available." />;
  return <div className="chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ left: -20, right: 8, top: 8, bottom: 0 }}><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#7488ef" stopOpacity={0.2} /><stop offset="95%" stopColor="#7488ef" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#edf0f5" vertical={false} /><XAxis dataKey={data[0]?.date ? "date" : data[0]?.month ? "month" : "name"} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#98a1b1" }} /><YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#98a1b1" }} /><Tooltip />{keys.length > 1 && <Legend verticalAlign="top" height={28} />}{keys.map((key, index) => <Area key={key} type="monotone" dataKey={key} stroke={chartColors[index % chartColors.length]} strokeWidth={2.5} fill={keys.length === 1 ? "url(#chartFill)" : "none"} />)}</AreaChart></ResponsiveContainer></div>;
}
function DistributionChart({ data }: { data: Array<Record<string, string | number>> }) {
  const dataKey = data[0] ? Object.keys(data[0]).find((item) => typeof data[0][item] === "number") : undefined;
  const nameKey = data[0] ? Object.keys(data[0]).find((item) => item !== dataKey) : undefined;
  if (!data.length || !dataKey || !nameKey) return <EmptyState compact title="No risk data available" text="Risk distribution will appear here." />;
  return <><div className="chart donut-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={67} outerRadius={92} paddingAngle={3} stroke="none">{data.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div><div className="legend">{data.map((item, index) => <span key={index}><i style={{ backgroundColor: chartColors[index % chartColors.length] }} />{String(item[nameKey])}<b>{item[dataKey]}</b></span>)}</div></>;
}

function AdminCustomers() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse<CustomerRecord>>({ items: [], total: 0, page: 1, pages: 1 });
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<ListResponse<CustomerRecord>>("/admin/users", {
      params: { page, limit: 10, search: search || undefined },
    })
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((issue) => { if (active) setError(getError(issue)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search]);
  const selectedCustomer = data.items.find((customer) => customer.id === selectedId);
  return <>
    <PageHeading eyebrow="ADMIN WORKSPACE" title="Customers" description="Review customer accounts and their submitted profile details." />
    <section className="panel table-panel">
      <div className="list-toolbar"><label className="searchbox"><Search size={16} /><input placeholder="Search customers…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); setSelectedId(""); }} /></label></div>
      {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
      {loading ? <PageLoading label="Loading customers…" /> : data.items.length ? <>
        <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Email address</th><th>Account created</th><th></th></tr></thead><tbody>
          {data.items.map((customer) => <tr key={customer.id}>
            <td><span className="table-customer"><span className="table-avatar">{customer.name.charAt(0).toUpperCase()}</span><span><b>{customer.name}</b></span></span></td>
            <td>{customer.email}</td>
            <td>{dateLabel(customer.createdAt)}</td>
            <td><button className="button secondary customer-details-button" aria-expanded={selectedId === customer.id} onClick={() => setSelectedId(selectedId === customer.id ? "" : customer.id)}>{selectedId === customer.id ? "Hide details" : "View details"}</button></td>
          </tr>)}
        </tbody></table></div>
        {selectedCustomer && <CustomerDetails customer={selectedCustomer} onClose={() => setSelectedId("")} />}
        <div className="pagination"><span>Showing {Math.min((page - 1) * 10 + 1, data.total)}–{Math.min(page * 10, data.total)} of {data.total}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {page} of {Math.max(data.pages, 1)}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
      </> : !error && <EmptyState icon={<Users />} title="No customers found" text={search ? "Try adjusting your search." : "Customer accounts will appear here when available."} />}
      {!loading && error && <div className="empty-placeholder"><EmptyState icon={<Users />} title="Customer data unavailable" text="Customer records will show here when the admin API is available." /></div>}
    </section>
  </>;
}

function CustomerDetails({ customer, onClose }: { customer: CustomerRecord; onClose: () => void }) {
  const personal = customer.latestApplication?.personalInformation;
  const identity = customer.latestApplication?.identityInformation;
  const hasDetails = Object.values({ ...personal, ...identity }).some(Boolean);
  const fields = (items: Array<[string, string | undefined]>) => items.map(([label, value]) =>
    <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>,
  );
  return <section className="customer-details panel" aria-label={`Details for ${customer.name}`}>
    <div className="panel-head"><div><h2>{customer.name}</h2><p className="muted">{customer.email}</p></div><button className="icon-btn" aria-label="Close customer details" onClick={onClose}><X size={17} /></button></div>
    {hasDetails ? <div className="customer-details-grid">
      <div><h3>Personal information</h3><dl>{fields([
        ["Full name", personal?.fullName],
        ["Date of birth", personal?.dateOfBirth],
        ["Phone", personal?.phone],
        ["Email", personal?.email],
        ["Country", personal?.country],
        ["City", personal?.city],
        ["Address", personal?.address],
      ])}</dl></div>
      <div><h3>Identity information</h3><dl>{fields([
        ["Name on document", identity?.nameOnDocument],
        ["Document type", identity?.documentType],
        ["Document reference", identity?.documentReference],
        ["Nationality", identity?.nationality],
      ])}</dl></div>
    </div> : <EmptyState compact title="No profile details yet" text="This customer has not submitted verification details." />}
  </section>;
}

function AdminList({ kind }: { kind: "applications" | "review" | "risk" }) {
  const configs = {
    applications: { title: "Applications", description: "Track submitted onboarding applications.", endpoint: "/admin/applications", search: "Search applications…" },
    review: { title: "Review queue", description: "Review submitted applications and applications already under review.", endpoint: "/admin/applications", search: "Search review queue…" },
    risk: { title: "Risk monitoring", description: "Review risk signals across applications. Scores are simulated.", endpoint: "/admin/risk", search: "Search risk records…" },
  }[kind];
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(kind === "review" ? "Submitted,Under Review" : "");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResponse<Application>>({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    api.get<ListResponse<Application>>(configs.endpoint, { params: {
      page,
      limit: 10,
      search: search || undefined,
      status: kind === "review" ? undefined : status || undefined,
      statuses: kind === "review" ? status || undefined : undefined,
    } })
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((issue) => { if (active) setError(getError(issue)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [configs.endpoint, kind, page, search, status]);
  return <>
    <PageHeading eyebrow="ADMIN WORKSPACE" title={configs.title} description={configs.description} />
    <section className="panel table-panel">
      <div className="list-toolbar"><label className="searchbox"><Search size={16} /><input placeholder={configs.search} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /></label><label className="filter-select"><SlidersHorizontal size={15} /><select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
        {kind === "review" ? <>
          <option value="Submitted,Under Review">Needs review</option><option value="Submitted">Submitted</option><option value="Under Review">Under review</option>
        </> : <>
          <option value="">All statuses</option><option>Not Started</option><option>Submitted</option><option>Under Review</option><option>Draft</option><option>Approved</option><option>Rejected</option><option>Correction Required</option>
        </>}
      </select></label></div>
      {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
      {loading ? <PageLoading label={`Loading ${configs.title.toLowerCase()}…`} /> : data.items.length ? <><ApplicationTable rows={data.items} review={kind === "review"} /><div className="pagination"><span>Showing {Math.min((page - 1) * 10 + 1, data.total)}–{Math.min(page * 10, data.total)} of {data.total}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {page} of {Math.max(data.pages, 1)}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div></> : !error && <EmptyState icon={<FileText />} title="No results found" text={search || status ? "Try adjusting your search or filters." : "There are no records to show yet."} />}
      {!loading && error && <div className="empty-placeholder"><EmptyState icon={<FileText />} title="Data unavailable" text="Records will show here when the admin API is available." /></div>}
    </section>
  </>;
}

function ApplicationTable({ rows, review = false }: { rows: Application[]; review?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  return <div className="table-scroll"><table><thead><tr><th>Customer</th><th>Application ID</th><th>Submitted</th><th>Status</th><th>Risk</th><th></th></tr></thead><tbody>{rows.map((row, i) => {
    const id = String(row.id ?? row._id ?? "");
    const applicant = typeof row.userId === "object" && row.userId ? row.userId : undefined;
    const name = String(row.workflow === "business"
      ? row.businessInformation?.legalName ?? row.personalInformation?.fullName ?? applicant?.name ?? "Business"
      : row.personalInformation?.fullName ?? applicant?.name ?? row.name ?? row.email ?? "Customer");
    const email = String(row.personalInformation?.email ?? applicant?.email ?? row.email ?? "—");
    const status = String(row.status ?? "Pending");
    const risk = String(row.riskCategory ?? row.riskLevel ?? (typeof row.riskScore === "number" ? `${row.riskScore}/100` : "—"));
    const reference = row.applicationId ?? (id ? `#${id.slice(-8)}` : "—");
    const statusUpdatedAt = row.statusChangedAt ?? row.updatedAt ?? row.createdAt;
    const openReview = () => navigate(`/admin/review/${id}`, { state: { from: location.pathname } });
    return <tr key={id || i} onClick={review && id ? openReview : undefined} className={review && id ? "clickable-row" : ""}><td><span className="table-customer"><span className="table-avatar">{name.charAt(0).toUpperCase()}</span><span><b>{name}</b><small>{email}</small></span></span></td><td className="mono">{reference}</td><td>{dateLabel(String(row.submittedAt ?? row.createdAt ?? ""))}</td><td><span className={statusClass(status)}>{status}</span><small className="status-change-date">Updated {dateTimeLabel(statusUpdatedAt)}</small></td><td><span className={`risk-text risk-${risk.split(" ")[0].toLowerCase()}`}>{risk}</span></td><td><button className="icon-btn row-more" aria-label="View application" onClick={(event) => { event.stopPropagation(); if (id) openReview(); }}><MoreHorizontal size={18} /></button></td></tr>;
  })}</tbody></table></div>;
}

function ReviewDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const previousPath = (location.state as { from?: unknown } | null)?.from;
  const backPath = typeof previousPath === "string" && previousPath.startsWith("/admin")
    ? previousPath
    : "/admin/review";
  const backLabel = backPath === "/admin"
    ? "Back to overview"
    : backPath === "/admin/applications"
      ? "Back to applications"
      : backPath === "/admin/review-history" ? "Back to review history" : "Back to review queue";
  const [record, setRecord] = useState<Application | null>(null);
  const [documents, setDocuments] = useState<Array<{ _id: string; id?: string; originalName: string; documentType: string; createdAt: string }>>([]);
  const [reviews, setReviews] = useState<Array<{ _id: string; action: string; comments: string; createdAt: string; previousStatus: string; newStatus: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [screeningProvider, setScreeningProvider] = useState<ScreeningRun["provider"]>("Provider Alpha");
  const [checkDecisions, setCheckDecisions] = useState<Record<string, string>>({});
  const [checkNotes, setCheckNotes] = useState<Record<string, string>>({});
  async function loadRecord() {
    const { data } = await api.get<{
      application?: Application;
      documents?: typeof documents;
      reviews?: typeof reviews;
    }>(`/admin/applications/${id}`);
    setRecord(data.application ?? null);
    setDocuments(data.documents ?? []);
    setReviews(data.reviews ?? []);
  }
  useEffect(() => {
    let active = true;
    Promise.all([
      api.patch(`/admin/applications/${id}/seen`),
      loadRecord(),
    ])
      .catch((issue) => { if (active) setError(getError(issue)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);
  async function act(action: "start-review" | "approve" | "reject" | "request-corrections") {
    setBusy(true); setMessage(""); setError("");
    try {
      const status = action === "start-review"
        ? "Under Review"
        : action === "request-corrections" ? "Correction Required" : action === "reject" ? "Rejected" : "Approved";
      await api.patch(`/admin/applications/${id}/status`, { status, comments: note.trim() });
      const outcome = action === "start-review"
        ? "marked as under review"
        : action === "request-corrections" ? "corrections requested" : action === "reject" ? "rejected" : "approved";
      setMessage(`Application ${outcome} successfully.`);
      setNote("");
      await loadRecord();
    } catch (issue) { setError(getError(issue)); } finally { setBusy(false); }
  }
  async function addInternalNote() {
    if (!note.trim()) {
      setError("Enter a note before saving it.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await api.post(`/admin/applications/${id}/review`, { comments: note.trim() });
      setNote("");
      setMessage("Internal note added to the review history.");
      await loadRecord();
    } catch (issue) {
      setError(getError(issue));
    } finally {
      setBusy(false);
    }
  }
  async function runScreening() {
    setBusy(true); setError(""); setMessage("");
    try {
      await api.post(`/admin/applications/${id}/screening`, { provider: screeningProvider });
      setMessage(`${screeningProvider} simulator completed. Results are illustrative and are not real-world screening.`);
      await loadRecord();
    } catch (issue) {
      setError(getError(issue));
    } finally {
      setBusy(false);
    }
  }
  async function decideCheck(run: ScreeningRun, check: ScreeningRun["checks"][number]) {
    const key = `${run._id}:${check.code}`;
    const decision = checkDecisions[key];
    if (!decision) {
      setError("Choose a reviewer decision for this check.");
      return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      await api.patch(`/admin/applications/${id}/screening/${run._id}/${check.code}`, {
        decision,
        comments: checkNotes[key] ?? "",
      });
      setMessage(`Reviewer decision recorded for ${check.label}.`);
      await loadRecord();
    } catch (issue) {
      setError(getError(issue));
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <PageLoading label="Loading application…" />;
  return <>
    <button className="back-link" onClick={() => navigate(backPath)}><ArrowLeft size={16} /> {backLabel}</button>
    <PageHeading eyebrow="APPLICATION REVIEW" title={record?.workflow === "business" ? record.businessInformation?.legalName ?? "Business application" : record?.personalInformation?.fullName ?? "Review application"} description={`${record?.applicationId ?? `#${id.slice(-8)}`} · ${record?.workflow === "business" ? "Business" : "Individual"} · Submitted ${dateLabel(record?.submittedAt ?? record?.createdAt)}`} />
    {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}{message && <div className="alert success"><CheckCircle2 size={17} />{message}</div>}
    {!record ? <EmptyState icon={<FileText />} title="Application unavailable" text="This record could not be loaded from the review service." /> : <div className="content-grid review-grid">
      <section className="panel"><div className="panel-head"><div><h2>Application details</h2><p className="muted">Submitted application information</p></div><span className={statusClass(record.status)}>{record.status ?? "Pending"}</span></div><div className="detail-grid">{[
        ["Applicant type", record.workflow === "business" ? "Business" : "Individual"],
        [record.workflow === "business" ? "Authorized representative" : "Customer", record.personalInformation?.fullName],
        ["Email", record.personalInformation?.email],
        ["Application ID", record.applicationId],
        ["Status last updated", dateTimeLabel(record.statusChangedAt ?? record.updatedAt ?? record.createdAt)],
        ["Date of birth", record.personalInformation?.dateOfBirth],
        ["Phone", record.personalInformation?.phone],
        ["Country", record.personalInformation?.country],
        ["City", record.personalInformation?.city],
        ["Address", record.personalInformation?.address],
        ["Document type", record.identityInformation?.documentType],
        ["Document reference", record.identityInformation?.documentReference],
        ["Nationality", record.identityInformation?.nationality],
        ["Simulated risk score", record.riskScore === undefined ? "Not scored" : `${record.riskScore}/100 · ${record.riskCategory}`],
        ...(record.workflow === "business" ? [
          ["Registered legal name", record.businessInformation?.legalName],
          ["Entity type", record.businessInformation?.entityType],
          ["Registration identifier type", record.businessInformation?.registrationType],
          ["Registration number", record.businessInformation?.registrationNumber],
          ["Business activity", record.businessInformation?.businessActivity],
          ["Registered country", record.businessInformation?.country],
          ["Registered address", record.businessInformation?.registeredAddress],
          ["Website", record.businessInformation?.website],
        ] : []),
      ].map(([label, value]) => <div key={label}><small>{label}</small><b>{value ?? "—"}</b></div>)}</div>
        <h3 className="section-subheading">Private documents</h3>{documents.length ? documents.map((document) => <div className="document-row" key={document._id}><span className="file-icon"><FileText size={16} /></span><span className="document-info"><b>{document.originalName}</b><small>{document.documentType} · {dateLabel(document.createdAt)}</small></span><button className="button secondary" onClick={() => void downloadPrivateDocument(document._id, document.originalName).catch((issue) => setError(getError(issue)))}>Download</button></div>) : <p className="muted paragraph">No documents attached.</p>}
        <h3 className="section-subheading">Simulated provider checks</h3><p className="muted paragraph">All provider outcomes below are mock responses. No identity, sanctions/PEP, registry, adverse-media, or legal-activity source is connected.</p>
        {(record.screeningRuns ?? []).length ? [...(record.screeningRuns ?? [])].reverse().map((run) => <article className="screening-run" key={run._id}>
          <div className="screening-run-head"><div><b>{run.provider} · Simulator</b><small>{dateTimeLabel(run.createdAt)}</small></div><span className={statusClass(run.outcome)}>{run.outcome}</span></div>
          {run.checks.map((check) => {
            const key = `${run._id}:${check.code}`;
            return <div className="screening-check" key={check._id}>
              <div className="screening-check-head"><b>{check.label}</b><span className={statusClass(check.status)}>{check.status === "clear" ? "Simulated clear" : check.status}</span></div>
              <p>{check.details}</p>
              {check.reviewerDecision && <small className="screening-recorded-decision">Reviewer decision: {check.reviewerDecision}{check.reviewerNote ? ` · ${check.reviewerNote}` : ""}</small>}
              <div className="screening-decision-form">
                <select aria-label={`Decision for ${check.label}`} value={checkDecisions[key] ?? ""} onChange={(event) => setCheckDecisions((current) => ({ ...current, [key]: event.target.value }))}>
                  <option value="">Record reviewer decision…</option>{!["not-connected", "inconclusive"].includes(check.status) && <option value="accepted">Accept this check</option>}<option value="flagged">Flag for escalation</option><option value="needs-information">Request more information</option>
                </select>
                <input aria-label={`Note for ${check.label}`} value={checkNotes[key] ?? ""} onChange={(event) => setCheckNotes((current) => ({ ...current, [key]: event.target.value }))} placeholder="Optional reviewer note" />
                <button className="button secondary" disabled={busy || !checkDecisions[key]} onClick={() => void decideCheck(run, check)}>Save decision</button>
              </div>
            </div>;
          })}
        </article>) : <p className="muted paragraph">No simulated provider runs yet. Start one from the review actions.</p>}
        <h3 className="section-subheading">Verification history</h3>{reviews.length ? reviews.map((review) => <div className="review-history" key={review._id}><b>{review.action}</b><small>{review.previousStatus} → {review.newStatus} · {dateLabel(review.createdAt)}</small>{review.comments && <p>{review.comments}</p>}</div>) : <p className="muted paragraph">No review activity recorded.</p>}
      </section>
      <section className="panel"><h2>Run simulated provider</h2><p className="muted">Choose a canned provider response to exercise the review workflow. It is not a real verification result.</p><label className="screening-provider">Simulator<select value={screeningProvider} onChange={(event) => setScreeningProvider(event.target.value as ScreeningRun["provider"])}><option>Provider Alpha</option><option>Provider Beta</option><option>Provider Gamma</option></select></label><p className="muted paragraph">Alpha: data-based demo response · Beta: timeout · Gamma: manual-review response.</p><button disabled={busy || !["Submitted", "Under Review"].includes(record.status ?? "")} className="button secondary" onClick={() => void runScreening()}>Run simulated checks</button><hr className="review-divider" /><h2>Review decision</h2><p className="muted">Add an internal note, request corrections, or record the final decision after reviewing the case. The final status is a demo workflow outcome, not legal or regulatory clearance.</p><label className="note-label">Reviewer note<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for the customer or review team…" /></label><div className="review-actions">{record.status === "Submitted" && <button disabled={busy} className="button secondary" onClick={() => act("start-review")}>Start review</button>}<button disabled={busy} className="button secondary" onClick={addInternalNote}>Add internal note</button><button disabled={busy} className="button primary" onClick={() => act("approve")}><Check size={16} /> Approve</button><button disabled={busy} className="button secondary" onClick={() => act("request-corrections")}>Request corrections</button><button disabled={busy} className="button danger-outline" onClick={() => act("reject")}>Reject</button></div></section>
    </div>}
  </>;
}

function AdminReports() {
  const [range, setRange] = useState<AdminReportRange>("30d");
  const [data, setData] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setData(null);
    api.get<AdminReport>("/admin/reports", { params: { range } })
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((issue) => { if (active) setError(getError(issue)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [range]);
  return <>
    <PageHeading eyebrow="ADMIN WORKSPACE" title="Reports" description="Date-filtered onboarding activity and customer outcomes." action={<button className="button secondary" disabled={!data || loading} onClick={() => data && downloadAdminReport(data)}><ArrowDown size={16} /> Export CSV</button>} />
    {error && <div className="alert error"><AlertCircle size={17} />{error}</div>}
    {loading && !data ? <PageLoading label="Loading reports…" /> : data ? <>
      <div className="reports-toolbar">
        <div><b>Reporting period</b><p className="muted">Metrics use the selected period and UTC dates.</p></div>
        <label className="filter-select"><select aria-label="Reporting period" value={range} onChange={(event) => setRange(event.target.value as AdminReportRange)}>
          <option value="3d">Last 3 days</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option><option value="12m">Last 12 months</option>
        </select></label>
      </div>
      <p className="reports-date-range">{dateLabel(data.period.start)} – {dateLabel(data.period.end)}</p>
      <div className="stat-grid three">
        <StatCard icon={<ClipboardCheck />} label="Applications submitted" value={data.summary.applicationsSubmitted.toLocaleString()} sub="In selected period" color="blue" />
        <StatCard icon={<Users />} label="New customers" value={data.summary.newCustomers.toLocaleString()} sub="Registered in selected period" color="purple" />
        <StatCard icon={<CheckCircle2 />} label="Approved" value={data.summary.approved.toLocaleString()} sub="Current status of this submission cohort" color="green" />
        <StatCard icon={<ShieldAlert />} label="Rejected" value={data.summary.rejected.toLocaleString()} sub="Current status of this submission cohort" color="red" />
        <StatCard icon={<Clock3 />} label="Awaiting review" value={data.summary.awaitingReview.toLocaleString()} sub="Submitted or under review" color="amber" />
        <StatCard icon={<Gauge />} label="Average risk score" value={`${data.summary.averageRiskScore}/100`} sub="Simulated · submitted applications" color="blue" />
      </div>
      <div className="content-grid chart-grid">
        <section className="panel chart-panel"><div className="panel-head"><div><h2>Application activity</h2><p className="muted">Submissions and approvals over time</p></div></div><TrendChart data={data.trends} /></section>
        <section className="panel"><div className="panel-head"><div><h2>Current application outcomes</h2><p className="muted">Status of applications submitted in this period</p></div></div><DistributionChart data={data.outcomes} /></section>
        <section className="panel chart-panel"><div className="panel-head"><div><h2>Customer registrations</h2><p className="muted">New accounts over time</p></div></div><TrendChart data={data.registrations} /></section>
        <section className="panel"><div className="panel-head"><div><h2>Risk profile</h2><p className="muted">Applications submitted in this period</p></div></div><DistributionChart data={data.riskDistribution} /></section>
      </div>
    </> : !error ? <EmptyState icon={<Activity />} title="No report data" text="Reports will appear when data is available." /> : null}
  </>;
}

function downloadAdminReport(data: AdminReport) {
  const rows: Array<Array<string | number>> = [
    ["Clearcheck compliance report"],
    ["Range", data.range],
    ["Start date", dateLabel(data.period.start)],
    ["End date", dateLabel(data.period.end)],
    [],
    ["Summary", "Value"],
    ["Applications submitted", data.summary.applicationsSubmitted],
    ["New customers", data.summary.newCustomers],
    ["Approved", data.summary.approved],
    ["Rejected", data.summary.rejected],
    ["Awaiting review", data.summary.awaitingReview],
    ["Average risk score", data.summary.averageRiskScore],
    [],
    ["Application activity"],
    ["Period", "Submissions", "Approved"],
    ...data.trends.map((item) => [String(item.date ?? item.month ?? ""), Number(item.submitted ?? 0), Number(item.approved ?? 0)]),
    [],
    ["Application outcomes"],
    ["Status", "Applications"],
    ...data.outcomes.map((item) => [String(item.name ?? ""), Number(item.value ?? 0)]),
    [],
    ["Customer registrations"],
    ["Period", "Customers"],
    ...data.registrations.map((item) => [String(item.date ?? item.month ?? ""), Number(item.customers ?? 0)]),
    [],
    ["Risk distribution"],
    ["Category", "Applications"],
    ...data.riskDistribution.map((item) => [String(item.name ?? ""), Number(item.value ?? 0)]),
  ];
  const csv = rows.map((row) =>
    row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","),
  ).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `clearcheck-report-${data.range}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AdminReviewHistory() {
  const navigate = useNavigate();
  type ReviewHistoryItem = {
    _id: string;
    action: string;
    comments: string;
    previousStatus: string;
    newStatus: string;
    createdAt: string;
    applicationId?: {
      _id?: string;
      applicationId?: string;
      personalInformation?: { fullName?: string; email?: string };
      businessInformation?: { legalName?: string };
      userId?: { name?: string; email?: string };
    };
    adminId?: { name?: string; email?: string };
  };
  const [data, setData] = useState<ListResponse<ReviewHistoryItem>>({ items: [], total: 0, page: 1, pages: 1 });
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [range, setRange] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.get<ListResponse<ReviewHistoryItem>>("/admin/reviews", {
      params: {
        page,
        limit: 10,
        search: search || undefined,
        action: action || undefined,
        range: range || undefined,
      },
    })
      .then(({ data: result }) => { if (active) setData(result); })
      .catch((issue) => { if (active) setError(getError(issue)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [action, page, range, search]);
  return <><PageHeading eyebrow="ADMIN WORKSPACE" title="Review history" description="Search and filter administrator decisions, notes, and status changes." />
    {error && <div className="alert error"><AlertCircle size={16} />{error}</div>}
    <section className="panel table-panel"><div className="panel-head"><div><h2>Recorded review actions</h2><p className="muted">Filter by application, administrator, action, or date.</p></div></div>
      <div className="list-toolbar review-history-toolbar">
        <label className="searchbox"><Search size={16} /><input placeholder="Search application, customer, admin, or note…" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} /></label>
        <div className="review-history-filters">
          <label className="filter-select"><select aria-label="Filter by action" value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }}>
            <option value="">All actions</option><option>Review Started</option><option>Screening Run</option><option>Check Decision</option><option>Approved</option><option>Rejected</option><option>Correction Requested</option><option>Note Added</option>
          </select></label>
          <label className="filter-select"><select aria-label="Filter by date" value={range} onChange={(event) => { setRange(event.target.value); setPage(1); }}>
            <option value="">All time</option><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="90d">Last 90 days</option>
          </select></label>
        </div>
      </div>
      {loading ? <PageLoading label="Loading review history…" /> : data.items.length ? <>
        <div className="table-scroll"><table><thead><tr><th>Application</th><th>Customer</th><th>Action</th><th>Previous status</th><th>New status</th><th>Administrator</th><th>Date</th><th>Notes</th></tr></thead><tbody>
          {data.items.map((review) => {
            const customer = review.applicationId?.businessInformation?.legalName ?? review.applicationId?.personalInformation?.fullName ?? review.applicationId?.userId?.name ?? "—";
            return <tr key={review._id}>
              <td><button className="subtle-link" onClick={() => review.applicationId?._id && navigate(`/admin/review/${review.applicationId._id}`, { state: { from: "/admin/review-history" } })}>{review.applicationId?.applicationId ?? "Application"}</button></td>
              <td>{customer}</td><td>{review.action}</td><td>{review.previousStatus}</td><td>{review.newStatus}</td>
              <td>{review.adminId?.name ?? review.adminId?.email ?? "Administrator"}</td><td>{dateTimeLabel(review.createdAt)}</td><td>{review.comments || "—"}</td>
            </tr>;
          })}
        </tbody></table></div>
        <div className="pagination"><span>Showing {Math.min((page - 1) * 10 + 1, data.total)}–{Math.min(page * 10, data.total)} of {data.total}</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>Page {page} of {Math.max(data.pages, 1)}</span><button disabled={page >= data.pages} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div>
      </> : !error && <EmptyState icon={<Clock3 />} title="No matching review actions" text={search || action || range ? "Try changing or clearing the filters." : "Review actions will appear here when an application is opened or updated."} compact />}
    </section></>;
}

function Verification() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [files, setFiles] = useState<Array<{ file: File; category: string; uploaded: boolean }>>([]);
  const [draftId, setDraftId] = useState("");
  const [workflow, setWorkflow] = useState<"individual" | "business">("individual");
  const [documentCategory, setDocumentCategory] = useState("identity");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [businessInformation, setBusinessInformation] = useState({
    legalName: "",
    entityType: "",
    registrationType: "",
    registrationNumber: "",
    businessActivity: "",
    country: "India",
    registeredAddress: "",
    website: "",
  });
  const [form, setForm] = useState({
    fullName: "",
    dateOfBirth: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    address: "",
    nameOnDocument: "",
    documentType: "",
    documentReference: "",
    nationality: "",
  });
  const personalFields = useMemo(() => [
    { id: "fullName", label: "Full name", placeholder: "e.g. Alex Morgan" },
    { id: "dateOfBirth", label: "Date of birth", placeholder: "", type: "date" },
    { id: "email", label: "Email address", placeholder: "name@example.com", type: "email" },
    { id: "phone", label: "Phone number", placeholder: "+1-555-0100" },
    { id: "country", label: "Country", placeholder: "Country" },
    { id: "city", label: "City", placeholder: "City" },
    { id: "address", label: "Address", placeholder: "Street address" },
  ], []);
  const identityFields = useMemo(() => [
    { id: "nameOnDocument", label: "Name on document", placeholder: "Name as shown on document" },
    { id: "documentReference", label: "Document reference", placeholder: "Document number or reference" },
    { id: "nationality", label: "Nationality", placeholder: "Nationality" },
  ], []);
  const businessFields = useMemo(() => [
    { id: "legalName", label: "Registered legal name", required: true },
    { id: "entityType", label: "Entity type", required: true },
    { id: "registrationType", label: "Registration identifier type", required: true },
    { id: "registrationNumber", label: "Registration number", required: true },
    { id: "businessActivity", label: "What does the business do?", required: true },
    { id: "country", label: "Country of registration", required: true },
    { id: "registeredAddress", label: "Registered address", required: true },
    { id: "website", label: "Website (optional)", required: false },
  ], []);
  const [confirmation, setConfirmation] = useState(false);
  useEffect(() => {
    api.get<ListResponse<Application>>("/applications/my")
      .then(({ data }) => {
        const draft = data.items.find((item) =>
          ["Draft", "Correction Required"].includes(item.status ?? ""),
        );
        if (!draft) return;
        setDraftId(draft.id ?? draft._id ?? "");
        setWorkflow(draft.workflow === "business" ? "business" : "individual");
        setForm((current) => ({
          ...current,
          fullName: draft.personalInformation?.fullName ?? current.fullName,
          dateOfBirth: draft.personalInformation?.dateOfBirth ?? current.dateOfBirth,
          email: draft.personalInformation?.email ?? current.email,
          phone: draft.personalInformation?.phone ?? current.phone,
          country: draft.personalInformation?.country ?? current.country,
          city: draft.personalInformation?.city ?? current.city,
          address: draft.personalInformation?.address ?? current.address,
          nameOnDocument: draft.identityInformation?.nameOnDocument ?? current.nameOnDocument,
          documentType: draft.identityInformation?.documentType ?? current.documentType,
          documentReference: draft.identityInformation?.documentReference ?? current.documentReference,
          nationality: draft.identityInformation?.nationality ?? current.nationality,
        }));
        setBusinessInformation((current) => ({ ...current, ...draft.businessInformation }));
      })
      .catch((issue) => setError(getError(issue)));
  }, []);
  const validateStep = () => {
    if (step === 0) {
      const missing = personalFields.some((field) => !form[field.id as keyof typeof form].trim());
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      const missingBusiness = workflow === "business" && businessFields.some((field) =>
        field.required && !businessInformation[field.id as keyof typeof businessInformation].trim(),
      );
      setError(missing || missingBusiness ? "Complete the required applicant and business details before continuing." : !validEmail ? "Enter a valid email address." : "");
      return !missing && !missingBusiness && validEmail;
    }
    const missing = identityFields.some((field) => !form[field.id as keyof typeof form].trim()) || !form.documentType;
    setError(missing ? "Complete every identity field before continuing." : "");
    return !missing;
  };
  const submit = async () => {
    if (!confirmation) { setError("Confirm that you are authorized to submit this information."); return; }
    setBusy(true); setError("");
    try {
      let id = draftId;
      if (!id) {
        const { data } = await api.post<{ application: Application }>("/applications", {
          submissionMode: "standard",
          workflow,
          businessInformation,
          personalInformation: {
            fullName: form.fullName,
            dateOfBirth: form.dateOfBirth,
            email: form.email,
            phone: form.phone,
            country: form.country,
            city: form.city,
            address: form.address,
          },
          identityInformation: {
            nameOnDocument: form.nameOnDocument,
            documentType: form.documentType,
            documentReference: form.documentReference,
            nationality: form.nationality,
          },
        });
        id = data.application.id ?? data.application._id ?? "";
        if (!id) throw new Error("The API did not return an application identifier.");
        setDraftId(id);
      } else {
        await api.put(`/applications/${id}`, {
          submissionMode: "standard",
          workflow,
          businessInformation,
          personalInformation: {
            fullName: form.fullName,
            dateOfBirth: form.dateOfBirth,
            email: form.email,
            phone: form.phone,
            country: form.country,
            city: form.city,
            address: form.address,
          },
          identityInformation: {
            nameOnDocument: form.nameOnDocument,
            documentType: form.documentType,
            documentReference: form.documentReference,
            nationality: form.nationality,
          },
        });
      }

      for (let index = 0; index < files.length; index += 1) {
        if (files[index].uploaded) continue;
        const body = new FormData();
        body.append("file", files[index].file);
        body.append("applicationId", id);
        body.append("documentType", files[index].category);
        await api.post("/documents/upload", body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setFiles((current) => current.map((item, fileIndex) =>
          fileIndex === index ? { ...item, uploaded: true } : item,
        ));
      }
      await api.post(`/applications/${id}/submit`);
      setDone(true);
    } catch (issue) { setError(getError(issue)); }
    finally { setBusy(false); }
  };
  if (done) return <><PageHeading eyebrow="SIMULATED VERIFICATION" title="Submission received" description="Your information was submitted for review. Identity checks are simulated and do not verify a real identity." /><section className="panel success-panel"><span className="success-mark"><CheckCircle2 size={30} /></span><h2>You're all set</h2><p className="muted">You can review your application status in verification history.</p><Link className="button primary" to="/app/history">View verification history <ArrowRight size={16} /></Link></section></>;
  return <>
    <PageHeading eyebrow="CUSTOMER DUE DILIGENCE" title="Compliance application" description="Submit an individual or business profile for a structured, simulated review." />
    <div className="callout demo-callout"><ShieldAlert size={18} /><span><b>Simulation only.</b> This demo compares submitted text and document categories. It does not authenticate documents, search sanctions or PEP lists, query registries, or determine whether an activity is legal.</span></div>
    <section className="panel wizard-panel">
      <div className="wizard-progress">{["Personal details", "Identity details", "Review"].map((name, index) => <div key={name} className={`wizard-stage ${step === index ? "current" : ""} ${step > index ? "completed" : ""}`}><span>{step > index ? <Check size={14} /> : index + 1}</span><b>{name}</b></div>)}</div>
      <div className="wizard-body">
        {step < 2 ? <>
          <h2>{step === 0 ? (workflow === "business" ? "Business and representative" : "Individual profile") : "Identity and documents"}</h2><p className="muted">{step === 0 ? "Choose an applicant type and provide the relevant profile details." : "Provide identity details and categorize every uploaded document."}</p>
          {step === 0 && <label className="applicant-type">Applicant type<select value={workflow} onChange={(event) => setWorkflow(event.target.value === "business" ? "business" : "individual")}><option value="individual">Individual</option><option value="business">Business</option></select></label>}
          <div className="form-grid">{(step === 0 ? personalFields : identityFields).map((field) => <label key={field.id}>{step === 0 && workflow === "business" && field.id === "fullName" ? "Authorized representative full name" : field.label}<input type={field.id === "dateOfBirth" ? "date" : field.id === "email" ? "email" : "text"} value={form[field.id as keyof typeof form]} placeholder={field.placeholder} onChange={(e) => setForm({ ...form, [field.id]: e.target.value })} /></label>)}{step === 1 && <label>Document type<select value={form.documentType} onChange={(e) => setForm({ ...form, documentType: e.target.value })}><option value="">Choose a document type</option><option value="aadhaar">Aadhaar (demo only)</option><option value="pan">PAN (demo only)</option><option value="passport">Passport</option><option value="national-id">National ID</option><option value="voter-id">Voter ID</option><option value="driver-license">Driver license</option></select></label>}</div>
          {step === 0 && workflow === "business" && <><h3 className="section-subheading">Business profile</h3><div className="form-grid">{businessFields.map((field) => <label key={field.id}>{field.label}{field.id === "registrationType" ? <select required value={businessInformation.registrationType} onChange={(event) => setBusinessInformation((current) => ({ ...current, registrationType: event.target.value }))}><option value="">Choose identifier type</option><option value="CIN">CIN</option><option value="LLPIN">LLPIN</option><option value="GSTIN">GSTIN</option><option value="Udyam">Udyam registration</option><option value="Other">Other / not applicable</option></select> : field.id === "entityType" ? <select required value={businessInformation.entityType} onChange={(event) => setBusinessInformation((current) => ({ ...current, entityType: event.target.value }))}><option value="">Choose entity type</option>{businessEntityTypes.map((entityType) => <option value={entityType} key={entityType}>{entityType}</option>)}</select> : <input required={field.required} value={businessInformation[field.id as keyof typeof businessInformation]} onChange={(event) => setBusinessInformation((current) => ({ ...current, [field.id]: event.target.value }))} />}</label>)}</div></>}
          {step === 1 && <div className="upload-zone"><UploadCloud size={24} /><b>Upload documents</b><p>Private authenticated storage. PDF/JPEG/PNG up to 5 MB. Assign the correct category to each file; contents are not automatically verified.</p><label className="filter-select document-category">Category<select value={documentCategory} onChange={(event) => setDocumentCategory(event.target.value)}><option value="identity">Identity document</option><option value="address-proof">Address proof</option><option value="business-registration">Business registration</option><option value="supporting">Supporting document</option></select></label><label className="button secondary file-button">Choose files<input type="file" accept="application/pdf,image/jpeg,image/png" multiple onChange={(e) => { const selected = Array.from(e.target.files ?? []); const valid = selected.every((file) => file.size <= 5 * 1024 * 1024 && ["application/pdf", "image/jpeg", "image/png"].includes(file.type)); if (!valid) { setError("Only PDF, JPEG, or PNG files up to 5 MB are supported."); return; } setFiles((current) => [...current, ...selected.map((file) => ({ file, category: documentCategory, uploaded: false }))]); setError(""); e.currentTarget.value = ""; }} /></label>{files.map(({ file, category, uploaded }, index) => <div className="file-row" key={`${file.name}-${file.size}-${index}`}><FilePreview file={file} /><span className="file-name">{file.name} · {category}{uploaded ? " · Uploaded" : ""}</span><span>{(file.size / 1024).toFixed(0)} KB</span><button className="icon-btn" disabled={busy || uploaded} onClick={() => setFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} aria-label={`Remove ${file.name}`}><X size={15} /></button></div>)}</div>}
        </> : <><h2>Review your submission</h2><p className="muted">Check the applicant, business profile, and document categories before sending them for review.</p><div className="review-summary">{[...personalFields, ...identityFields, { id: "documentType", label: "Document type" }].map((field) => <div key={field.id}><small>{field.id === "fullName" && workflow === "business" ? "Representative name" : field.label}</small><b>{form[field.id as keyof typeof form] || "—"}</b></div>)}{workflow === "business" && businessFields.map((field) => <div key={field.id}><small>{field.label}</small><b>{businessInformation[field.id as keyof typeof businessInformation] || "—"}</b></div>)}<div><small>Files</small><b>{files.length ? files.map((item) => `${item.file.name} (${item.category})`).join(", ") : "None"}</b></div></div><label className="checkbox-row"><input type="checkbox" checked={confirmation} onChange={(e) => setConfirmation(e.target.checked)} /><span>I confirm that I am authorized to submit this information and these documents. I understand that provider checks are simulated and do not establish identity, legal status, or lawful activity.</span></label></>}
        {error && <div className="alert error"><AlertCircle size={16} />{error}</div>}
        <div className="wizard-actions">{step > 0 && <button className="button secondary" onClick={() => { setError(""); setStep(step - 1); }}><ArrowLeft size={16} /> Back</button>}{step < 2 ? <button className="button primary" onClick={() => { if (validateStep()) setStep(step + 1); }}>Continue <ArrowRight size={16} /></button> : <button disabled={busy} className="button primary" onClick={submit}>{busy ? "Submitting…" : "Submit application"} <ArrowRight size={16} /></button>}</div>
      </div>
    </section>
  </>;
}

function Documents() {
  const [documents, setDocuments] = useState<DemoDocument[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [applicationWorkflow, setApplicationWorkflow] = useState<"individual" | "business">("individual");
  const [businessEntityType, setBusinessEntityType] = useState("");
  const [hasEditableApplication, setHasEditableApplication] = useState(false);
  const [documentType, setDocumentType] = useState("identity");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function reload() {
    const [documentResponse, applicationResponse] = await Promise.all([
      api.get<{ items: DemoDocument[] }>("/documents/my"),
      api.get<ListResponse<Application>>("/applications/my"),
    ]);
    setDocuments(documentResponse.data.items ?? []);
    const editable = applicationResponse.data.items.find((item) =>
      ["Draft", "Correction Required"].includes(item.status ?? ""),
    );
    setApplicationId(editable?.id ?? editable?._id ?? "");
    setHasEditableApplication(Boolean(editable));
    setApplicationWorkflow(editable?.workflow === "business" ? "business" : "individual");
    setBusinessEntityType(editable?.businessInformation?.entityType ?? "");
  }
  useEffect(() => {
    reload().catch((issue) => setError(getError(issue))).finally(() => setLoading(false));
  }, []);

  async function choose(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!documentType || (applicationWorkflow === "business" && !businessEntityType)) {
      setError("Choose the applicant and business type, then select a matching document category.");
      input.value = "";
      return;
    }
    if (
      file.size > 5 * 1024 * 1024 ||
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type)
    ) {
      setError("Only PDF, JPEG, or PNG files up to 5 MB are supported.");
      input.value = "";
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");
    try {
      let targetId = applicationId;
      if (!targetId) {
        const { data } = await api.post<{ application: Application }>("/applications", {
          submissionMode: "standard",
          workflow: applicationWorkflow,
          ...(applicationWorkflow === "business"
            ? { businessInformation: { country: "India", entityType: businessEntityType } }
            : {}),
        });
        targetId = data.application.id ?? data.application._id ?? "";
        if (!targetId) throw new Error("The API did not return an application identifier.");
        setApplicationId(targetId);
        setHasEditableApplication(true);
      } else {
        await api.put(`/applications/${targetId}`, {
          submissionMode: "standard",
          ...(applicationWorkflow === "business"
            ? { workflow: "business", businessInformation: { entityType: businessEntityType } }
            : {}),
        });
      }
      const body = new FormData();
      body.append("file", file);
      body.append("applicationId", targetId);
      body.append("documentType", documentType);
      await api.post("/documents/upload", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await reload();
      setSuccess("Private document uploaded.");
    } catch (issue) {
      setError(getError(issue));
    } finally {
      setBusy(false);
      input.value = "";
    }
  }

  async function removeDocument(document: DemoDocument) {
    const id = document._id ?? document.id;
    if (!id) return;
    setError("");
    try {
      await api.delete(`/documents/${id}`);
      setDocuments((items) => items.filter((item) => (item._id ?? item.id) !== id));
    } catch (issue) {
      setError(getError(issue));
    }
  }

  async function download(document: DemoDocument) {
    const id = document._id ?? document.id;
    if (!id) return;
    setError("");
    try {
      await downloadPrivateDocument(id, document.originalName);
    } catch (issue) {
      setError(getError(issue));
    }
  }

  const availableCategories = getDocumentCategories(applicationWorkflow, businessEntityType);
  return <><PageHeading eyebrow="YOUR WORKSPACE" title="My documents" description="Manage documents for an individual or business application." />
    <div className="callout demo-callout"><ShieldAlert size={18} /><span><b>Private uploads; simulated checks.</b> Documents are not authenticated. The demo compares submitted text and categories only; sanctions/PEP, registry, and legal-activity sources are not connected.</span></div>
    <section className="panel"><div className="panel-head"><div><h2>Document library</h2><p className="muted">Private uploads · accessible only to your account and authorized reviewers</p></div></div>
      {hasEditableApplication
        ? <p className="muted document-workflow">Attached to your {applicationWorkflow} application. <Link to="/app/verification">Edit application details</Link></p>
        : <label className="filter-select document-category">Applicant type<select disabled={busy || loading} value={applicationWorkflow} onChange={(event) => { const workflow = event.target.value === "business" ? "business" : "individual"; setApplicationWorkflow(workflow); setBusinessEntityType(""); setDocumentType(workflow === "business" ? "" : "identity"); }}><option value="individual">Individual</option><option value="business">Business</option></select></label>}
      {applicationWorkflow === "business" && <label className="filter-select document-category">Business type<select disabled={busy || loading || (hasEditableApplication && Boolean(businessEntityType))} value={businessEntityType} onChange={(event) => { setBusinessEntityType(event.target.value); setDocumentType(event.target.value ? "identity" : ""); }}><option value="">Choose business type</option>{businessEntityTypes.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}</select></label>}
      <label className="filter-select document-category">Document category<select disabled={busy || loading || !availableCategories.length} value={documentType} onChange={(event) => setDocumentType(event.target.value)}>{availableCategories.length ? availableCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>) : <option value="">Choose a business type first</option>}</select></label>
      <label className="upload-zone document-upload"><UploadCloud size={25} /><b>{loading ? "Loading application…" : busy ? "Uploading securely…" : "Choose a document"}</b><p>{applicationWorkflow === "business" ? businessEntityType ? `Choose evidence relevant to a ${businessEntityType}.` : "Select your business type to see the relevant document categories." : "Choose identity or address evidence."} PDF, JPEG or PNG · Up to 5 MB. File contents are not automatically verified.</p><span className="button secondary">{busy ? "Uploading…" : "Choose file"}<input type="file" disabled={busy || loading || !availableCategories.length || !documentType} accept="application/pdf,image/jpeg,image/png" onChange={choose} /></span></label>
      {error && <div className="alert error"><AlertCircle size={16} />{error}</div>}{success && <div className="alert success"><CheckCircle2 size={16} />{success}</div>}
      {loading ? <PageLoading label="Loading your private documents…" /> : documents.length ? <div className="document-list">{documents.map((document) => {
        const id = document._id ?? document.id ?? document.originalName;
        const categoryLabel = availableCategories.find(([value]) => value === document.documentType)?.[1]
          ?? documentCategories.find(([value]) => value === document.documentType)?.[1]
          ?? document.documentType;
        return <div className="document-row" key={id}><span className="file-icon"><FileText size={16} /></span><span className="document-info"><b>{document.originalName}</b><small>{categoryLabel} · {(document.size / 1024).toFixed(0)} KB · {dateLabel(document.createdAt)}</small></span><span className={statusClass(document.reviewStatus)}>{document.reviewStatus}</span><button className="button secondary" onClick={() => void download(document)}>Download</button><button className="icon-btn" onClick={() => void removeDocument(document)} aria-label={`Delete ${document.originalName}`}><X size={17} /></button></div>;
      })}</div> : <EmptyState icon={<FileText />} title="No documents yet" text="Upload a document to attach it to a draft application." compact />}
    </section></>;
}

async function downloadPrivateDocument(id: string, originalName: string) {
  const { data } = await api.get<Blob>(`/documents/${id}`, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = originalName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function FilePreview({ file }: { file: File }) {
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) { setPreview(""); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return preview ? <img className="file-preview" src={preview} alt={`Local preview of ${file.name}`} /> : <FileText size={16} />;
}

function History() {
  const [items, setItems] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { api.get<ListResponse<Application>>("/applications/my").then(({ data }) => setItems(data.items ?? [])).catch((issue) => setError(getError(issue))).finally(() => setLoading(false)); }, []);
  return <><PageHeading eyebrow="YOUR WORKSPACE" title="Verification history" description="Review your submitted applications and their current status." />{error && <div className="alert error"><AlertCircle size={16} />{error}<span className="alert-extra">History is currently unavailable. Your applications may appear after the applications API is enabled.</span></div>}<section className="panel table-panel"><div className="panel-head"><div><h2>Past submissions</h2><p className="muted">Your application records</p></div></div>{loading ? <PageLoading label="Loading history…" /> : items.length ? <ApplicationTable rows={items} /> : !error ? <EmptyState icon={<Clock3 />} title="No submissions yet" text="Your submitted applications will be listed here." action={<Link className="button secondary" to="/app/verification">Start verification</Link>} /> : <EmptyState icon={<Clock3 />} title="History unavailable" text="Try again when the applications service is available." />}</section></>;
}

function RiskExplanation() {
  type RiskAssessment = {
    applicationId: string;
    workflow?: "individual" | "business";
    businessName?: string;
    status: string;
    submittedAt: string;
    score: number;
    category: string;
    factors: Array<{
      code: "personal-information" | "identity-information" | "name-match" | "address-proof" | "business-information";
      label: string;
      points: number;
      checked: boolean;
      applied: boolean;
      explanation: string;
      missingFields?: string[];
    }>;
    reasons: string[];
    suggestedActions: string[];
    disclaimer: string;
  };
  const [items, setItems] = useState<RiskAssessment[]>([]);
  const [selectedApplicationId, setSelectedApplicationId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.get<{ items: RiskAssessment[] }>("/risk/my")
      .then(({ data }) => setItems(data.items ?? []))
      .catch((issue) => setError(getError(issue)))
      .finally(() => setLoading(false));
  }, []);
  const result = items.find((item) => item.applicationId === selectedApplicationId) ?? items[0];
  const detailFactors = result?.factors.filter((factor) =>
    ["personal-information", "identity-information", "name-match", "business-information"].includes(factor.code) && factor.applied,
  ) ?? [];
  const needsAddressProof = result?.factors.some((factor) => factor.code === "address-proof" && factor.applied) ?? false;
  const canEdit = result?.status === "Correction Required";
  return <><PageHeading eyebrow="YOUR WORKSPACE" title="Risk explanation" description="See which application details affected the simulated score and what to do next." />
    {error && <div className="alert error"><AlertCircle size={16} />{error}</div>}
    {loading ? <PageLoading label="Loading your risk explanation…" /> : result ? <>
      {items.length > 1 && <label className="filter-select risk-application-select">Application<select value={result.applicationId} onChange={(event) => setSelectedApplicationId(event.target.value)}>{items.map((item) => <option key={item.applicationId} value={item.applicationId}>{item.applicationId} · {dateLabel(item.submittedAt)} · {item.status}</option>)}</select></label>}
      <section className="panel risk-score-panel">
        <div className="risk-score-heading"><span className="risk-large-icon"><ShieldCheck size={24} /></span><div><span className="pill neutral">SIMULATED SCORE</span><h2>{result.category} · {result.score}/100</h2><p className="muted">{result.applicationId} · {result.workflow === "business" ? `${result.businessName ?? "Business"} · Business` : "Individual"} · Submitted {dateTimeLabel(result.submittedAt)} · {result.status}</p></div></div>
        <div className="risk-meter" role="progressbar" aria-label="Risk score" aria-valuemin={0} aria-valuemax={100} aria-valuenow={result.score}><span style={{ width: `${result.score}%` }} /></div>
        <div className="risk-score-scale"><span>0</span><span>Low: 0–30</span><span>Medium: 31–60</span><span>High: 61–100</span><span>100</span></div>
        <p className="risk-disclaimer">{result.disclaimer}</p>
      </section>
      <div className="content-grid risk-explanation-grid">
        <section className="panel risk-factors-panel">
          <div className="panel-head"><div><h2>Score breakdown</h2><p className="muted">Every factor shows whether it added points.</p></div><b className="risk-total">Total: {result.score}/100</b></div>
          <div className="risk-factor-list">{result.factors.map((factor) => {
            const state = factor.applied ? "applied" : factor.checked ? "clear" : "pending";
            return <article className={`risk-factor ${state}`} key={factor.code}>
              <span className="risk-factor-icon">{factor.applied ? <AlertCircle size={17} /> : factor.checked ? <CheckCircle2 size={17} /> : <Clock3 size={17} />}</span>
              <div className="risk-factor-content"><div className="risk-factor-title"><b>{factor.label}</b><strong>{factor.applied ? `+${factor.points} points` : factor.checked ? "0 points" : "Not scored"}</strong></div><p>{factor.explanation}</p>{factor.missingFields?.length ? <small>Missing fields: {factor.missingFields.join(", ")}</small> : null}</div>
            </article>;
          })}</div>
        </section>
        <section className="panel risk-next-steps">
          <h2>How to improve this score</h2>
          {canEdit ? <>
            <p className="muted">This application was returned for corrections. Update the flagged details and resubmit it for a refreshed score.</p>
            {detailFactors.length > 0 && <Link className="button secondary" to="/app/verification"><FileCheck2 size={16} /> Update application details</Link>}
            {needsAddressProof && <Link className="button secondary" to="/app/documents"><UploadCloud size={16} /> Add address proof</Link>}
            {detailFactors.length === 0 && !needsAddressProof && <p className="muted">The administrator may have requested a correction that is not covered by these scoring rules. Check your application history for their note.</p>}
            <Link className="button secondary" to="/app/history">View application history <ArrowRight size={16} /></Link>
          </> : result.score === 0 ? <p className="muted">No changes are indicated by these rules. An administrator may still review the application.</p> : <>
            <p className="muted">This application is {result.status.toLowerCase()} and cannot be edited right now. If the administrator requests changes, its status will become “Correction Required”; you can then update the details or documents and resubmit.</p>
            <Link className="button secondary" to="/app/history">View application history <ArrowRight size={16} /></Link>
          </>}
        </section>
      </div>
      <section className="panel risk-method-panel"><h2>How the score is calculated</h2><p className="muted paragraph">The score adds the points shown in the breakdown. Individual applications use incomplete personal information (25), incomplete identity information (25), a name mismatch (30), and missing address proof (20). Business applications also score representative information (15), identity information (25), name mismatch (20), missing address proof (15), and incomplete business information (25). The factors are capped at 100. This is an illustrative score only—not identity verification, fraud detection, sanctions screening, registry checks, or a legal-activity assessment.</p></section>
    </> : !error && <section className="panel"><EmptyState icon={<Gauge />} title="No submitted application to assess" text="Submit your verification first. A score and factor-by-factor explanation will appear here afterward." action={<Link className="button primary" to="/app/verification">Start verification</Link>} /></section>}
  </>;
}

function SettingsPage() {
  const { user, profilePhotoUrl, profilePhotoError, refreshProfilePhoto, signOut } = useAuth();
  const photoRequired = user?.role !== "admin";
  const [saved, setSaved] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  async function uploadProfilePhoto(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setPhotoError("Choose a JPEG or PNG image up to 5 MB.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setPhotoError("");
    setUploadingPhoto(true);
    try {
      await api.put("/profile/photo", body, { headers: { "Content-Type": "multipart/form-data" } });
      await refreshProfilePhoto();
      setSaved(false);
    } catch (issue) {
      setPhotoError(getError(issue));
    } finally {
      setUploadingPhoto(false);
    }
  }
  return <><PageHeading eyebrow="WORKSPACE" title="Settings" description="Manage your account preferences." /><section className="panel settings-panel"><div className="settings-title"><span className="stat-icon blue"><UserRound /></span><div><h2>Account information</h2><p className="muted">Your registered account details</p></div></div><div className="profile-photo-setting"><span className="profile-photo-preview">{profilePhotoUrl ? <img src={profilePhotoUrl} alt="Your profile" /> : <UserRound size={25} />}</span><div className="profile-photo-controls"><b>Profile photo <span className={photoRequired ? "required-label" : "muted"}>{photoRequired ? "Required" : "Optional"}</span></b><p className="muted">Upload a JPEG or PNG image, up to 5 MB.</p><label className="button secondary profile-photo-button">{uploadingPhoto ? "Uploading…" : profilePhotoUrl ? "Change photo" : "Upload photo"}<input type="file" accept="image/jpeg,image/png" disabled={uploadingPhoto} onChange={(event) => { void uploadProfilePhoto(event.target.files?.[0]); event.currentTarget.value = ""; }} /></label>{!profilePhotoUrl && photoRequired && <small className="field-error">A profile photo is required to access the workspace.</small>}{(photoError || profilePhotoError) && <small className="field-error">{photoError || profilePhotoError}</small>}</div></div><div className="settings-row"><span>Email address</span><b>{user?.email ?? "—"}</b></div><div className="settings-row"><span>Workspace role</span><b>{user?.role === "admin" ? "Administrator" : "Customer"}</b></div><div className="settings-row"><span>Session security</span><b><LockKeyhole size={14} /> JWT authenticated</b></div><div className="settings-actions"><button className="button secondary" disabled={!profilePhotoUrl} onClick={() => { setSaved(true); window.setTimeout(() => setSaved(false), 2500); }}>{saved ? <><Check size={15} /> Preferences saved</> : "Save preferences"}</button><button className="button danger-outline" onClick={signOut}><LogOut size={15} /> Sign out</button></div></section></>;
}

function EmptyState({ icon, title, text, action, compact = false }: { icon?: ReactNode; title: string; text: string; action?: ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? "compact" : ""}`}>{icon && <span className="empty-icon">{icon}</span>}<b>{title}</b><p>{text}</p>{action}</div>;
}
function PageLoading({ label }: { label: string }) { return <div className="loading-inline"><span className="spinner" />{label}</div>; }

export default App;
