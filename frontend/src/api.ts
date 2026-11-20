import axios from "axios";

export interface ApiClientOptions {
  baseURL?: string;
  getAccessToken?: () => string | null | Promise<string | null>;
}

export function createApiClient(options: ApiClientOptions = {}) {
  // Resolve the API base URL. When deployed on Vercel multi-service,
  // the frontend<->backend binding injects VITE_API_BASE_URL with the
  // backend's internal URL. Browser-based calls go through the /api/*
  // rewrite to the same origin, so a relative/empty baseURL also works.
  const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
  const resolvedBaseUrl =
    options.baseURL ??
    (envBaseUrl
      ? (() => {
          const normalized = envBaseUrl.replace(/\/+$/, "");
          return normalized.endsWith("/api") ? normalized : normalized + "/api";
        })()
      : undefined);

  const client = axios.create({
    baseURL: resolvedBaseUrl,
    headers: { "Content-Type": "application/json" },
  });

  client.interceptors.request.use(async (config) => {
    const token = options.getAccessToken
      ? await options.getAccessToken()
      : typeof localStorage === "undefined"
        ? null
        : localStorage.getItem("clearcheck_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  return client;
}

export const api = createApiClient();

export interface User {
  id: string;
  email: string;
  role?: "user" | "admin";
  name?: string;
}

export interface Application {
  id?: string;
  _id?: string;
  submissionMode?: "standard" | "demo" | "real";
  workflow?: "individual" | "business";
  name?: string;
  email?: string;
  status?: string;
  applicationId?: string;
  riskScore?: number;
  riskCategory?: string;
  personalInformation?: {
    fullName?: string;
    email?: string;
    phone?: string;
    dateOfBirth?: string;
    country?: string;
    city?: string;
    address?: string;
  };
  identityInformation?: {
    nameOnDocument?: string;
    documentType?: string;
    documentReference?: string;
    nationality?: string;
  };
  businessInformation?: {
    legalName?: string;
    entityType?: string;
    registrationType?: string;
    registrationNumber?: string;
    businessActivity?: string;
    country?: string;
    registeredAddress?: string;
    website?: string;
  };
  screeningRuns?: ScreeningRun[];
  userId?: string | { name?: string; email?: string };
  riskLevel?: string;
  submittedAt?: string;
  createdAt?: string;
  statusChangedAt?: string;
  adminViewedAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ScreeningRun {
  _id: string;
  provider: "Provider Alpha" | "Provider Beta" | "Provider Gamma";
  outcome: "completed" | "timeout" | "manual-review";
  simulated: boolean;
  checks: Array<{
    _id: string;
    code: string;
    label: string;
    status: "clear" | "review" | "not-connected" | "inconclusive";
    details: string;
    reviewerDecision?: "accepted" | "flagged" | "needs-information";
    reviewerNote?: string;
    reviewedAt?: string;
  }>;
  createdAt: string;
}

export interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  latestApplication?: {
    personalInformation?: Application["personalInformation"];
    identityInformation?: Application["identityInformation"];
  } | null;
}

export interface DemoDocument {
  id: string;
  _id?: string;
  originalName: string;
  documentType: string;
  mimeType?: string;
  size: number;
  reviewStatus: string;
  createdAt: string;
}

export interface ListResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
}

export interface AdminDashboard {
  stats: Record<string, number>;
  recentApplications: Application[];
}

export type AdminReportRange = "3d" | "7d" | "30d" | "90d" | "12m";

export interface AdminReport {
  range: AdminReportRange;
  period: { start: string; end: string };
  summary: {
    applicationsSubmitted: number;
    newCustomers: number;
    approved: number;
    rejected: number;
    awaitingReview: number;
    averageRiskScore: number;
  };
  trends: Array<Record<string, string | number>>;
  outcomes: Array<Record<string, string | number>>;
  registrations: Array<Record<string, string | number>>;
  riskDistribution: Array<Record<string, string | number>>;
}
