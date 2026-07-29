import { env } from "@/lib/env";

export const metadata = {
  title: "Politique de confidentialité - Simon Morin - Agent de location",
};

export default function PrivacyPage() {
  const contactEmail = env.PUBLIC_CONTACT_EMAIL || "contact@example.com";

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-4 py-10 text-sm text-slate-800">
      <section className="card p-6">
        <h1 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Politique de confidentialité</h1>
        <p className="mt-3">Cette application, Simon Morin - Agent de location, traite des données nécessaires à la gestion des logements, des prospects, des visites et des campagnes marketing.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Données traitées</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Coordonnées d’utilisateur et informations de connexion.</li>
          <li>Informations sur les logements, leurs photos et leurs disponibilités.</li>
          <li>Coordonnées et notes des prospects.</li>
          <li>Historique des visites et placements.</li>
          <li>Données nécessaires à la publication marketing, y compris les contenus approuvés et les liens de publication.</li>
          <li>Informations de connexion Facebook et Meta lorsque l’admin les connecte.</li>
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Utilisation des données Facebook</h2>
        <p className="mt-3">Lorsque l’administrateur connecte la page Facebook, le CRM peut utiliser les permissions nécessaires pour préparer et publier des contenus sur la Page Facebook via l’API officielle Meta. Les jetons sont chiffrés et stockés de manière sécurisée.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Données provenant des prospects</h2>
        <p className="mt-3">Les données des prospects sont utilisées pour la gestion des correspondances, l’organisation des visites et le suivi des placements. Elles ne sont pas partagées publiquement et sont conservées uniquement pour les besoins opérationnels du CRM.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Raisons de la collecte</h2>
        <p className="mt-3">Les données sont collectées pour permettre la gestion locative, les communications avec les prospects, la planification des visites et la coordination des publications marketing.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Conservation et sécurité</h2>
        <p className="mt-3">Les données sont conservées le temps nécessaire à l’exploitation du CRM et aux obligations légales applicables. Les données sensibles sont chiffrées, les accès sont protégés par authentification et les secrets ne sont jamais exposés au navigateur.</p>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Fournisseurs utilisés</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6">
          <li>Render pour l’hébergement.</li>
          <li>PostgreSQL pour le stockage des données.</li>
          <li>Google pour l’intégration du calendrier, si activée.</li>
          <li>Meta/Facebook pour l’intégration de publication de Page, si activée.</li>
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-semibold">Suppression de données</h2>
        <p className="mt-3">Pour demander la suppression de vos renseignements, utilisez la page de suppression des données ou écrivez à <a href={`mailto:${contactEmail}`} className="text-emerald-700 underline">{contactEmail}</a>.</p>
      </section>
    </main>
  );
}
