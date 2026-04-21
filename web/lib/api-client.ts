import type {
  DocumentResponse,
  DocumentSummary,
  ExtractedField,
  FieldCreate,
  FieldUpdate,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5180";

export async function uploadDocument(file: File): Promise<DocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);

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
