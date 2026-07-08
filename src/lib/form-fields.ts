// Shared form-field engine. Used by onboarding forms AND public lead-capture forms.

export type SmartFieldType =
  | "short_text"
  | "long_text"
  | "url"
  | "email"
  | "phone"
  | "number"
  | "date"
  | "select"
  | "radio"
  | "multi_select"
  | "checkbox"
  | "file";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "is_empty"
  | "is_not_empty"
  | "contains";

export interface FieldCondition {
  fieldId: string;
  operator: ConditionOperator;
  value?: string;
}

export interface SmartField {
  id: string;
  label: string;
  type: SmartFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[]; // select / radio / multi_select
  group?: string;
  condition?: FieldCondition | null;
  maxSizeMb?: number; // file
  accept?: string; // file — comma-separated MIME or extensions
  multiple?: boolean; // file — allow multiple files (stored as JSON array)
}

export type FieldResponses = Record<string, string | string[] | boolean>;

export function getResponseString(r: FieldResponses | undefined, id: string): string {
  if (!r) return "";
  const v = r[id];
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "boolean") return v ? "yes" : "";
  return String(v);
}

export function isFieldVisible(field: SmartField, responses: FieldResponses | undefined): boolean {
  const c = field.condition;
  if (!c || !c.fieldId) return true;
  const raw = getResponseString(responses, c.fieldId).trim();
  const target = (c.value || "").trim();
  switch (c.operator) {
    case "equals": return raw.toLowerCase() === target.toLowerCase();
    case "not_equals": return raw.toLowerCase() !== target.toLowerCase();
    case "is_empty": return raw.length === 0;
    case "is_not_empty": return raw.length > 0;
    case "contains": return target.length > 0 && raw.toLowerCase().includes(target.toLowerCase());
    default: return true;
  }
}

export function visibleFields(fields: SmartField[], responses: FieldResponses | undefined): SmartField[] {
  return fields.filter((f) => isFieldVisible(f, responses));
}

export function groupSmartFields(fields: SmartField[]): { group: string; fields: SmartField[] }[] {
  const groups: { group: string; fields: SmartField[] }[] = [];
  for (const f of fields) {
    const g = f.group || "Details";
    let bucket = groups.find((x) => x.group === g);
    if (!bucket) {
      bucket = { group: g, fields: [] };
      groups.push(bucket);
    }
    bucket.fields.push(f);
  }
  return groups;
}

export function computeProgress(fields: SmartField[], responses: FieldResponses | undefined): number {
  const visible = visibleFields(fields, responses);
  const required = visible.filter((f) => f.required);
  const pool = required.length > 0 ? required : visible;
  if (pool.length === 0) return 0;
  const filled = pool.filter((f) => isFilled(f, responses)).length;
  return Math.round((filled / pool.length) * 100);
}

export function isFilled(field: SmartField, responses: FieldResponses | undefined): boolean {
  const v = responses?.[field.id];
  if (v == null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "boolean") return v === true;
  return String(v).trim().length > 0;
}

export function missingRequired(fields: SmartField[], responses: FieldResponses | undefined): SmartField[] {
  return visibleFields(fields, responses).filter((f) => f.required && !isFilled(f, responses));
}

export function newFieldId(): string {
  return "f_" + Math.random().toString(36).slice(2, 9);
}

export const FIELD_TYPE_LABELS: Record<SmartFieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  url: "URL",
  email: "Email",
  phone: "Phone",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  radio: "Single choice",
  multi_select: "Multi-select",
  checkbox: "Checkbox",
  file: "File upload",
};

export const ALL_FIELD_TYPES: SmartFieldType[] = [
  "short_text", "long_text", "url", "email", "phone", "number",
  "date", "select", "radio", "multi_select", "checkbox", "file",
];

// File payload (stored serialized as JSON string inside Record<string,string>)
export interface FilePayload {
  path: string;
  name: string;
  size: number;
  type: string;
}

export function parseFilePayload(value: unknown): FilePayload | null {
  if (!value) return null;
  if (typeof value === "object" && value !== null && "path" in (value as any)) {
    return value as FilePayload;
  }
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s.startsWith("{")) return null;
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj.path === "string" && typeof obj.name === "string") {
      return { path: obj.path, name: obj.name, size: Number(obj.size) || 0, type: String(obj.type || "") };
    }
  } catch { /* ignore */ }
  return null;
}

export function serializeFilePayload(p: FilePayload | null | undefined): string {
  if (!p) return "";
  return JSON.stringify(p);
}
