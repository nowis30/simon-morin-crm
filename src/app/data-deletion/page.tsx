import { env } from "@/lib/env";

export const metadata = {
  title: "Suppression des données - Simon Morin - Agent de location",
};

export default function DataDeletionPage() {
  const contactEmail = env.PUBLIC_CONTACT_EMAIL || "contact@example.com";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-4 px-4 py-5 text-sm text-slate-800 md:gap-6 md:py-10">
      <section className="card p-4 md:p-6">
        <h1 className="font-[family-name:var(--font-barlow-condensed)] text-3xl font-bold leading-tight md:text-4xl">Demande de suppression de données</h1>
        <p className="mt-3">Vous pouvez demander la suppression de vos renseignements à tout moment.</p>
      </section>

      <section className="card p-4 md:p-6">
        <h2 className="text-xl font-semibold">Ce qu’il faut envoyer</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Votre nom et votre adresse courriel.</li>
          <li>Une description de la demande de suppression.</li>
          <li>Le type de données concernées, si connu.</li>
          <li>Un identifiant utile si vous avez déjà interagi avec l’application.</li>
        </ul>
      </section>

      <section className="card p-4 md:p-6">
        <h2 className="text-xl font-semibold">Délai indicatif</h2>
        <p className="mt-3">Nous traitons les demandes dans les meilleurs délais et nous pouvons conserver certaines données si la loi l’exige, notamment pour des obligations comptables ou de sécurité.</p>
      </section>

      <section className="card p-4 md:p-6">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="mt-3">Écrivez à <a href={`mailto:${contactEmail}`} className="text-emerald-700 underline">{contactEmail}</a> pour soumettre votre demande.</p>
      </section>
    </main>
  );
}
