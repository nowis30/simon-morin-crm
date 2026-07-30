"use client";

import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import {
  buildTextDiffLines,
  countModifiedEditableDrafts,
  GENERATOR_VERSION,
  getEditableDraftStatus,
  markEditableDraftsSaved,
  resetAllEditableDrafts,
  resetEditableDraftByKey,
  toEditableDrafts,
  updateEditableDraftField,
  validateEditableDrafts,
  type EditableDraft,
  type GenerationMode,
} from "@/lib/marketing";

type Property = { id: string; codeIsr: string; address: string };
type EditablePreviewDraft = EditableDraft & { showDiff: boolean };

type Advertisement = {
  id: string;
  title: string;
  body: string;
  status: "DRAFT" | "PUBLISHED" | "RETIRED";
  generatedAutomatically: boolean;
  manuallyEdited: boolean;
  generatedAt: string | null;
  sourcePropertyUpdatedAt: string | null;
  generatorVersion: string | null;
  publicationUrl: string | null;
  messagesReceived: number;
  publishedAt: string | null;
  property: { codeIsr: string; address: string; photos?: { id: string; url: string }[] } | null;
  versions: { id: string; createdAt: string; title: string; changeSource?: string | null }[];
};

type Preview = {
  totalProperties: number;
  existingAdvertisements: number;
  replacements: number;
  protectedAdvertisements: number;
  missingAdvertisements: number;
  analyzedAdvertisements: number;
};

type SyncReport = {
  importedProperties: number;
  availableProperties: number;
  rentedProperties: number;
  removedProperties: number;
  toVerifyProperties: number;
  missingNow: string[];
  newProperties: string[];
  changedAddresses: string[];
  changedPhotos: string[];
};

type FinalReport = {
  totalProperties: number;
  analyzedAdvertisements: number;
  regeneratedAdvertisements: number;
  alreadyUpToDate: number;
  protectedAdvertisements: number;
  errors: number;
  missingAdvertisements: number;
  skippedAdvertisements: number;
};

