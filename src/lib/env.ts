import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL est requis"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET doit contenir au moins 32 caracteres"),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  APP_TIME_ZONE: z.string().optional(),
  PUBLIC_CONTACT_PHONE: z.string().optional(),
  PUBLIC_CONTACT_EMAIL: z.string().optional(),
  PUBLIC_MESSENGER_URL: z.string().url().optional().or(z.literal("")),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  META_PAGE_ID: z.string().optional(),
  META_PAGE_ACCESS_TOKEN: z.string().optional(),
  META_PAGE_URL: z.string().url().optional(),
  META_GRAPH_API_VERSION: z.preprocess(
    (value) => (typeof value === "string" && value.trim().length === 0 ? undefined : value),
    z.string().default("v20.0"),
  ),
  META_VERIFY_TOKEN: z.string().optional(),
  META_TOKEN_ENCRYPTION_KEY: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success && process.env.NODE_ENV !== "test") {
  throw new Error(`Configuration invalide: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
}

export const env = parsed.success
  ? parsed.data
  : {
      NODE_ENV: "test",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      SESSION_SECRET: "test_secret_that_is_long_enough_for_unit_tests_only",
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
      GOOGLE_REDIRECT_URI: undefined,
      GOOGLE_CALENDAR_ID: "primary",
      GOOGLE_TOKEN_ENCRYPTION_KEY: undefined,
      APP_TIME_ZONE: "America/Toronto",
      PUBLIC_CONTACT_PHONE: undefined,
      PUBLIC_CONTACT_EMAIL: undefined,
      PUBLIC_MESSENGER_URL: undefined,
      META_APP_ID: undefined,
      META_APP_SECRET: undefined,
      META_REDIRECT_URI: undefined,
      META_PAGE_ID: undefined,
      META_PAGE_ACCESS_TOKEN: undefined,
      META_PAGE_URL: undefined,
      META_GRAPH_API_VERSION: "v20.0",
      META_VERIFY_TOKEN: undefined,
      META_TOKEN_ENCRYPTION_KEY: undefined,
    };

export const isGoogleCalendarConfigured = Boolean(
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI && env.GOOGLE_TOKEN_ENCRYPTION_KEY,
);

export const appTimeZone = env.APP_TIME_ZONE || "America/Toronto";
export const googleCalendarId = env.GOOGLE_CALENDAR_ID || "primary";

export function getGoogleCalendarConfigIssues() {
  const issues: string[] = [];
  if (!env.GOOGLE_CLIENT_ID) issues.push("GOOGLE_CLIENT_ID manquant");
  if (!env.GOOGLE_CLIENT_SECRET) issues.push("GOOGLE_CLIENT_SECRET manquant");
  if (!env.GOOGLE_REDIRECT_URI) issues.push("GOOGLE_REDIRECT_URI manquant");
  if (!env.GOOGLE_TOKEN_ENCRYPTION_KEY) issues.push("GOOGLE_TOKEN_ENCRYPTION_KEY manquant");
  return issues;
}

export function getMetaConfigIssues() {
  const issues: string[] = [];
  if (!env.META_PAGE_ID) issues.push("META_PAGE_ID manquant");
  if (!env.META_TOKEN_ENCRYPTION_KEY) issues.push("META_TOKEN_ENCRYPTION_KEY manquant");
  if (!env.META_PAGE_ACCESS_TOKEN && (!env.META_APP_ID || !env.META_APP_SECRET || !env.META_REDIRECT_URI)) {
    issues.push("META_PAGE_ACCESS_TOKEN ou flux OAuth Meta incomplet");
  }
  return issues;
}

export const isMetaConfigured = getMetaConfigIssues().length === 0;