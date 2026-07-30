"use client";

import { useEffect, useMemo, useState } from "react";

type PreparationPayload = {
  advertisementId: string;
  title: string;
  status: string;
  property: {
    id: string;
    rentalUnitId: string | null;
    city: string;
    district: string | null;
    monthlyPrice: number;
    bedrooms: number;
    propertyType: string;
    inclusions: string | null;
    petsAllowed: boolean;
    petsDetails: string | null;
    parking: boolean;
    availableFrom: string | null;
    status: string;
  };
  publicUrl: string;
  generatedText: string;
  photos: Array<{ id: string; url: string; description: string | null; sortOrder: number }>;
  selectedPhotoIds: string[];
};

function formatAvailability(value: string | null) {
  if (!value) return "Disponible des maintenant";
  return `Disponible des le ${new Date(value).toLocaleDateString("fr-CA")}`;
}

export function MarketplacePreparationClient({ advertisementId }: { advertisementId: string }) {
  const [item, setItem] = useState<PreparationPayload | null>(null);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedCount = selectedPhotoIds.length;
  const selectedPhotos = useMemo(() => {
    if (!item) return [] as PreparationPayload["photos"];
    const byId = new Map(item.photos.map((photo) => [photo.id, photo]));
    return selectedPhotoIds.map((id) => byId.get(id)).filter(Boolean) as PreparationPayload["photos"];
  }, [item, selectedPhotoIds]);

  async function withCsrfHeaders() {
    const csrf = await fetch("/api/csrf").then((response) => response.json());
    return { "Content-Type": "application/json", "x-csrf-token": csrf.token };
  }

  async function load() {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(`/api/marketing/marketplace/${advertisementId}/prepare`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.error || "Impossible de charger la preparation Marketplace.");
        setLoading(false);
        return;
      }

      const prepared = payload.item as PreparationPayload;
      setItem(prepared);
      const defaults = prepared.selectedPhotoIds.length > 0
        ? prepared.selectedPhotoIds
        : prepared.photos.slice(0, 20).map((photo) => photo.id);
      setSelectedPhotoIds(defaults.slice(0, 20));
      setText(prepared.generatedText);
    } catch {
      setError("Impossible de charger la preparation Marketplace.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [advertisementId]);

  function togglePhoto(photoId: string) {
    setSelectedPhotoIds((current) => {
      if (current.includes(photoId)) {
        return current.filter((id) => id !== photoId);
      }
      if (current.length >= 20) {
        setError("Tu peux preparer au maximum 20 photos.");
        return current;
      }
      return [...current, photoId];
    });
  }

  function movePhoto(photoId: string, direction: -1 | 1) {
    setSelectedPhotoIds((current) => {
      const index = current.indexOf(photoId);
      if (index < 0) return current;
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  function selectAll() {
    if (!item) return;
    const ids = item.photos.map((photo) => photo.id).slice(0, 20);
    setSelectedPhotoIds(ids);
  }

  function deselectAll() {
    setSelectedPhotoIds([]);
  }

  async function copyDescription() {
    try {
      await navigator.clipboard.writeText(text);
      setNotice("La description Marketplace a ete copiee.");
      setError(null);
    } catch {
      setError("Impossible de copier la description.");
    }
  }

  async function copyPublicUrl() {
    if (!item) return;
    try {
      await navigator.clipboard.writeText(item.publicUrl);
      setNotice("Le lien public a ete copie.");
      setError(null);
    } catch {
      setError("Impossible de copier le lien public.");
    }
  }

  function downloadPhoto(photo: PreparationPayload["photos"][number], index: number) {
    const link = document.createElement("a");
    link.href = photo.url;
    const ext = photo.url.toLowerCase().endsWith(".png") ? "png" : photo.url.toLowerCase().endsWith(".webp") ? "webp" : "jpg";
    link.download = `${String(index + 1).padStart(2, "0")}-photo.${ext}`;
    link.rel = "noopener noreferrer";
    link.target = "_blank";
    link.click();
  }

  function downloadAllSelectedPhotos() {
    selectedPhotos.forEach((photo, index) => {
      downloadPhoto(photo, index);
    });
  }

  async function downloadKit() {
    if (!item) return;
    if (selectedPhotoIds.length === 0) {
      setError("Aucune photo n'a ete selectionnee.");
      return;
    }

    if (!text.trim()) {
      setError("Le texte de l'annonce est vide.");
      return;
    }

    setDownloading(true);
    setError(null);
    setNotice(null);

    try {
      const headers = await withCsrfHeaders();
      const response = await fetch(`/api/marketing/marketplace/${advertisementId}/package`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderedPhotoIds: selectedPhotoIds,
          finalText: text,
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ error: "Le kit Marketplace n'a pas pu etre cree." }));
        setError(payload.error || "Le kit Marketplace n'a pas pu etre cree.");
        return;
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const disposition = response.headers.get("content-disposition") || "";
      const fileNameMatch = disposition.match(/filename=\"?([^\"]+)\"?/i);
      const fileName = fileNameMatch?.[1] || `marketplace-logement-${advertisementId}.zip`;

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);

      if (response.headers.get("x-marketplace-photo-warning") === "1") {
        setNotice("Une ou plusieurs photos n'ont pas pu etre ajoutees au kit.");
      } else {
        setNotice("Le kit Marketplace a ete telecharge.");
      }

      await load();
    } catch {
      setError("Le kit Marketplace n'a pas pu etre cree.");
    } finally {
      setDownloading(false);
    }
  }

  async function confirmManualPublication() {
    const publicationUrl = window.prompt("URL Marketplace (optionnelle):") || "";
    const publishedAtRaw = window.prompt("Date de publication (optionnelle, format ISO):") || "";
    const notes = window.prompt("Notes (optionnelles):") || "";
    const expiresAtRaw = window.prompt("Date d'expiration prevue (optionnelle, format ISO):") || "";

    const headers = await withCsrfHeaders();
    const response = await fetch(`/api/marketing/marketplace/${advertisementId}/manual-confirm`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        publicationUrl,
        publishedAt: publishedAtRaw || undefined,
        notes,
        expiresAt: expiresAtRaw || undefined,
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      setError(payload.error || "Confirmation Marketplace impossible.");
      return;
    }

    setNotice("Publiee manuellement sur Marketplace.");
    await load();
  }

  if (loading) {
    return <section className="grid gap-3"><p className="text-sm">Chargement de la preparation Marketplace...</p></section>;
  }

  if (!item) {
    return <section className="grid gap-3"><p className="text-sm text-red-700">Annonce introuvable.</p></section>;
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Preparer pour Marketplace</h2>
        <p className="text-sm text-emerald-800">Aucune publication automatique n'est envoyee a Marketplace. Ce module cree un kit telechargeable.</p>
      </div>

      <div className="card grid gap-2 p-4 text-sm">
        <p><strong>Titre:</strong> {item.title}</p>
        <p><strong>Prix:</strong> {item.property.monthlyPrice.toLocaleString("fr-CA")} $</p>
        <p><strong>Chambres:</strong> {item.property.bedrooms}</p>
        <p><strong>Type:</strong> {item.property.propertyType}</p>
        <p><strong>Ville/Secteur:</strong> {item.property.city}{item.property.district ? ` - ${item.property.district}` : ""}</p>
        <p><strong>Disponibilite:</strong> {formatAvailability(item.property.availableFrom)}</p>
        <p><strong>Inclusions:</strong> {item.property.inclusions || "A confirmer"}</p>
        <p><strong>Animaux:</strong> {item.property.petsAllowed ? (item.property.petsDetails || "Selon les conditions") : "Non acceptes"}</p>
        <p><strong>Stationnement:</strong> {item.property.parking ? "Oui" : "Non"}</p>
        <p>
          <strong>Lien fiche publique:</strong>{" "}
          <a href={item.publicUrl} target="_blank" rel="noreferrer" className="underline text-emerald-700">{item.publicUrl}</a>
        </p>
      </div>

      <div className="card grid gap-3 p-4">
        <label className="grid gap-1 text-sm">
          <span className="font-semibold">Texte Marketplace (modifiable avant creation du kit)</span>
          <textarea
            className="min-h-72 w-full rounded-lg border border-emerald-200 px-3 py-2"
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-2">
          <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={copyDescription}>Copier la description</button>
          <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={copyPublicUrl}>Copier le lien public</button>
          <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={() => window.open("https://www.facebook.com/marketplace/create/rental", "_blank", "noopener,noreferrer")}>Ouvrir Marketplace</button>
        </div>
      </div>

      <div className="card grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-bold">Photos selectionnees ({selectedCount}/20)</h3>
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={selectAll}>Tout selectionner</button>
            <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={deselectAll}>Tout deselectionner</button>
            <button className="rounded-lg border border-emerald-300 px-3 py-2 text-sm" onClick={downloadAllSelectedPhotos} disabled={selectedCount === 0}>Telecharger les photos</button>
          </div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {item.photos.map((photo) => {
            const checked = selectedPhotoIds.includes(photo.id);
            const order = checked ? selectedPhotoIds.indexOf(photo.id) + 1 : null;
            return (
              <div key={photo.id} className="grid gap-2 rounded-lg border border-emerald-200 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={checked} onChange={() => togglePhoto(photo.id)} />
                    <span>{checked ? "Selectionnee" : "Non selectionnee"}</span>
                  </label>
                  {order ? <span className="rounded bg-emerald-100 px-2 py-1 font-semibold">#{order}{order === 1 ? " principale" : ""}</span> : null}
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.description || "Photo"} className="h-36 w-full rounded object-cover" />
                <div className="flex flex-wrap gap-1">
                  <button className="rounded border border-emerald-200 px-2 py-1" onClick={() => window.open(photo.url, "_blank", "noopener,noreferrer")}>Apercu</button>
                  <button className="rounded border border-emerald-200 px-2 py-1" onClick={() => downloadPhoto(photo, Math.max(0, (order || 1) - 1))}>Telecharger</button>
                  <button className="rounded border border-emerald-200 px-2 py-1" onClick={() => movePhoto(photo.id, -1)} disabled={!checked || order === 1}>Haut</button>
                  <button className="rounded border border-emerald-200 px-2 py-1" onClick={() => movePhoto(photo.id, 1)} disabled={!checked || order === selectedCount}>Bas</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <button className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-white" onClick={downloadKit} disabled={downloading}>
          {downloading ? "Creation du kit..." : "Telecharger le kit Marketplace"}
        </button>
        <button className="w-full rounded-lg border border-emerald-300 px-4 py-3 text-sm" onClick={confirmManualPublication}>
          J'ai publie sur Marketplace
        </button>
      </div>

      {error ? <p className="text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="text-sm font-semibold text-emerald-700">{notice}</p> : null}
    </section>
  );
}
