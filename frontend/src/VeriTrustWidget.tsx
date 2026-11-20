import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { isAxiosError } from "axios";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText, ShieldCheck, UploadCloud, X } from "lucide-react";
import { createApiClient, type Application, type ListResponse } from "./api";
import "./VeriTrustWidget.css";

export type VeriTrustStep = "personal" | "identity" | "documents" | "review";
export type VeriTrustDocumentCategory = "identity" | "address-proof" | "supporting";

export interface VeriTrustWidgetProps {
  workflow?: "individual";
  theme?: "light" | "dark";
  apiBaseUrl?: string;
  accessToken?: string;
  branding?: {
    name?: string;
    logoUrl?: string;
    primaryColor?: string;
  };
  steps?: readonly VeriTrustStep[];
  stepLabels?: Partial<Record<VeriTrustStep, string>>;
  resumeDraft?: boolean;
  className?: string;
  onSuccess?: (result: { applicationId: string; status: string }) => void;
  onError?: (error: Error) => void;
}

interface WidgetForm {
  fullName: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  address: string;
  nameOnDocument: string;
  documentType: string;
  documentReference: string;
  nationality: string;
}

interface WidgetDocument {
  id: string;
  file: File;
  category: VeriTrustDocumentCategory;
  uploaded: boolean;
}

const defaultSteps: VeriTrustStep[] = ["personal", "identity", "documents", "review"];
const requiredSteps: VeriTrustStep[] = ["personal", "identity", "review"];
const defaultStepLabels: Record<VeriTrustStep, string> = {
  personal: "Personal details",
  identity: "Identity details",
  documents: "Documents",
  review: "Review",
};
const initialForm: WidgetForm = {
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
};
const personalFields: Array<{ id: keyof WidgetForm; label: string; type?: string; placeholder?: string }> = [
  { id: "fullName", label: "Full name", placeholder: "e.g. Alex Morgan" },
  { id: "dateOfBirth", label: "Date of birth", type: "date" },
  { id: "email", label: "Email address", type: "email", placeholder: "name@example.com" },
  { id: "phone", label: "Phone number", placeholder: "+1-555-0100" },
  { id: "country", label: "Country", placeholder: "Country" },
  { id: "city", label: "City", placeholder: "City" },
  { id: "address", label: "Address", placeholder: "Street address" },
];
const identityFields: Array<{ id: keyof WidgetForm; label: string; placeholder?: string }> = [
  { id: "nameOnDocument", label: "Name on document", placeholder: "Name as shown on document" },
  { id: "documentReference", label: "Document reference", placeholder: "Document number or reference" },
  { id: "nationality", label: "Nationality", placeholder: "Nationality" },
];
const documentTypeLabels: Record<string, string> = {
  passport: "Passport",
  "national-id": "National ID",
  "driver-license": "Driver license",
};
const categoryLabels: Record<VeriTrustDocumentCategory, string> = {
  identity: "Identity document",
  "address-proof": "Address proof",
  supporting: "Supporting document",
};

function toError(issue: unknown): Error {
  if (isAxiosError(issue)) {
    const body: unknown = issue.response?.data;
    if (typeof body === "object" && body !== null && "message" in body && typeof body.message === "string") {
      return new Error(body.message);
    }
    return new Error(issue.message || "The verification request failed.");
  }
  return issue instanceof Error ? issue : new Error("The verification request failed.");
}

function getApplicationObjectId(application: Application) {
  return application.id ?? application._id ?? "";
}

function isDocumentCategory(value: string): value is VeriTrustDocumentCategory {
  return value === "identity" || value === "address-proof" || value === "supporting";
}

