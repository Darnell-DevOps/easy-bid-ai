export const MAX_FORM_UPLOAD_BYTES = 30 * 1024 * 1024;

export const SAFE_FORM_UPLOAD_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/bmp",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "text/plain",
  "text/csv",
  "application/csv",
  "application/json",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "application/x-zip-compressed",
] as const;

const EXTENSIONS_BY_MIME = new Map<string, ReadonlySet<string>>([
  ["image/png", new Set([".png"])],
  ["image/jpeg", new Set([".jpg", ".jpeg", ".jfif"])],
  ["image/webp", new Set([".webp"])],
  ["image/gif", new Set([".gif"])],
  ["image/avif", new Set([".avif"])],
  ["image/bmp", new Set([".bmp"])],
  ["image/tiff", new Set([".tif", ".tiff"])],
  ["image/heic", new Set([".heic"])],
  ["image/heif", new Set([".heif"])],
  ["image/x-icon", new Set([".ico"])],
  ["image/vnd.microsoft.icon", new Set([".ico"])],
  ["text/plain", new Set([".txt", ".md", ".log"])],
  ["text/csv", new Set([".csv"])],
  ["application/csv", new Set([".csv"])],
  ["application/json", new Set([".json"])],
  ["application/pdf", new Set([".pdf"])],
  ["application/msword", new Set([".doc"])],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", new Set([".docx"])],
  ["application/vnd.ms-excel", new Set([".xls", ".csv"])],
  ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", new Set([".xlsx"])],
  ["application/vnd.ms-powerpoint", new Set([".ppt"])],
  ["application/vnd.openxmlformats-officedocument.presentationml.presentation", new Set([".pptx"])],
  ["application/zip", new Set([".zip"])],
  ["application/x-zip-compressed", new Set([".zip"])],
]);

export function normalizeFormUploadType(filename: unknown, contentType: unknown): string | null {
  if (typeof filename !== "string" || typeof contentType !== "string") return null;
  const normalizedType = contentType.trim().toLowerCase();
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex < 1) return null;
  const extension = filename.slice(dotIndex).toLowerCase();
  return EXTENSIONS_BY_MIME.get(normalizedType)?.has(extension) ? normalizedType : null;
}

export function safeUploadName(name: string, fallback = "upload"): string {
  const safe = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return safe && safe !== "." && safe !== ".." ? safe : fallback;
}

export function formUploadDownloadName(path: string): string {
  const storedName = path.split("/").pop() || "download";
  const originalName = storedName.replace(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i,
    "",
  );
  return safeUploadName(originalName, "download");
}
