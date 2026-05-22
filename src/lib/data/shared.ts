import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/database.types";

export type DatabaseClient = SupabaseClient<Database>;

export function parseRow<T>(
  value: unknown,
  schema: z.ZodType<T>,
  label = "Supabase row",
) {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  throw new TypeError(`${label} failed validation: ${z.prettifyError(parsed.error)}`);
}

export function parseRows<T>(
  value: unknown,
  schema: z.ZodType<T>,
  label = "Supabase rows",
) {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array.`);
  }

  return value.map((row, index) => parseRow(row, schema, `${label}[${index}]`));
}