export default function MarketingPage() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [ads, setAds] = useState<Advertisement[]>([]);
  const [selectedProperty, setSelectedProperty] = useState("");
  const [mode, setMode] = useState<GenerationMode>("INCOMPLETE_ONLY");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [needsForceConfirm, setNeedsForceConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ processedProperties: 0, generated: 0, skipped: 0, protected: 0, errors: 0, percent: 0 });
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [singleGenerating, setSingleGenerating] = useState(false);
  const [singleSuccess, setSingleSuccess] = useState<string | null>(null);
  const [singlePreview, setSinglePreview] = useState<EditablePreviewDraft[]>([]);
  const [singlePreviewLoading, setSinglePreviewLoading] = useState(false);
  const [singlePreviewErrors, setSinglePreviewErrors] = useState<Record<string, { title?: string; body?: string }>>({});

  const modifiedCount = countModifiedEditableDrafts(singlePreview);
  const hasUnsavedChanges = modifiedCount > 0;

  async function load() {
    const [propertiesData, adsData, syncReportData] = await Promise.all([
      fetch("/api/properties").then((response) => response.json()),
      fetch("/api/advertisements").then((response) => response.json()),
      fetch("/api/properties/sync-report").then((response) => response.json()),
    ]);

    setProperties((propertiesData.items ?? []).map((item: Property) => ({ id: item.id, codeIsr: item.codeIsr, address: item.address })));
    setAds(adsData.items ?? []);
    setSyncReport(syncReportData);
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const propertyId = params.get("propertyId");
    if (propertyId) {
      setSelectedProperty(propertyId);
    }
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);
    return () => {
      window.removeEventListener("beforeunload", handler);
    };
  }, [hasUnsavedChanges]);

  function setPreviewFromDrafts(items: EditableDraft[]) {
    setSinglePreview(items.map((item) => ({ ...item, showDiff: false })));
  }

  function handlePropertyChange(nextPropertyId: string) {
    if (nextPropertyId === selectedProperty) {
      return;
    }

    if (hasUnsavedChanges) {
      const confirmed = window.confirm("Tu as des modifications non enregistrees. Changer de logement va perdre ces modifications. Continuer?");
      if (!confirmed) {
        return;
      }
    }

    setSelectedProperty(nextPropertyId);
    setSinglePreview([]);
    setSinglePreviewErrors({});
    setSingleSuccess(null);
    setError(null);
  }

  async function generate() {
    if (!selectedProperty) {
      setSingleSuccess(null);
      setError("Choisis un logement avant de generer les contenus.");
      return;
    }

    if (singlePreview.length === 0) {
      setSingleSuccess(null);
      setError("Previsualise d'abord les contenus avant de confirmer l'enregistrement.");
      return;
    }

    const validation = validateEditableDrafts(singlePreview);
    if (!validation.valid) {
      setSinglePreviewErrors(validation.errors);
      setSingleSuccess(null);
      setError("Certains contenus sont invalides. Corrige les erreurs avant d'enregistrer.");
      return;
    }

    setError(null);
    setSingleSuccess(null);
    setSingleGenerating(true);
    setSinglePreviewErrors({});
    try {
      const csrf = await fetch("/api/csrf").then((r) => r.json());
      const response = await fetch(`/api/marketing/${selectedProperty}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({ items: validation.normalizedItems }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "La generation a echoue.");
        return;
      }

      const count = Array.isArray(data.items) ? data.items.length : 0;
      const property = properties.find((item) => item.id === selectedProperty);
      setSingleSuccess(`${count} contenu(s) genere(s) pour ${property?.codeIsr ?? "le logement selectionne"}.`);
      setPreviewFromDrafts(markEditableDraftsSaved(toEditableDrafts(validation.normalizedItems)));
      await load();
    } catch {
      setError("Une erreur est survenue pendant la generation.");
    } finally {
      setSingleGenerating(false);
    }
  }

  async function previewSingleGeneration() {
    if (!selectedProperty) {
      setSingleSuccess(null);
      setError("Choisis un logement avant de previsualiser les contenus.");
      return;
    }

    setError(null);
    setSingleSuccess(null);
    setSinglePreviewLoading(true);
    setSinglePreviewErrors({});

    try {
      const response = await fetch(`/api/marketing/${selectedProperty}/preview`);
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Impossible de generer la previsualisation.");
        setSinglePreview([]);
        return;
      }

      const drafts = toEditableDrafts(Array.isArray(data.items) ? data.items : []);
      setPreviewFromDrafts(drafts);
    } catch {
      setError("Une erreur est survenue pendant la previsualisation.");
      setSinglePreview([]);
    } finally {
      setSinglePreviewLoading(false);
    }
  }

  function updateSinglePreview(key: string, field: "title" | "body", value: string) {
    setSinglePreview((current) => updateEditableDraftField(current, key, field, value));
    setSinglePreviewErrors((current) => {
      if (!current[key]?.[field]) {
        return current;
      }
      const next = { ...current, [key]: { ...current[key], [field]: undefined } };
      const entry = next[key];
      if (!entry.title && !entry.body) {
        delete next[key];
      }
      return next;
    });
  }

  function resetSinglePreviewBlock(key: string) {
    const block = singlePreview.find((item) => item.key === key);
    if (!block) {
      return;
    }

    const isModified = block.title !== block.initialTitle || block.body !== block.initialBody;
    if (isModified) {
      const confirmed = window.confirm("Ce bloc contient des modifications non enregistrees. Le reinitialiser?");
      if (!confirmed) {
        return;
      }
    }

    setSinglePreview((current) => resetEditableDraftByKey(current, key));
    setSinglePreviewErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function resetAllPreviewBlocks() {
    if (singlePreview.length === 0) {
      return;
    }

    const confirmed = window.confirm("Reinitialiser les 6 contenus a la version automatique? Les modifications non enregistrees seront perdues.");
    if (!confirmed) {
      return;
    }

    setSinglePreview((current) => resetAllEditableDrafts(current));
    setSinglePreviewErrors({});
  }

  function toggleDiff(key: string) {
    setSinglePreview((current) =>
      current.map((item) => {
        if (item.key !== key) return item;
        return { ...item, showDiff: !item.showDiff };
      }),
    );
  }

  async function updateStatus(adId: string, status: "DRAFT" | "PUBLISHED" | "RETIRED") {
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    await fetch(`/api/advertisements/${adId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  async function prepareRegeneration() {
    setError(null);
    setFinalReport(null);
    const previewResponse = await fetch(`/api/marketing/regenerate/preview?mode=${mode}`);
    const data = await previewResponse.json();
    if (!previewResponse.ok) {
      setError(data.error ?? "Impossible de preparer la regeneration");
      return;
    }
    setPreview(data);
    setShowConfirm(true);
    setNeedsForceConfirm(false);
  }

  async function runRegeneration() {
    if (mode === "FORCE_ALL" && !needsForceConfirm) {
      setNeedsForceConfirm(true);
      return;
    }

    setRunning(true);
    setShowConfirm(false);
    setError(null);

    const csrf = await fetch("/api/csrf").then((r) => r.json());
    let offset = 0;
    const aggregate = {
      totalProperties: preview?.totalProperties ?? 0,
      analyzedAdvertisements: 0,
      regeneratedAdvertisements: 0,
      alreadyUpToDate: 0,
      protectedAdvertisements: 0,
      errors: 0,
      missingAdvertisements: 0,
      skippedAdvertisements: 0,
    } satisfies FinalReport;

    while (true) {
      const response = await fetch("/api/marketing/regenerate/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
        body: JSON.stringify({ mode, offset }),
      });
      const payload = await response.json();

      if (!response.ok) {
        setRunning(false);
        setError(payload.error ?? "La regeneration a echoue");
        return;
      }

      aggregate.analyzedAdvertisements += payload.analyzedAdvertisements;
      aggregate.regeneratedAdvertisements += payload.generated;
      aggregate.alreadyUpToDate += payload.alreadyUpToDate;
      aggregate.protectedAdvertisements += payload.protected;
      aggregate.errors += payload.errors;
      aggregate.missingAdvertisements += payload.missingAdvertisements;
      aggregate.skippedAdvertisements += payload.skipped;

      setProgress({
        processedProperties: payload.processedProperties,
        generated: aggregate.regeneratedAdvertisements,
        skipped: aggregate.skippedAdvertisements,
        protected: aggregate.protectedAdvertisements,
        errors: aggregate.errors,
        percent: payload.percent,
      });

      if (payload.nextOffset === null) {
        break;
      }

      offset = payload.nextOffset;
    }

    await fetch("/api/marketing/regenerate/finalize", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": csrf.token },
      body: JSON.stringify({ mode, generatorVersion: GENERATOR_VERSION, ...aggregate }),
    });

    setFinalReport(aggregate);
    setRunning(false);
    setNeedsForceConfirm(false);
    await load();
  }

  function downloadReportCsv() {
    if (!finalReport) return;
    const rows = [
      ["totalProperties", finalReport.totalProperties],
      ["analyzedAdvertisements", finalReport.analyzedAdvertisements],
      ["regeneratedAdvertisements", finalReport.regeneratedAdvertisements],
      ["alreadyUpToDate", finalReport.alreadyUpToDate],
      ["protectedAdvertisements", finalReport.protectedAdvertisements],
      ["errors", finalReport.errors],
      ["missingAdvertisements", finalReport.missingAdvertisements],
      ["skippedAdvertisements", finalReport.skippedAdvertisements],
    ];
    const csv = ["metric,value", ...rows.map(([key, value]) => `${key},${value}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "rapport-regeneration-annonces.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Marketing</h2>
        <p className="text-sm text-emerald-800">Textes FR/EN, apercu, copie, editions, historique et etat</p>
      </div>

      <div className="card grid gap-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Régénération globale</h3>
            <p className="text-sm text-emerald-800">Régénère les annonces à partir des données et photos actuelles.</p>
          </div>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-white" onClick={prepareRegeneration} disabled={running}>
            Régénérer toutes les annonces
          </button>
        </div>

        <div className="grid gap-2 text-sm">
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "INCOMPLETE_ONLY"} onChange={() => setMode("INCOMPLETE_ONLY")} /> Régénérer seulement les annonces incomplètes</label>
          <label className="flex items-center gap-2"><input type="radio" checked={mode === "AUTOMATIC_ONLY"} onChange={() => setMode("AUTOMATIC_ONLY")} /> Régénérer toutes les annonces automatiques</label>
          <label className="flex items-center gap-2 text-red-700"><input type="radio" checked={mode === "FORCE_ALL"} onChange={() => setMode("FORCE_ALL")} /> Régénérer toutes les annonces, y compris les annonces modifiées manuellement</label>
        </div>

        {running ? (
          <div className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <p>Logements traités: {progress.processedProperties}</p>
            <p>Annonces générées: {progress.generated}</p>
            <p>Annonces ignorées: {progress.skipped}</p>
            <p>Annonces protégées: {progress.protected}</p>
            <p>Erreurs: {progress.errors}</p>
            <p>Progression: {progress.percent}%</p>
            <div className="h-3 overflow-hidden rounded-full bg-white">
              <div className="h-full bg-[var(--accent)]" style={{ width: `${progress.percent}%` }} />
            </div>
          </div>
        ) : null}

        {finalReport ? (
          <div className="grid gap-2 rounded-xl border border-emerald-200 bg-white p-4 text-sm">
            <p>Total logements: {finalReport.totalProperties}</p>
            <p>Annonces analysées: {finalReport.analyzedAdvertisements}</p>
            <p>Annonces régénérées: {finalReport.regeneratedAdvertisements}</p>
            <p>Annonces déjà à jour: {finalReport.alreadyUpToDate}</p>
            <p>Annonces protégées: {finalReport.protectedAdvertisements}</p>
            <p>Erreurs: {finalReport.errors}</p>
            <button className="mt-2 rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={downloadReportCsv}>Télécharger le rapport CSV</button>
          </div>
        ) : null}

        {showConfirm && preview ? (
          <div className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
            <p>Logements concernés: {preview.totalProperties}</p>
            <p>Annonces existantes: {preview.existingAdvertisements}</p>
            <p>Annonces qui seront remplacées: {preview.replacements}</p>
            <p>Annonces protégées: {preview.protectedAdvertisements}</p>
            <p>Annonces manquantes à créer: {preview.missingAdvertisements}</p>
            {needsForceConfirm ? <p className="font-semibold text-red-700">Avertissement: ce mode écrasera aussi les annonces modifiées manuellement. Confirme une seconde fois.</p> : null}
            <div className="flex flex-wrap gap-2">
              <button className="rounded-lg bg-[var(--accent)] px-3 py-2 text-white" onClick={runRegeneration}>Confirmer</button>
              <button className="rounded-lg border border-emerald-200 px-3 py-2" onClick={() => { setShowConfirm(false); setNeedsForceConfirm(false); }}>Annuler</button>
            </div>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-700">{error}</p> : null}
      </div>

      {syncReport ? (
        <div className="card grid gap-2 p-4 text-sm">
          <h3 className="text-xl font-bold">Rapport de synchronisation ISR</h3>
          <p>Logements importés: {syncReport.importedProperties}</p>
          <p>Disponibles: {syncReport.availableProperties}</p>
          <p>Loués: {syncReport.rentedProperties}</p>
          <p>Retirés: {syncReport.removedProperties}</p>
          <p>À vérifier: {syncReport.toVerifyProperties}</p>
          <p>Nouveaux logements détectés: {syncReport.newProperties.length}</p>
          <p>Logements absents depuis la dernière synchro: {syncReport.missingNow.length}</p>
          <p>Adresses changées: {syncReport.changedAddresses.length}</p>
          <p>Photos changées: {syncReport.changedPhotos.length}</p>
        </div>
      ) : null}

      <div className="card grid gap-3 p-4 md:grid-cols-[1fr_auto]">
        <select value={selectedProperty} onChange={(event) => handlePropertyChange(event.target.value)} className="rounded-lg border border-emerald-200 px-3 py-3">
          <option value="">Choisir un logement</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>{property.codeIsr} - {property.address}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-lg border border-emerald-300 px-4 py-3 text-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={previewSingleGeneration}
            disabled={!selectedProperty || singlePreviewLoading || singleGenerating}
          >
            {singlePreviewLoading ? "Previsualisation..." : "Previsualiser les 6 contenus"}
          </button>
          <button
            className="rounded-lg bg-[var(--accent)] px-4 py-3 text-white disabled:cursor-not-allowed disabled:opacity-50"
            onClick={generate}
            disabled={!selectedProperty || singleGenerating || singlePreview.length === 0 || modifiedCount === 0}
          >
            {singleGenerating ? "Generation en cours..." : "Confirmer et enregistrer"}
          </button>
        </div>
      </div>

      {singleSuccess ? <p className="text-sm text-emerald-700">{singleSuccess}</p> : null}
      {singlePreview.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">{modifiedCount} contenus modifies sur {singlePreview.length}</span>
          {hasUnsavedChanges ? <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">Modifications non enregistrees</span> : null}
          <button className="rounded-lg border border-emerald-300 px-3 py-2" onClick={resetAllPreviewBlocks} disabled={singleGenerating}>Tout reinitialiser</button>
        </div>
      ) : null}

      {singlePreview.length > 0 ? (
        <div className="card grid gap-3 p-4">
          <h3 className="text-xl font-bold">Apercu avant enregistrement</h3>
          <p className="text-sm text-emerald-800">Ces textes ne sont pas enregistres tant que tu ne cliques pas sur "Confirmer et enregistrer".</p>
          <div className="grid gap-3">
            {singlePreview.map((item) => {
              const status = getEditableDraftStatus(item);
              const blockErrors = singlePreviewErrors[item.key];
              const diffLines = buildTextDiffLines(item.initialBody, item.body);
              const titleChanged = item.initialTitle !== item.title;

              return (
              <article key={item.key} className="rounded-xl border border-emerald-200 p-3">
                <p className="text-xs font-semibold text-emerald-900">{item.type} | {item.language}</p>
                <p className="mt-1 text-xs">
                  {status === "AUTO" ? <span className="rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-900">Version automatique</span> : null}
                  {status === "MODIFIED" ? <span className="rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900">Modifiee</span> : null}
                  {status === "RESET" ? <span className="rounded-full bg-sky-100 px-2 py-1 font-semibold text-sky-900">Reinitialisee</span> : null}
                </p>
                <label className="mt-1 grid gap-1 text-sm">
                  <span className="font-semibold">Titre</span>
                  <input
                    className="rounded-lg border border-emerald-200 px-3 py-2"
                    value={item.title}
                    onChange={(event) => updateSinglePreview(item.key, "title", event.target.value)}
                  />
                  {blockErrors?.title ? <span className="text-xs font-semibold text-red-700">{blockErrors.title}</span> : null}
                </label>
                <label className="mt-2 grid gap-1 text-sm">
                  <span className="font-semibold">Texte</span>
                  <textarea
                    className="min-h-36 rounded-lg border border-emerald-200 px-3 py-2"
                    value={item.body}
                    onChange={(event) => updateSinglePreview(item.key, "body", event.target.value)}
                  />
                  {blockErrors?.body ? <span className="text-xs font-semibold text-red-700">{blockErrors.body}</span> : null}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <CopyButton text={item.body} label="Copier" />
                  <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => resetSinglePreviewBlock(item.key)}>
                    Reinitialiser ce bloc
                  </button>
                  <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => toggleDiff(item.key)}>
                    {item.showDiff ? "Masquer les differences" : "Voir les differences"}
                  </button>
                </div>

                {item.showDiff ? (
                  <div className="mt-3 grid gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 md:grid-cols-2">
                    <div className="grid gap-2">
                      <h4 className="text-sm font-bold">Version automatique</h4>
                      <p className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white p-2 text-xs">{item.initialTitle}</p>
                      <p className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white p-2 text-xs">{item.initialBody}</p>
                    </div>
                    <div className="grid gap-2">
                      <h4 className="text-sm font-bold">Version modifiee</h4>
                      <p className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white p-2 text-xs">{item.title}</p>
                      <p className="whitespace-pre-wrap rounded-lg border border-emerald-200 bg-white p-2 text-xs">{item.body}</p>
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <h4 className="text-sm font-bold">Changements du titre</h4>
                      {titleChanged ? (
                        <div className="grid gap-1 text-xs">
                          <p className="rounded bg-red-100 px-2 py-1 text-red-900">- {item.initialTitle}</p>
                          <p className="rounded bg-emerald-100 px-2 py-1 text-emerald-900">+ {item.title}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-emerald-900">Aucun changement du titre.</p>
                      )}
                    </div>
                    <div className="md:col-span-2 grid gap-2">
                      <h4 className="text-sm font-bold">Ajouts et suppressions (texte)</h4>
                      <div className="max-h-72 overflow-auto rounded-lg border border-emerald-200 bg-white p-2 text-xs">
                        {diffLines.map((line, lineIndex) => (
                          <p
                            key={`${item.key}-diff-${lineIndex}`}
                            className={
                              line.type === "added"
                                ? "whitespace-pre-wrap bg-emerald-100 text-emerald-900"
                                : line.type === "removed"
                                  ? "whitespace-pre-wrap bg-red-100 text-red-900"
                                  : "whitespace-pre-wrap text-emerald-900"
                            }
                          >
                            {line.type === "added" ? "+ " : line.type === "removed" ? "- " : "  "}
                            {line.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3">
        {ads.map((ad) => (
          <article key={ad.id} className="card grid gap-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-bold">{ad.title}</h3>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold">{ad.status}</span>
            </div>
            {ad.property?.photos?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ad.property.photos[0].url} alt={ad.property.address} className="h-48 w-full rounded-xl object-cover" />
            ) : null}
            <p className="whitespace-pre-wrap text-sm">{ad.body}</p>
            <div className="flex flex-wrap gap-2">
              <CopyButton text={ad.body} label="Copier" />
              <a href={`/marketing/marketplace/${ad.id}`} className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white">
                Preparer pour Marketplace
              </a>
              <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => updateStatus(ad.id, "PUBLISHED")}>
                Marquer Publiee
              </button>
              <button className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" onClick={() => updateStatus(ad.id, "RETIRED")}>
                Marquer Retiree
              </button>
            </div>
            <p className="text-xs text-emerald-900">
              Date publication: {ad.publishedAt ? new Date(ad.publishedAt).toLocaleString("fr-CA") : "N/A"} | Lien: {ad.publicationUrl || "N/A"} |
              Messages recus: {ad.messagesReceived}
            </p>
            <p className="text-xs text-emerald-900">
              Génération auto: {ad.generatedAutomatically ? "Oui" : "Non"} | Modifiée manuellement: {ad.manuallyEdited ? "Oui" : "Non"} |
              Générée le: {ad.generatedAt ? new Date(ad.generatedAt).toLocaleString("fr-CA") : "N/A"} | Version générateur: {ad.generatorVersion || "N/A"}
            </p>
            <details>
              <summary className="cursor-pointer text-sm font-semibold">Historique des versions ({ad.versions.length})</summary>
              <ul className="mt-2 grid gap-1 text-xs">
                {ad.versions.map((version) => (
                  <li key={version.id}>{new Date(version.createdAt).toLocaleString("fr-CA")} - {version.title} {version.changeSource ? `(${version.changeSource})` : ""}</li>
                ))}
              </ul>
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
