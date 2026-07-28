import sanitizeHtml from "sanitize-html";

export function cleanText(value: string | undefined | null) {
  if (!value) {
    return "";
  }

  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  })
    .trim()
    .replace(/\s+/g, " ");
}