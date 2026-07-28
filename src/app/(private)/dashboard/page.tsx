import { PropertyStatus, ProspectStatus, VisitStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function MetricCard({ title, value }: { title: string; value: number | string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-emerald-800">{title}</p>
      <p className="mt-2 font-[family-name:var(--font-barlow-condensed)] text-3xl font-bold">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    logementsDisponibles,
    logementsVisitePrevue,
    nouveauxProspects,
    prospectsARappeler,
    visitesAttente,
    visitesConfirmees,
    logementsLouesMois,
    commissions,
  ] = await Promise.all([
    prisma.property.count({ where: { status: PropertyStatus.AVAILABLE } }),
    prisma.property.count({ where: { status: PropertyStatus.VISIT_SCHEDULED } }),
    prisma.prospect.count({ where: { status: ProspectStatus.NEW } }),
    prisma.prospect.count({ where: { status: ProspectStatus.TO_CONTACT } }),
    prisma.visit.count({ where: { status: VisitStatus.PENDING_APPROVAL } }),
    prisma.visit.count({ where: { status: VisitStatus.CONFIRMED } }),
    prisma.property.count({ where: { status: PropertyStatus.RENTED, updatedAt: { gte: monthStart } } }),
    prisma.commission.findMany(),
  ]);

  const commissionsPrevues = commissions.reduce((sum, c) => sum + c.plannedAmount, 0);
  const commissionsFacturees = commissions.reduce((sum, c) => sum + (c.invoicedAmount ?? 0), 0);
  const commissionsRecues = commissions.reduce((sum, c) => sum + (c.receivedAmount ?? 0), 0);

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="font-[family-name:var(--font-barlow-condensed)] text-4xl font-bold">Tableau de bord</h2>
        <p className="text-sm text-emerald-800">Suivi operationnel global</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Logements disponibles" value={logementsDisponibles} />
        <MetricCard title="Logements avec visite prevue" value={logementsVisitePrevue} />
        <MetricCard title="Nouveaux prospects" value={nouveauxProspects} />
        <MetricCard title="Prospects a rappeler" value={prospectsARappeler} />
        <MetricCard title="Visites en attente d'approbation" value={visitesAttente} />
        <MetricCard title="Visites confirmees" value={visitesConfirmees} />
        <MetricCard title="Logements loues ce mois-ci" value={logementsLouesMois} />
        <MetricCard title="Commissions prevues" value={`${commissionsPrevues}$`} />
        <MetricCard title="Commissions facturees" value={`${commissionsFacturees}$`} />
        <MetricCard title="Commissions recues" value={`${commissionsRecues}$`} />
        <MetricCard title="Commissions a recevoir" value={`${commissionsPrevues - commissionsRecues}$`} />
      </div>
    </section>
  );
}
