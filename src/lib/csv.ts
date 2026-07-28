import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";

export function parseCsvText(text: string) {
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

export function toCsv(data: Record<string, unknown>[]) {
  return stringify(data, {
    header: true,
  });
}

export function isCsvMimeType(contentType: string | null) {
  if (!contentType) {
    return false;
  }
  return ["text/csv", "application/csv", "application/vnd.ms-excel", "multipart/form-data"].some((type) =>
    contentType.toLowerCase().includes(type),
  );
}