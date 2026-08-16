/**
 * A small, dependency-free structured-output validator. AI responses are
 * untrusted text until they pass this — every feature module declares an
 * ObjectSchema describing exactly the fields it needs, and nothing reaches
 * application code without matching it field-by-field.
 */
export type FieldSpec =
  | { type: "string"; nullable?: boolean }
  | { type: "number"; nullable?: boolean }
  | { type: "enum"; values: readonly string[]; nullable?: boolean };

export type ObjectSchema = Record<string, FieldSpec>;

export type ValidationResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string };

export function validateObject(data: unknown, schema: ObjectSchema): ValidationResult {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, error: "Expected a JSON object." };
  }
  const input = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, spec] of Object.entries(schema)) {
    const value = input[key];

    if (value === null || value === undefined || value === "") {
      if (spec.nullable === false) return { ok: false, error: `Missing required field: "${key}".` };
      result[key] = null;
      continue;
    }

    if (spec.type === "string") {
      if (typeof value !== "string") return { ok: false, error: `Field "${key}" must be a string.` };
      result[key] = value;
    } else if (spec.type === "number") {
      const num = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(num)) return { ok: false, error: `Field "${key}" must be a number.` };
      result[key] = num;
    } else if (spec.type === "enum") {
      if (typeof value !== "string" || !spec.values.includes(value)) {
        return { ok: false, error: `Field "${key}" must be one of: ${spec.values.join(", ")}.` };
      }
      result[key] = value;
    }
  }

  return { ok: true, value: result };
}

/** Extracts a JSON object from model output that may be wrapped in prose or a ```json fence — never throws. */
export function extractJson(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(text);
  const candidate = fenced ? fenced[1] : text;

  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    return { ok: false, error: "No JSON object found in the response." };
  }

  try {
    return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) };
  } catch {
    return { ok: false, error: "Response was not valid JSON." };
  }
}
