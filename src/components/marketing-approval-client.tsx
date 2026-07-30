"use client";

import { useEffect, useMemo, useState } from "react";

function formatSummaryLabel(channel: string) {
  if (channel === "PAGE") return "Page Facebook";
  if (channel === "MARKETPLACE") return "Marketplace";
  if (channel === "FACEBOOK_GROUP") return "Groupes Facebook";
  return channel;
}

type Dashboard = {
  byStatus: Array<{ status: string; _count: { _all: number } }>;
  byChannel: Record<string, { messages: number; prospects: number; visits: number; placements: number; commission: number }>;
  needsAction: number;
};

type MetaStatus = {
  configured: boolean;
  configIssues: string[];
  connected: boolean;
  pageIdMatches: boolean;
  tokenValid: boolean;
  graphApiVersion: string;
  grantedScopes: string[];
  missingScopes: string[];
  issues: string[];
  pageId: string | null;
  pageName: string | null;
  tokenRevoked: boolean;
  tokenExpiresAt: string | null;
  connectionExists: boolean;
};

type Group = {
  id: string;
  name: string;
  link: string;
  city: string | null;
  sectors: string[];
  language: string | null;
  active: boolean;
  minDelayHours: number;
};

type Advertisement = {
  id: string;
  title: string;
  body: string;
  type: string;
  language: string;
  status: string;
  approvalWarnings: string[];
  approvalNotes: string | null;
  property: {
    id: string;
    rentalUnitId: string | null;
    codeIsr: string;
    address: string;
    city: string;
    district: string | null;
    monthlyPrice: number;
    bedrooms: number;
    propertyType: string;
    petsAllowed: boolean;
    parking: boolean;
    inclusions: string | null;
    status: string;
    photos: Array<{ id: string; url: string; description: string | null }>;
  } | null;
  selectedPhotos: Array<{
    id: string;
    propertyPhotoId: string;
    channel: "PAGE" | "MARKETPLACE" | "FACEBOOK_GROUP";
    sortOrder: number;
    isPrimary: boolean;
    excluded: boolean;
  }>;
  publications: Array<{
    id: string;
    channel: string;
    status: string;
    publicationUrl: string | null;
    publishedAt: string | null;
    errorMessage?: string | null;
  }>;
  groupPublications: Array<{
    id: string;
    groupId: string;
    status: string;
    publicationUrl: string | null;
    group: { id: string; name: string; city: string | null };
  }>;
};

const DEFAULT_PUBLIC_BASE_URL = "https://logements.nowis.store";
const OFFICIAL_PUBLIC_PHONE = "819-388-3407";
const OFFICIAL_PUBLIC_EMAIL = "simonmorin@nowis.store";

function getPublicBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL || DEFAULT_PUBLIC_BASE_URL;
}

function getPublicListingLink(ad: Advertisement) {
  if (!ad.property) {
    return null;
  }
  const listingId = ad.property.rentalUnitId || ad.property.id;
  return `${getPublicBaseUrl()}/logements/${listingId}`;
}

function buildManualPublicationText(ad: Advertisement) {
  if (!ad.property) {
    return ad.title;
  }

  const location = ad.property.district ? `${ad.property.city} - ${ad.property.district}` : ad.property.city;
  const features: string[] = [];
  if (ad.property.petsAllowed) features.push("Animaux acceptes");
  if (ad.property.parking) features.push("Stationnement inclus");
  if (ad.property.inclusions?.trim()) features.push(ad.property.inclusions.trim());
  const link = getPublicListingLink(ad) || getPublicBaseUrl();

  return [
    ad.title,
    `${ad.property.monthlyPrice.toLocaleString("fr-CA")} $ / mois`,
    `${ad.property.bedrooms} chambre${ad.property.bedrooms > 1 ? "s" : ""} · ${ad.property.propertyType}`,
    location,
    features.length > 0 ? `Caracteristiques: ${features.slice(0, 4).join(" · ")}` : null,
    "Demandez votre visite des maintenant.",
    link,
    `Telephone: ${OFFICIAL_PUBLIC_PHONE}`,
    `Courriel: ${OFFICIAL_PUBLIC_EMAIL}`,
  ].filter(Boolean).join("\n");
}

