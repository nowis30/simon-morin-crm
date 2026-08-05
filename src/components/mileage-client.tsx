"use client";

import { useEffect, useState } from "react";

type Trip = {
  id: string;
  tripDate: string;
  originAddress: string;
  destinationAddress: string;
  purpose: string;
  oneWayKm: number;
  businessKm: number;
  roundTrip: boolean;
  parkingAmount: number;
  tollAmount: number;
  distanceSource: string;
};

type Summary = {
  businessKm: number;
  totalKm: number;
  businessUsePercent: number;
  vehicleExpenses: number;
  parkingAndTolls: number;
  estimatedTotalDeduction: number;
};

const currentYear = new Date().getFullYear();

export function MileageClient() {
  const [year, setYear] = useState(currentYear);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [homeAddress, setHomeAddress] = useState("");
  const [vehicleDescription, setVehicleDescription] = useState("");
  const [roundTrip, setRoundTrip] = useState(true);
  const [oneWayKm, setOneWayKm] = useState("");
  const [distanceSource, setDistanceSource] = useState("MANUAL");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  async function load(selectedYear = year) {
    const response = await fetch(`/api/mileage?year=${selectedYear}`);
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Impossible de charger le registre.");
      return;
    }
    setTrips(data.trips || []);
    setSummary(data.summary || null);
    setHomeAddress(data.settings?.homeAddress || "");
    setVehicleDescription(data.settings?.vehicleDescription || "");
    setRoundTrip(data.settings?.defaultRoundTrip ?? true);
  }

  useEffect(() => {
    void load(year);
  }, [year]);

  async function csrfToken() {
    const data = await fetch("/api/csrf").then((response) => response.json());
    return data.token as string;
  }

  async function calculateDistance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/mileage/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": await csrfToken() },
      body: JSON.stringify({
        originAddress: form.get("originAddress"),
        destinationAddress: form.get("destinationAddress"),
        roundTrip,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Calcul impossible.");
      return;
    }
    setOneWayKm(String(data.oneWayKm));
    setDistanceSource(data.source || "GOOGLE_ROUTES");
    setNotice(`Distance calculée : ${data.oneWayKm} km aller, ${data.businessKm} km d'affaires.`);
  }

  async function saveTrip(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/mileage", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-csrf-token": await csrfToken() },
      body: JSON.stringify({
        tripDate: new Date(String(form.get("tripDate"))).toISOString(),
        originAddress: form.get("originAddress"),
        destinationAddress: form.get("destinationAddress"),
        purpose: form.get("purpose"),
        oneWayKm: Number(oneWayKm),
        roundTrip,
        parkingAmount: Number(form.get("parkingAmount") || 0),
        tollAmount: Number(form.get("tollAmount") || 0),
        distanceSource,
        notes: form.get("notes") || "",
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Enregistrement impossible.");
      return;
    }
    setNotice(`Déplacement enregistré : ${data.businessKm} km d'affaires.`);
    setOneWayKm("");
    event.currentTarget.reset();
    await load(year);
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name) || 0);
    const response = await fetch("/api/mileage/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-csrf-token": await csrfToken() },
      body: JSON.stringify({
        homeAddress,
        vehicleDescription,
        defaultRoundTrip: roundTrip,
        year,
        openingOdometerKm: number("openingOdometerKm"),
        closingOdometerKm: number("closingOdometerKm"),
        fuelAmount: number("fuelAmount"),
        insuranceAmount: number("insuranceAmount"),
        registrationAmount: number("registrationAmount"),
        maintenanceAmount: number("maintenanceAmount"),
        interestAmount: number("interestAmount"),
        leaseAmount: number("leaseAmount"),
        otherAmount: number("otherAmount"),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Sauvegarde impossible.");
      return;
    }
    setNotice("Paramètres fiscaux enregistrés.");
    await load(year);
  }

  return (
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-barlow-condensed)] text-3xl font-bold md:text-4xl">Kilométrage et impôts</h2>
          <p className="text-sm text-emerald-800">Registre des déplacements d'affaires, dépenses du véhicule et export pour le comptable.</p>
        </div>
        <label className="grid gap-1 text-sm font-semibold">
          Année
          <input type="number" min="2020" max="2100" value={year} onChange={(event) => setYear(Number(event.target.value))} className="rounded-lg border border-emerald-200 px-3 py-2" />
        </label>
      </div>

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {notice ? <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Km d'affaires" value={`${summary?.businessKm?.toFixed(1) || "0.0"} km`} />
        <Metric label="Km totaux" value={`${summary?.totalKm?.toFixed(1) || "0.0"} km`} />
        <Metric label="Usage affaires" value={`${summary?.businessUsePercent?.toFixed(2) || "0.00"} %`} />
        <Metric label="Déduction estimée" value={`${summary?.estimatedTotalDeduction?.toFixed(2) || "0.00"} $`} />
      </div>

      <form onSubmit={saveTrip} className="card grid min-w-0 gap-3 p-4 md:grid-cols-2">
        <h3 className="text-xl font-bold md:col-span-2">Ajouter un déplacement</h3>
        <input name="tripDate" type="datetime-local" required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="purpose" placeholder="Raison : visite d'un logement, remise de clés..." required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="originAddress" defaultValue={homeAddress} placeholder="Adresse de départ" required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="destinationAddress" placeholder="Adresse du logement" required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={roundTrip} onChange={(event) => setRoundTrip(event.target.checked)} /> Aller-retour</label>
        <input value={oneWayKm} onChange={(event) => { setOneWayKm(event.target.value); setDistanceSource("MANUAL"); }} type="number" min="0.1" step="0.1" placeholder="Distance aller en km" required className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="parkingAmount" type="number" min="0" step="0.01" placeholder="Stationnement $" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <input name="tollAmount" type="number" min="0" step="0.01" placeholder="Péages $" className="rounded-lg border border-emerald-200 px-3 py-3" />
        <textarea name="notes" placeholder="Notes facultatives" className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" />
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button type="button" onClick={(event) => void calculateDistance(event as unknown as React.FormEvent<HTMLFormElement>)} className="rounded-lg border border-emerald-300 bg-white px-4 py-3 text-sm font-semibold">Calculer avec Google</button>
          <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white">Enregistrer le déplacement</button>
        </div>
      </form>

      <form onSubmit={saveSettings} className="card grid min-w-0 gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
        <h3 className="text-xl font-bold md:col-span-2 xl:col-span-4">Véhicule et dépenses annuelles</h3>
        <input value={homeAddress} onChange={(event) => setHomeAddress(event.target.value)} placeholder="Adresse de départ habituelle" required className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" />
        <input value={vehicleDescription} onChange={(event) => setVehicleDescription(event.target.value)} placeholder="Véhicule : marque, modèle, plaque" className="rounded-lg border border-emerald-200 px-3 py-3 md:col-span-2" />
        {[
          ["openingOdometerKm", "Odomètre début d'année"], ["closingOdometerKm", "Odomètre fin d'année"],
          ["fuelAmount", "Essence $"], ["insuranceAmount", "Assurances $"], ["registrationAmount", "Immatriculation $"],
          ["maintenanceAmount", "Entretien/réparations $"], ["interestAmount", "Intérêts auto $"], ["leaseAmount", "Location auto $"], ["otherAmount", "Autres dépenses $"],
        ].map(([name, placeholder]) => <input key={name} name={name} type="number" min="0" step="0.01" placeholder={placeholder} className="rounded-lg border border-emerald-200 px-3 py-3" />)}
        <button className="rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white xl:col-span-4">Enregistrer les données annuelles</button>
      </form>

      <div className="card grid gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl font-bold">Registre {year}</h3>
          <a href={`/api/mileage/export?year=${year}`} className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold">Exporter CSV</a>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead><tr className="border-b"><th className="p-2">Date</th><th className="p-2">Destination</th><th className="p-2">Raison</th><th className="p-2">Km affaires</th><th className="p-2">Frais directs</th><th className="p-2">Source</th></tr></thead>
            <tbody>{trips.map((trip) => <tr key={trip.id} className="border-b border-emerald-50"><td className="p-2">{new Date(trip.tripDate).toLocaleDateString("fr-CA")}</td><td className="p-2">{trip.destinationAddress}</td><td className="p-2">{trip.purpose}</td><td className="p-2">{Number(trip.businessKm).toFixed(1)}</td><td className="p-2">{(Number(trip.parkingAmount) + Number(trip.tollAmount)).toFixed(2)} $</td><td className="p-2">{trip.distanceSource}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="card min-w-0 p-4"><p className="text-sm text-emerald-800">{label}</p><p className="mt-2 break-words text-2xl font-bold">{value}</p></div>;
}
