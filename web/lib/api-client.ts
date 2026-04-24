import type {
  CreateTemplatePayload,
  DocumentResponse,
  DocumentSummary,
  ExtractedField,
  FieldCreate,
  FieldUpdate,
  SpeechToken,
  Template,
  TemplateApplyMode,
  TemplateSummary,
  UpdateTemplateRequest,
  VoiceFillRequest,
  VoiceFillResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5180";

export interface UploadOptions {
  /** Defaults server-side to `"auto"` when omitted. */
  templateMode?: TemplateApplyMode;
  /** Required when `templateMode === "manual"`. */
  templateId?: string;
}

export async function uploadDocument(
  file: File,
  options?: UploadOptions
): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.templateMode) {
    formData.append("templateMode", options.templateMode);
  }
  if (options?.templateId) {
    formData.append("templateId", options.templateId);
  }

  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Upload failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

export async function listDocuments(): Promise<DocumentSummary[]> {
  const res = await fetch(`${API_BASE}/api/documents`, { cache: "no-store" });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);
  return res.json();
}

export async function getDocument(id: string): Promise<DocumentResponse> {
  const res = await fetch(`${API_BASE}/api/documents/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  return res.json();
}

export function fileUrl(id: string): string {
  return `${API_BASE}/api/documents/${id}/file`;
}

export async function updateField(
  documentId: string,
  fieldId: string,
  update: FieldUpdate
): Promise<ExtractedField> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/fields/${fieldId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Update failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

export async function createField(
  documentId: string,
  payload: FieldCreate
): Promise<ExtractedField> {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}/fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

export async function deleteField(
  documentId: string,
  fieldId: string
): Promise<void> {
  const res = await fetch(
    `${API_BASE}/api/documents/${documentId}/fields/${fieldId}`,
    { method: "DELETE" }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Delete failed (${res.status}): ${body || res.statusText}`);
  }
}

export async function listTemplates(): Promise<TemplateSummary[]> {
  const res = await fetch(`${API_BASE}/api/templates`, { cache: "no-store" });
  if (!res.ok) throw new Error(`List templates failed: ${res.status}`);
  return res.json();
}

export async function getTemplate(id: string): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates/${id}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Get template failed: ${res.status}`);
  return res.json();
}

export async function createTemplate(
  payload: CreateTemplatePayload
): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Create template failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/templates/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Delete template failed (${res.status}): ${body || res.statusText}`);
  }
}

export async function updateTemplate(
  id: string,
  payload: UpdateTemplateRequest
): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Update template failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

export async function duplicateTemplate(id: string): Promise<Template> {
  const res = await fetch(`${API_BASE}/api/templates/${id}/duplicate`, {
    method: "POST",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Duplicate template failed (${res.status}): ${body || res.statusText}`);
  }

  return res.json();
}

export async function fetchSpeechToken(): Promise<SpeechToken> {
  const res = await fetch(`${API_BASE}/api/voice/token`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Speech token fetch failed (${res.status}): ${body || res.statusText}`
    );
  }
  return res.json();
}

export async function postVoiceFill(
  req: VoiceFillRequest
): Promise<VoiceFillResponse> {
  const res = await fetch(`${API_BASE}/api/voice/fill`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Voice fill failed (${res.status}): ${body || res.statusText}`
    );
  }
  return res.json();
}