type GroupSuggestionPayload = {
  advertisement: { id: string; title: string; body: string; language: string; status: string };
  suggestions: Array<{
    group: Group;
    suggestion: { groupId: string; warnings: string[]; compatible: boolean };
    existing: { id: string; status: string; publicationUrl: string | null } | null;
  }>;
};

function statusBadgeClass(status: string) {
  if (status === "APPROVED") return "bg-sky-100 text-sky-900";
  if (status === "PUBLISHED") return "bg-emerald-100 text-emerald-900";
  if (status === "FAILED") return "bg-red-100 text-red-900";
  if (status === "MANUAL_ACTION_REQUIRED" || status === "CHANGES_REQUESTED") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-900";
}

export function MarketingApprovalClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [metaStatus, setMetaStatus] = useState<MetaStatus | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [items, setItems] = useState<Advertisement[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAdId, setSelectedAdId] = useState<string | null>(null);
  const [groupSuggestion, setGroupSuggestion] = useState<GroupSuggestionPayload | null>(null);
  const [selectedPagePhotos, setSelectedPagePhotos] = useState<Record<string, string[]>>({});
  const [groupForm, setGroupForm] = useState({ name: "", link: "", city: "", language: "", sectors: "" });
  const [approveAllSummary, setApproveAllSummary] = useState<{ channels: string[]; photoCount: number; incompleteFields: string[]; warnings: string[]; lastPropertyCheck: string | null } | null>(null);

  const selectedAd = useMemo(() => items.find((item) => item.id === selectedAdId) ?? null, [items, selectedAdId]);

  async function copyToClipboard(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setError("Impossible de copier dans le presse-papiers.");
    }
  }

  async function testFacebookConnection() {
    setError(null);
    const response = await fetch("/api/integrations/meta/facebook/diagnostic");
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Diagnostic Facebook impossible.");
      return;
    }
    setMetaStatus(payload);
    setMessage("Diagnostic Facebook termine.");
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [dashboardResponse, metaResponse, queueResponse, groupsResponse] = await Promise.all([
        fetch("/api/marketing/approval/dashboard"),
        fetch("/api/integrations/meta/facebook/status"),
        fetch(`/api/marketing/approval/queue${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""}`),
        fetch("/api/marketing/publications/groups"),
      ]);

      const dashboardData = await dashboardResponse.json();
      const metaData = await metaResponse.json();
      const queueData = await queueResponse.json();
      const groupsData = await groupsResponse.json();

      if (!dashboardResponse.ok || !metaResponse.ok || !queueResponse.ok || !groupsResponse.ok) {
        throw new Error("Impossible de charger le centre d'approbation.");
      }

      setDashboard(dashboardData);
      setMetaStatus(metaData);
      setItems(queueData.items ?? []);
      setGroups(groupsData.items ?? []);

      const photoState: Record<string, string[]> = {};
      for (const ad of queueData.items ?? []) {
        const existing = (ad.selectedPhotos ?? [])
          .filter((item: any) => item.channel === "PAGE" && !item.excluded)
          .sort((a: any, b: any) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)
          .map((item: any) => item.propertyPhotoId);
        if (existing.length > 0) {
          photoState[ad.id] = existing;
        } else if (ad.property?.photos?.length > 0) {
          photoState[ad.id] = ad.property.photos.slice(0, 6).map((photo: any) => photo.id);
        }
      }
      setSelectedPagePhotos(photoState);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erreur inattendue.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  async function withCsrf() {
    const csrf = await fetch("/api/csrf").then((r) => r.json());
    return { "x-csrf-token": csrf.token };
  }

  async function runAction(adId: string, action: "APPROVE" | "REQUEST_CHANGES" | "REJECT" | "CANCEL_APPROVAL" | "MANUAL_REQUIRED") {
    setError(null);
    setMessage(null);
    const notes = window.prompt("Notes (optionnel):") || "";
    const headers = await withCsrf();
    const response = await fetch(`/api/marketing/approval/${adId}/action`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ action, notes }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Action impossible.");
      return;
    }

    setMessage("Action enregistree.");
    await load();
  }

  async function approveAllForProperty(propertyId: string) {
    const headers = await withCsrf();
    const response = await fetch("/api/marketing/approval/approve-all", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ propertyId, confirm: true }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Impossible d'approuver les 6 contenus.");
      return;
    }

    setApproveAllSummary(payload.summary ?? null);
    const confirmed = window.confirm(
      `Confirmer l'approbation explicite des 6 contenus pour ce logement ?\n\nCanaux: ${payload.summary?.channels?.map(formatSummaryLabel).join(", ") || "-"}\nPhotos: ${payload.summary?.photoCount ?? 0}\nChamps incomplets: ${payload.summary?.incompleteFields?.join(", ") || "aucun"}`,
    );
    if (!confirmed) return;

    setMessage(`${payload.approved} contenus approuves pour ce logement.`);
    await load();
  }

  function togglePagePhoto(adId: string, photoId: string) {
    setSelectedPagePhotos((current) => {
      const selected = new Set(current[adId] ?? []);
      if (selected.has(photoId)) {
        selected.delete(photoId);
      } else {
        selected.add(photoId);
      }
      return { ...current, [adId]: Array.from(selected) };
    });
  }

  async function savePagePhotos(ad: Advertisement) {
    const selected = selectedPagePhotos[ad.id] ?? [];
    if (selected.length === 0) {
      setError("Selectionne au moins une photo.");
      return;
    }

    const headers = await withCsrf();
    const response = await fetch(`/api/marketing/approval/${ad.id}/photos`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        channel: "PAGE",
        items: selected.map((propertyPhotoId, index) => ({
          propertyPhotoId,
          sortOrder: index,
          isPrimary: index === 0,
          excluded: false,
        })),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Impossible d'enregistrer les photos.");
      return;
    }

    setMessage("Photos enregistrees pour la publication Page.");
    await load();
  }

  async function publishPage(adId: string) {
    const idempotencyKey = `${adId}-${Date.now()}`;
    const headers = await withCsrf();
    const response = await fetch(`/api/marketing/publications/page/${adId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ idempotencyKey }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Echec publication Facebook Page.");
      return;
    }

    setMessage("Publication Facebook Page reussie.");
    await load();
  }

  async function markMarketplacePublished(adId: string) {
    const publicationUrl = window.prompt("Coller le lien de l'annonce Marketplace publiee:");
    if (!publicationUrl) return;

    const headers = await withCsrf();
    const response = await fetch(`/api/marketing/publications/marketplace/${adId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        publicationUrl,
        checklist: {
          prix: true,
          adresse: true,
          chambres: true,
          disponibilite: true,
          animaux: true,
          stationnement: true,
          photos: true,
          coordonnees: true,
        },
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Impossible d'enregistrer la publication Marketplace.");
      return;
    }

    setMessage("Publication Marketplace enregistree.");
    await load();
  }

  async function loadGroupSuggestions(adId: string) {
    setSelectedAdId(adId);
    setGroupSuggestion(null);
    const response = await fetch(`/api/marketing/publications/group-posts/${adId}/prepare`);
    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Impossible de preparer les groupes.");
      return;
    }
    setGroupSuggestion(payload);
  }

  async function logGroupPublication(adId: string, groupId: string, status: "PUBLISHED" | "MANUAL_ACTION_REQUIRED" | "FAILED") {
    const publicationUrl = status === "PUBLISHED" ? window.prompt("Lien du post dans le groupe:") || "" : "";
    const headers = await withCsrf();
    const response = await fetch(`/api/marketing/publications/group-posts/${adId}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        groupId,
        status,
        publicationUrl: publicationUrl || undefined,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Impossible d'enregistrer la publication groupe.");
      return;
    }

    setMessage("Statut groupe enregistre.");
    await load();
    await loadGroupSuggestions(adId);
  }

  async function disconnectMeta() {
    const headers = await withCsrf();
    const response = await fetch("/api/integrations/meta/facebook/disconnect", {
      method: "POST",
      headers,
    });
    if (!response.ok) {
      setError("Impossible de deconnecter Meta.");
      return;
    }
    setMessage("Connexion Meta retiree.");
    await load();
  }

  async function addGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const headers = await withCsrf();
    const response = await fetch("/api/marketing/publications/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        name: groupForm.name,
        link: groupForm.link,
        city: groupForm.city || undefined,
        language: groupForm.language || undefined,
        sectors: groupForm.sectors.split(",").map((v) => v.trim()).filter(Boolean),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Impossible d'ajouter le groupe.");
      return;
    }

    setGroupForm({ name: "", link: "", city: "", language: "", sectors: "" });
    setMessage("Groupe ajoute.");
    await load();
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Centre d'approbation Facebook</h2>
        <p className="text-sm text-emerald-800">Validation manuelle obligatoire avant publication, puis suivi des canaux Page / Marketplace / Groupes.</p>
      </div>

      <div className="card grid gap-3 p-4 text-sm">
        <h3 className="text-xl font-bold">Connexion Meta (API officielle)</h3>
        <p>Configuration: {metaStatus?.configured ? "Complete" : "Incomplete"}</p>
        <p>Etat: {metaStatus?.connected ? "Connecte" : "Non connecte"}</p>
        <p>Page: {metaStatus?.pageName || "N/A"} {metaStatus?.pageId ? `(${metaStatus.pageId})` : ""}</p>
        <p>Version Graph API: {metaStatus?.graphApiVersion || "N/A"}</p>
        <p>Jeton valide: {metaStatus?.tokenValid ? "Oui" : "Non"}</p>
        <p>Permissions manquantes: {metaStatus?.missingScopes?.length ? metaStatus.missingScopes.join(", ") : "Aucune"}</p>
        {metaStatus?.configIssues?.length ? (
          <div className="rounded-lg bg-amber-100 p-3 text-amber-900">
            {metaStatus.configIssues.map((issue) => (
              <p key={issue}>- {issue}</p>
            ))}
          </div>
        ) : null}
        {metaStatus?.issues?.length ? (
          <div className="rounded-lg bg-amber-100 p-3 text-amber-900">
            {metaStatus.issues.map((issue) => (
              <p key={issue}>- {issue}</p>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <a href="/api/integrations/meta/facebook/connect" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">Connecter Meta</a>
          <a href="/api/integrations/meta/facebook/connect" className="rounded-lg border border-emerald-300 px-4 py-2">Reconnecter la Page Facebook</a>
          <button onClick={testFacebookConnection} className="rounded-lg border border-emerald-300 px-4 py-2">Tester la connexion Facebook</button>
          <button onClick={disconnectMeta} className="rounded-lg border border-emerald-300 px-4 py-2">Deconnecter</button>
        </div>
      </div>

      <div className="card grid gap-3 p-4 text-sm">
        <h3 className="text-xl font-bold">Suivi global</h3>
        <p>Annonces necessitant une action: {dashboard?.needsAction ?? 0}</p>
        <div className="grid gap-2 md:grid-cols-2">
          {(dashboard?.byStatus ?? []).map((row) => (
            <p key={row.status} className="rounded-lg border border-emerald-100 p-2">{row.status}: {row._count._all}</p>
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {Object.entries(dashboard?.byChannel ?? {}).map(([channel, values]) => (
            <div key={channel} className="rounded-lg border border-emerald-100 p-2">
              <p className="font-semibold">{channel}</p>
              <p>Messages: {values.messages}</p>
              <p>Prospects: {values.prospects}</p>
              <p>Visites: {values.visits}</p>
              <p>Placements: {values.placements}</p>
              <p>Commission: {values.commission}$</p>
            </div>
          ))}
        </div>
      </div>

      <div className="card grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-bold">File d'approbation</h3>
          <div className="flex flex-wrap gap-2">
            <select className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Tous les statuts</option>
              <option value="READY_FOR_REVIEW">Pret a reviser</option>
              <option value="APPROVED">Approuvee</option>
              <option value="CHANGES_REQUESTED">Modifications demandees</option>
              <option value="MANUAL_ACTION_REQUIRED">Action manuelle requise</option>
              <option value="FAILED">En erreur</option>
              <option value="PUBLISHED">Publiee</option>
            </select>
          </div>
        </div>

        {loading ? <p className="text-sm">Chargement...</p> : null}

        <div className="grid gap-3">
          {items.map((ad) => (
            <article key={ad.id} className="rounded-xl border border-emerald-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-emerald-900">{ad.type} | {ad.language} | {ad.property?.codeIsr || "Sans ISR"}</p>
                  <h4 className="text-lg font-bold">{ad.title}</h4>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(ad.status)}`}>{ad.status}</span>
              </div>

              <p className="mt-2 text-sm text-emerald-900">{ad.property?.address || "Aucune adresse"} | {ad.property?.monthlyPrice || 0}$</p>
              <p className="mt-2 whitespace-pre-wrap text-sm">{ad.body}</p>

              {ad.approvalWarnings?.length ? (
                <div className="mt-2 rounded-lg bg-amber-100 p-2 text-xs text-amber-900">
                  {ad.approvalWarnings.map((warning) => (
                    <p key={warning}>- {warning}</p>
                  ))}
                </div>
              ) : null}

              {ad.property?.photos?.length ? (
                <div className="mt-3 grid gap-2">
                  <p className="text-xs font-semibold">Photos pour publication Page</p>
                  <div className="grid gap-2 md:grid-cols-3">
                    {ad.property.photos.map((photo) => {
                      const checked = (selectedPagePhotos[ad.id] ?? []).includes(photo.id);
                      return (
                        <label key={photo.id} className="grid gap-1 rounded-lg border border-emerald-200 p-2 text-xs">
                          <div className="flex items-center gap-2">
                            <input type="checkbox" checked={checked} onChange={() => togglePagePhoto(ad.id, photo.id)} />
                            <span>{checked ? "Selectionnee" : "Non selectionnee"}</span>
                          </div>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={photo.description || "Photo logement"} className="h-28 w-full rounded object-cover" />
                        </label>
                      );
                    })}
                  </div>
                  <button className="w-fit rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => savePagePhotos(ad)}>
                    Enregistrer photos Page
                  </button>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg border border-sky-300 px-3 py-2 text-sm" onClick={() => runAction(ad.id, "APPROVE")}>Approuver</button>
                <button className="rounded-lg border border-amber-300 px-3 py-2 text-sm" onClick={() => runAction(ad.id, "REQUEST_CHANGES")}>Demander modifications</button>
                <button className="rounded-lg border border-amber-300 px-3 py-2 text-sm" onClick={() => runAction(ad.id, "MANUAL_REQUIRED")}>Action manuelle requise</button>
                <button className="rounded-lg border border-red-300 px-3 py-2 text-sm" onClick={() => runAction(ad.id, "REJECT")}>Retirer</button>
                {ad.property ? (
                  <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => approveAllForProperty(ad.property!.id)}>
                    Approuver les 6 contenus
                  </button>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white" onClick={() => publishPage(ad.id)} disabled={ad.status !== "APPROVED"}>
                  Publier sur Page Facebook
                </button>
                <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => publishPage(ad.id)}>
                  Reessayer la publication
                </button>
                <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => markMarketplacePublished(ad.id)} disabled={ad.status !== "APPROVED" && ad.status !== "MANUAL_ACTION_REQUIRED"}>
                  Marquer Marketplace publie
                </button>
                <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => loadGroupSuggestions(ad.id)}>
                  Preparer publication Groupes
                </button>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => copyToClipboard(buildManualPublicationText(ad), "Texte copie.")}>Copier le texte</button>
                <button
                  className="rounded-lg border border-emerald-300 px-3 py-2 text-sm"
                  onClick={() => {
                    const link = getPublicListingLink(ad);
                    if (!link) {
                      setError("Lien public indisponible pour cette annonce.");
                      return;
                    }
                    void copyToClipboard(link, "Lien du logement copie.");
                  }}
                >
                  Copier le lien du logement
                </button>
                <button
                  className="rounded-lg border border-emerald-300 px-3 py-2 text-sm"
                  onClick={() => {
                    const link = getPublicListingLink(ad);
                    if (!link) {
                      setError("Lien public indisponible pour cette annonce.");
                      return;
                    }
                    window.open(link, "_blank", "noopener,noreferrer");
                  }}
                >
                  Ouvrir la fiche publique
                </button>
                <button
                  className="rounded-lg border border-emerald-300 px-3 py-2 text-sm"
                  onClick={() => {
                    const pageUrl = metaStatus?.pageId ? `https://www.facebook.com/${metaStatus.pageId}` : "https://www.facebook.com/";
                    window.open(pageUrl, "_blank", "noopener,noreferrer");
                  }}
                >
                  Ouvrir ma Page Facebook
                </button>
              </div>

              {ad.publications.length > 0 ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm font-semibold">Historique publications ({ad.publications.length})</summary>
                  <div className="mt-2 grid gap-1 text-xs">
                    {ad.publications.map((publication) => (
                      <p key={publication.id}>{publication.channel} | {publication.status} | {publication.publicationUrl || "N/A"}{publication.errorMessage ? ` | ${publication.errorMessage}` : ""}</p>
                    ))}
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      </div>

      <div className="card grid gap-3 p-4">
        <h3 className="text-xl font-bold">Repertoire Groupes Facebook</h3>
        <form onSubmit={addGroup} className="grid gap-2 md:grid-cols-2">
          <input className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" placeholder="Nom du groupe" value={groupForm.name} onChange={(event) => setGroupForm((curr) => ({ ...curr, name: event.target.value }))} required />
          <input className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" placeholder="Lien" value={groupForm.link} onChange={(event) => setGroupForm((curr) => ({ ...curr, link: event.target.value }))} required />
          <input className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" placeholder="Ville" value={groupForm.city} onChange={(event) => setGroupForm((curr) => ({ ...curr, city: event.target.value }))} />
          <input className="rounded-lg border border-emerald-200 px-3 py-2 text-sm" placeholder="Langue (fr/en)" value={groupForm.language} onChange={(event) => setGroupForm((curr) => ({ ...curr, language: event.target.value }))} />
          <input className="rounded-lg border border-emerald-200 px-3 py-2 text-sm md:col-span-2" placeholder="Secteurs (separes par virgule)" value={groupForm.sectors} onChange={(event) => setGroupForm((curr) => ({ ...curr, sectors: event.target.value }))} />
          <button className="rounded-lg border border-emerald-300 px-4 py-2 text-sm md:col-span-2">Ajouter le groupe</button>
        </form>

        <div className="grid gap-2 text-sm">
          {groups.map((group) => (
            <div key={group.id} className="rounded-lg border border-emerald-100 p-2">
              <p className="font-semibold">{group.name}</p>
              <p>{group.city || "Ville N/A"} | {group.language || "Langue N/A"} | Delai min: {group.minDelayHours}h</p>
              <a href={group.link} target="_blank" rel="noreferrer" className="text-emerald-700 underline">Ouvrir le groupe</a>
            </div>
          ))}
        </div>
      </div>

      {selectedAd && groupSuggestion ? (
        <div className="card grid gap-3 p-4">
          <h3 className="text-xl font-bold">Preparation groupes: {selectedAd.title}</h3>
          <div className="grid gap-2 text-sm">
            {groupSuggestion.suggestions.map((item) => (
              <div key={item.group.id} className="rounded-lg border border-emerald-200 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{item.group.name}</p>
                    <p className="text-xs text-emerald-900">{item.group.city || "Ville N/A"} | {item.group.language || "Langue N/A"}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.suggestion.compatible ? "bg-emerald-100 text-emerald-900" : "bg-amber-100 text-amber-900"}`}>
                    {item.suggestion.compatible ? "Compatible" : "Verifier"}
                  </span>
                </div>
                {item.suggestion.warnings.length > 0 ? (
                  <div className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">
                    {item.suggestion.warnings.map((warning) => (
                      <p key={warning}>- {warning}</p>
                    ))}
                  </div>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={item.group.link} target="_blank" rel="noreferrer" className="rounded-lg border border-emerald-300 px-3 py-2 text-xs">Ouvrir</a>
                  <button className="rounded-lg border border-emerald-300 px-3 py-2 text-xs" onClick={() => logGroupPublication(selectedAd.id, item.group.id, "MANUAL_ACTION_REQUIRED")}>Marquer en attente</button>
                  <button className="rounded-lg border border-emerald-300 px-3 py-2 text-xs" onClick={() => logGroupPublication(selectedAd.id, item.group.id, "PUBLISHED")}>Marquer publie</button>
                  <button className="rounded-lg border border-red-300 px-3 py-2 text-xs" onClick={() => logGroupPublication(selectedAd.id, item.group.id, "FAILED")}>Marquer erreur</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
    </section>
  );
}
