// Production-build integration checks against an EMPTY, local disposable DB.
// Never run this against production: it creates fictional users and CRM records.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

const database = new URL(process.env.DATABASE_URL || "");
assert(["127.0.0.1", "localhost"].includes(database.hostname), "Local test database required");
assert(["/ci", "/crm_fresh"].includes(database.pathname), "Disposable audit database required");
const db = new PrismaClient();
assert.equal(await db.user.count(), 0, "Refusing to run on a configured database");
assert.equal(await db.property.count(), 0, "Refusing to run on existing CRM data");
const port = "3017";
const origin = `http://127.0.0.1:${port}`;
let serverLogs = "";
let checks = 0;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", port], {
  env: {
    ...process.env,
    NODE_ENV: "production",
    NEXT_PUBLIC_APP_URL: origin,
    SESSION_SECRET: "local_ci_session_secret_for_smoke_tests_only_1234567890",
    // No external integration should run during these tests.
    META_DRY_RUN: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
for (const stream of [server.stdout, server.stderr]) {
  stream.on("data", (data) => { serverLogs = (serverLogs + data.toString()).slice(-15000); });
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
}
function client() {
  const jar = new Map();
  return {
    jar,
    async request(path, { method = "GET", body, csrf = true, headers = {} } = {}) {
      const response = await fetch(origin + path, {
        method, redirect: "manual",
        headers: {
          cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; "),
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(csrf && jar.has("simon_csrf") ? { "x-csrf-token": jar.get("simon_csrf") } : {}),
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0];
        const pos = pair.indexOf("=");
        const name = pair.slice(0, pos);
        const value = pair.slice(pos + 1);
        if (value) jar.set(name, value); else jar.delete(name);
      }
      const text = await response.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }
      return { status: response.status, headers: response.headers, data, text };
    },
  };
}
async function apiPaths(dir = "src/app/api", prefix = "/api") {
  const paths = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      paths.push(...await apiPaths(`${dir}/${entry.name}`, `${prefix}/${entry.name.startsWith("[") ? "missing-audit-id" : entry.name}`));
    } else if (entry.name === "route.ts") paths.push(prefix);
  }
  return paths;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(origin + "/api/health");
      if (response.status === 200) { ready = true; break; }
    } catch { /* Wait for Next to listen. */ }
    await sleep(500);
  }
  check(ready, "Production server and test DB healthy");
  const anonymous = client();
  const publicPaths = ["/api/health", "/api/csrf", "/api/setup", "/api/auth/login", "/api/auth/logout", "/api/integrations/meta/webhook"];
  for (const path of await apiPaths()) {
    if (path.startsWith("/api/public/") || publicPaths.includes(path)) continue;
    const response = await anonymous.request(path);
    check(response.status === 401, `Anonymous access denied: ${path}`);
    check(response.headers.get("cache-control")?.includes("no-store"), `No private cache: ${path}`);
  }
  for (const path of ["/dashboard", "/prospects", "/properties", "/mileage", "/facturation"]) {
    const response = await anonymous.request(path);
    check(response.status === 307 && response.headers.get("location")?.includes("/login"), `Private page protected: ${path}`);
  }
  const setupClients = [client(), client()];
  await Promise.all(setupClients.map((c) => c.request("/api/csrf")));
  const password = "AuditLocalPassword_2026!";
  const setupResults = await Promise.all(setupClients.map((c, i) =>
    c.request("/api/setup", { method: "POST", body: { name: `Fictional Admin ${i}`, email: `audit${i}@example.invalid`, password } })));
  check(setupResults.map((r) => r.status).sort().join(",") === "200,409", "Concurrent setup creates exactly one administrator");
  check(await db.user.count() === 1, "One administrator in DB");
  const winner = setupResults.findIndex((r) => r.status === 200);
  const admin = setupClients[winner];
  const email = `audit${winner}@example.invalid`;
  check(setupResults[winner].headers.getSetCookie().some((c) => c.includes("simon_session=") && /HttpOnly/i.test(c) && /Secure/i.test(c) && /SameSite=lax/i.test(c)), "Session cookie security flags");
  check((await admin.request("/api/properties")).status === 200, "Authenticated property listing");
  check((await admin.request("/api/auth/logout", { method: "POST", csrf: false })).status === 403, "Logout requires CSRF");
  check((await admin.request("/api/auth/change-password", { method: "POST", csrf: false, body: {} })).status === 403, "Password change requires CSRF");

  const building = await db.building.create({ data: { codeIsr: "AUDIT-B", address: "123 rue Fictive", city: "Drummondville", district: "Centre" } });
  const unit = await db.rentalUnit.create({ data: { codeIsr: "AUDIT-U", buildingId: building.id, monthlyPrice: 1200, bedrooms: 2, propertyType: "Appartement", description: "Logement fictif pour les tests", isPubliclyVisible: null, internalNotes: "AUDIT_PRIVATE_NOTE" } });
  const property = await db.property.create({ data: { codeIsr: "AUDIT-P", address: building.address, city: building.city, monthlyPrice: 1200, bedrooms: 2, propertyType: "Appartement", descriptionFr: unit.description, descriptionEn: "Fictional audit apartment", rentalUnitId: unit.id, buildingId: building.id } });
  const catalog = await anonymous.request("/api/public/catalog?city=Drummondville");
  check(catalog.status === 200 && catalog.data.items.length === 1, "Nullable visibility keeps eligible listings public");
  check(!catalog.text.includes("AUDIT_PRIVATE_NOTE") && !catalog.text.includes("123 rue"), "Public catalog hides internal notes and street numbers");
  const mismatch = await anonymous.request("/api/public/catalog?city=Drummondville&district=Absent");
  check(mismatch.data.items.length === 0, "City and district filters are cumulative");
  await db.rentalUnit.update({ where: { id: unit.id }, data: { isPubliclyVisible: false } });
  check((await anonymous.request("/api/public/catalog")).data.items.length === 0, "Hidden unit excluded from legacy fallback");
  for (const id of [unit.id, property.id]) {
    const detail = await anonymous.request(`/api/public/listings/${id}`);
    check(!detail.data?.item && !detail.text.includes("Logement fictif"), `Hidden listing inaccessible: ${id === unit.id ? "unit" : "legacy"}`);
    const page = await anonymous.request(`/logements/${id}`);
    check(page.status === 404, "Hidden listing page returns 404");
  }
  const prospect = await db.prospect.create({ data: { name: "Original Identity", phone: "8195550100", email: "original@example.invalid", status: "QUALIFIED", notes: "PRIVATE_PROSPECT_NOTES" } });
  const submitted = { name: "Unverified Visitor", phone: prospect.phone, email: "visitor@example.invalid" };
  const contact = await anonymous.request("/api/public/contact", { method: "POST", body: { ...submitted, consent: true, message: "Demande fictive de renseignements", preferredContactMethod: "PHONE" } });
  check(contact.status === 200 && !contact.text.includes(prospect.id), "Contact accepted without leaking CRM identity");
  let stored = await db.prospect.findUnique({ where: { id: prospect.id } });
  check(stored.name === prospect.name && stored.email === prospect.email && stored.notes === prospect.notes && stored.status === "QUALIFIED", "Public contact preserves verified CRM fields");
  const visitBody = { prospect: submitted, visit: { propertyId: property.id, rentalUnitId: unit.id, startsAt: new Date(Date.now() + 86400000).toISOString() } };
  check((await anonymous.request("/api/public/visits", { method: "POST", body: visitBody })).status === 404, "Hidden unit rejects visit requests");
  await db.rentalUnit.update({ where: { id: unit.id }, data: { isPubliclyVisible: true } });
  const visit = await anonymous.request("/api/public/visits", { method: "POST", body: visitBody });
  check(visit.status === 200 && visit.data.ok && !visit.text.includes(prospect.email), "Visit request accepted without returning personal data");
  stored = await db.prospect.findUnique({ where: { id: prospect.id } });
  check(stored.name === prospect.name && stored.status === "QUALIFIED", "Visit request preserves verified CRM fields");
  check((await db.visit.findUnique({ where: { id: visit.data.visitId } })).status === "PENDING_APPROVAL", "Public visit needs human approval");
  check((await anonymous.request("/api/public/visits", { method: "POST", body: visitBody })).data.duplicate === true, "Repeated visit request deduplicated");

  const trip = await admin.request("/api/mileage", { method: "POST", body: { tripDate: new Date().toISOString(), originAddress: "1 rue Fictive", destinationAddress: "2 rue Fictive", purpose: "Audit fictif", oneWayKm: 12.5, roundTrip: true } });
  check(trip.status === 201 && trip.data.businessKm === 25, "Mileage creation and round-trip calculation");
  const mileage = await admin.request("/api/mileage");
  check(mileage.status === 200 && mileage.data.summary.businessKm === 25, "Mileage persisted and summarized");
  const commissions = [];
  for (let i = 0; i < 4; i++) {
    const placement = await db.placement.create({ data: { prospectId: prospect.id, propertyId: property.id, commission: { create: { plannedAmount: 500, status: i === 3 ? "CANCELLED" : "CONFIRMED" } } }, include: { commission: true } });
    commissions.push(placement.commission);
  }
  const invoiceBody = (i) => ({ lines: [{ commissionId: commissions[i].id, amount: 500 }] });
  const invoices = await Promise.all([0, 1].map((i) => admin.request("/api/invoices", { method: "POST", body: invoiceBody(i) })));
  check(invoices.every((r) => r.status === 201) && invoices[0].data.invoice.number !== invoices[1].data.invoice.number, "Concurrent invoices get distinct numbers");
  const doubleInvoice = await Promise.all([0, 1].map(() => admin.request("/api/invoices", { method: "POST", body: invoiceBody(2) })));
  check(doubleInvoice.map((r) => r.status).sort().join(",") === "201,409", "Concurrent requests cannot invoice one commission twice");
  check((await admin.request("/api/invoices", { method: "POST", body: invoiceBody(3) })).status === 409, "Cancelled commission cannot be invoiced");
  check((await admin.request("/api/invoices")).data.invoices.length === 3, "Created invoices remain readable");
  for (const path of ["/dashboard", "/properties", "/prospects", "/visits", "/mileage", "/facturation", "/placements", "/commissions", "/marketing", "/marketing/approval", "/admin/logements", "/settings/calendar", "/settings/meta"]) {
    const page = await admin.request(path);
    check(path === "/properties"
      ? page.status === 307 && page.headers.get("location") === "/admin/logements"
      : page.status === 200, `Authenticated page renders: ${path} (${page.status})`);
  }
  const oldSession = admin.jar.get("simon_session");
  const newPassword = "AuditChangedPassword_2026!";
  check((await admin.request("/api/auth/change-password", { method: "POST", body: { currentPassword: password, newPassword } })).status === 200, "Password change succeeds");
  const revoked = client();
  revoked.jar.set("simon_session", oldSession);
  check((await revoked.request("/api/properties")).status === 401, "Previous session revoked after password change");
  await admin.request("/api/csrf");
  check((await admin.request("/api/auth/login", { method: "POST", body: { email, password } })).status === 401, "Old password rejected");
  check((await admin.request("/api/auth/login", { method: "POST", body: { email, password: newPassword } })).status === 200, "New password accepted");
  const logout = await admin.request("/api/auth/logout", { method: "POST" });
  check(logout.status === 200 && logout.headers.get("clear-site-data") === '"cache"', "Logout clears browser cache");
  check((await admin.request("/api/properties")).status === 401, "Logged-out client has no private access");
  check((await anonymous.request("/sw.js")).status === 200, "Replacement service worker available");
  console.log(`PASS: ${checks} HTTP/database integration checks`);
} catch (error) {
  console.error(serverLogs);
  throw error;
} finally {
  server.kill();
  await db.$disconnect();
}