function ImagePreview({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState("");
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return previewUrl
    ? <img className="vt-file-preview" src={previewUrl} alt={`Preview of ${file.name}`} />
    : <span className="vt-file-preview vt-file-generic"><FileText size={17} /></span>;
}

export function VeriTrustWidget({
  workflow = "individual",
  theme = "light",
  apiBaseUrl,
  accessToken,
  branding,
  steps,
  stepLabels,
  resumeDraft = false,
  className = "",
  onSuccess,
  onError,
}: VeriTrustWidgetProps) {
  const configuredSteps = steps ?? defaultSteps;
  const hasDuplicateSteps = new Set(configuredSteps).size !== configuredSteps.length;
  const hasRequiredSteps = requiredSteps.every((step) => configuredSteps.includes(step));
  const stepsAreValid = !hasDuplicateSteps && hasRequiredSteps && configuredSteps.length > 0;
  const activeSteps = stepsAreValid ? configuredSteps : defaultSteps;
  const labels = { ...defaultStepLabels, ...stepLabels };
  const client = useMemo(() => createApiClient({
    baseURL: apiBaseUrl,
    getAccessToken: () => accessToken ?? (typeof localStorage === "undefined" ? null : localStorage.getItem("clearcheck_token")),
  }), [accessToken, apiBaseUrl]);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  const [form, setForm] = useState<WidgetForm>(initialForm);
  const [documents, setDocuments] = useState<WidgetDocument[]>([]);
  const [documentCategory, setDocumentCategory] = useState<VeriTrustDocumentCategory>("identity");
  const [applicationObjectId, setApplicationObjectId] = useState("");
  const [applicationReference, setApplicationReference] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [confirmation, setConfirmation] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(resumeDraft);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ applicationId: string; status: string } | null>(null);
  const fileId = useRef(0);
  const widgetStyle: CSSProperties & { "--vt-primary": string } = {
    "--vt-primary": branding?.primaryColor ?? "#5369d0",
  };

  const reportError = useCallback((issue: unknown) => {
    const nextError = toError(issue);
    setError(nextError.message);
    onErrorRef.current?.(nextError);
  }, []);

  useEffect(() => {
    if (!resumeDraft) {
      setLoadingDraft(false);
      return;
    }
    setLoadingDraft(true);
    let active = true;
    client.get<ListResponse<Application>>("/applications/my")
      .then(({ data }) => {
        if (!active) return;
        const draft = data.items.find((item) => ["Draft", "Correction Required"].includes(item.status ?? ""));
        if (!draft) return;
        setApplicationObjectId(getApplicationObjectId(draft));
        setApplicationReference(draft.applicationId ?? "");
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
      })
      .catch((issue) => { if (active) reportError(issue); })
      .finally(() => { if (active) setLoadingDraft(false); });
    return () => { active = false; };
  }, [client, reportError, resumeDraft]);

  const currentStep = activeSteps[stepIndex] ?? activeSteps[0];
  const updateForm = (field: keyof WidgetForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };
  const validateStep = () => {
    if (currentStep === "personal") {
      const missing = personalFields.some((field) => !form[field.id].trim());
      const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
      if (missing) {
        reportError(new Error("Complete every personal detail before continuing."));
        return false;
      }
      if (!validEmail) {
        reportError(new Error("Enter a valid email address."));
        return false;
      }
    }
    if (currentStep === "identity") {
      const missing = identityFields.some((field) => !form[field.id].trim()) || !form.documentType;
      if (missing) {
        reportError(new Error("Complete every identity detail before continuing."));
        return false;
      }
    }
    setError("");
    return true;
  };
  const addDocuments = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.currentTarget.files ?? []);
    const validTypes = ["application/pdf", "image/jpeg", "image/png"];
    const invalid = selected.filter((file) => file.size > 5 * 1024 * 1024 || !validTypes.includes(file.type));
    if (invalid.length) reportError(new Error("Documents must be PDF, JPEG, or PNG files up to 5 MB."));
    const accepted = selected.filter((file) => file.size <= 5 * 1024 * 1024 && validTypes.includes(file.type));
    if (accepted.length) {
      setDocuments((current) => [
        ...current,
        ...accepted.map((file) => ({
          id: `${Date.now()}-${fileId.current++}`,
          file,
          category: documentCategory,
          uploaded: false,
        })),
      ]);
      if (!invalid.length) setError("");
    }
    event.currentTarget.value = "";
  };
  const removeDocument = (id: string) => {
    setDocuments((current) => current.filter((document) => document.id !== id || document.uploaded));
  };
  const submit = async () => {
    if (!confirmation) {
      reportError(new Error("Confirm that you are authorized to submit this information."));
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      let id = applicationObjectId;
      let publicId = applicationReference;
      const applicationData = {
        submissionMode: "standard",
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
      };
      if (!id) {
        const { data } = await client.post<{ application: Application }>("/applications", applicationData);
        id = getApplicationObjectId(data.application);
        publicId = data.application.applicationId ?? "";
        if (!id) throw new Error("The API did not return an application identifier.");
        setApplicationObjectId(id);
        setApplicationReference(publicId);
      } else {
        await client.put(`/applications/${id}`, applicationData);
      }

      for (const document of documents) {
        if (document.uploaded) continue;
        const body = new FormData();
        body.append("file", document.file);
        body.append("applicationId", id);
        body.append("documentType", document.category);
        await client.post("/documents/upload", body, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setDocuments((current) => current.map((item) =>
          item.id === document.id ? { ...item, uploaded: true } : item,
        ));
      }
      await client.post(`/applications/${id}/submit`);
      const result = { applicationId: publicId || id, status: "Submitted" };
      setApplicationReference(result.applicationId);
      setSuccess(result);
      try {
        onSuccess?.(result);
      } catch (callbackIssue) {
        reportError(callbackIssue);
      }
    } catch (issue) {
      reportError(issue);
    } finally {
      setBusy(false);
    }
  };

  const stepContent = () => {
    if (currentStep === "personal") {
      return <div className="vt-field-grid">{personalFields.map((field) => <label key={field.id}>{field.label}<input required type={field.type ?? "text"} value={form[field.id]} placeholder={field.placeholder} onChange={(event) => updateForm(field.id, event.target.value)} /></label>)}</div>;
    }
    if (currentStep === "identity") {
      return <div className="vt-field-grid">
        {identityFields.map((field) => <label key={field.id}>{field.label}<input required value={form[field.id]} placeholder={field.placeholder} onChange={(event) => updateForm(field.id, event.target.value)} /></label>)}
        <label>Document type<select required value={form.documentType} onChange={(event) => updateForm("documentType", event.target.value)}><option value="">Choose a document type</option>{Object.entries(documentTypeLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      </div>;
    }
    if (currentStep === "documents") {
      return <>
        <p className="vt-muted">Add identity or address documents. Files are private and limited to PDF, JPEG, or PNG up to 5 MB.</p>
        <label className="vt-category">Document category<select value={documentCategory} onChange={(event) => { if (isDocumentCategory(event.target.value)) setDocumentCategory(event.target.value); }}>{Object.entries(categoryLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label className="vt-upload"><UploadCloud size={22} /><b>Choose or capture documents</b><span>On supported phones, the camera can be used. You can also select files.</span><input type="file" accept="application/pdf,image/jpeg,image/png" capture="environment" multiple onChange={addDocuments} /></label>
        {documents.length > 0 && <div className="vt-documents">{documents.map((document) => <div className="vt-document" key={document.id}><ImagePreview file={document.file} /><span><b>{categoryLabels[document.category]}</b><small>{document.file.name} · {(document.file.size / 1024).toFixed(0)} KB {document.uploaded ? "· Uploaded" : ""}</small></span><button type="button" disabled={document.uploaded || busy} onClick={() => removeDocument(document.id)} aria-label={`Remove ${document.file.name}`}><X size={16} /></button></div>)}</div>}
      </>;
    }
    return <><div className="vt-review-grid">{[...personalFields, ...identityFields].map((field) => <div key={field.id}><small>{field.label}</small><b>{form[field.id] || "—"}</b></div>)}<div><small>Document type</small><b>{documentTypeLabels[form.documentType] ?? "—"}</b></div><div><small>Documents</small><b>{documents.length ? `${documents.length} selected` : "None"}</b></div></div><label className="vt-confirm"><input type="checkbox" checked={confirmation} onChange={(event) => setConfirmation(event.target.checked)} /><span>I am authorized to submit this information and these documents. I understand the identity checks are simulated.</span></label></>;
  };

  if (success) {
    return <section className={`veritrust-widget vt-theme-${theme} ${className}`} style={widgetStyle}>
      <header className="vt-brand"><Branding branding={branding} /></header>
      <div className="vt-success"><span><CheckCircle2 size={32} /></span><h2>Application submitted</h2><p>Your reference number is <b>{success.applicationId}</b>. You can use it to track this submission.</p><small>Identity checks are simulated and do not verify a real identity.</small></div>
    </section>;
  }

  return <section className={`veritrust-widget vt-theme-${theme} ${className}`} style={widgetStyle} data-workflow={workflow}>
    <header className="vt-brand"><Branding branding={branding} /><span className="vt-secure"><ShieldCheck size={15} /> Secure submission</span></header>
    {loadingDraft && <p className="vt-muted">Checking for a saved application…</p>}
    {!stepsAreValid && <div className="vt-message vt-message-error" role="alert">The configured steps must include personal details, identity details, and review exactly once. The default steps are shown instead.</div>}
    <p className="vt-intro">Complete the steps below. This workflow collects an individual application; verification checks are simulated.</p>
    <nav className="vt-progress" aria-label="Verification steps">{activeSteps.map((step, index) => <div className={`vt-progress-step ${index === stepIndex ? "active" : index < stepIndex ? "complete" : ""}`} key={step}><span>{index < stepIndex ? <CheckCircle2 size={15} /> : index + 1}</span><b>{labels[step]}</b></div>)}</nav>
    <div className="vt-body">
      <h2>{labels[currentStep]}</h2>
      {currentStep === "personal" && <p className="vt-muted">Enter the applicant’s contact and personal details.</p>}
      {currentStep === "identity" && <p className="vt-muted">Enter the identity-document details for this application.</p>}
      {currentStep === "documents" && <p className="vt-muted">Document upload is optional in this workflow.</p>}
      {currentStep === "review" && <p className="vt-muted">Review the information before submitting.</p>}
      {stepContent()}
      {error && <div className="vt-message vt-message-error" role="alert"><AlertCircle size={16} />{error}</div>}
      <footer className="vt-actions">
        {stepIndex > 0 && <button type="button" className="vt-button vt-secondary" disabled={busy} onClick={() => { setError(""); setStepIndex((index) => index - 1); }}><ArrowLeft size={16} /> Back</button>}
        {currentStep === "review"
          ? <button type="button" className="vt-button vt-primary" disabled={busy || loadingDraft} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit application"} <ArrowRight size={16} /></button>
          : <button type="button" className="vt-button vt-primary" disabled={busy || loadingDraft} onClick={() => { if (validateStep()) { setStepIndex((index) => Math.min(index + 1, activeSteps.length - 1)); setError(""); } }}>Continue <ArrowRight size={16} /></button>}
      </footer>
    </div>
  </section>;
}

function Branding({ branding }: { branding?: VeriTrustWidgetProps["branding"] }) {
  return <div className="vt-branding">{branding?.logoUrl ? <img src={branding.logoUrl} alt="" /> : <span className="vt-brand-mark"><ShieldCheck size={18} /></span>}<div><b>{branding?.name ?? "VeriTrust"}</b><small>Individual verification</small></div></div>;
}

export default VeriTrustWidget;
