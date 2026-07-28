import { PrismaClient, PropertyStatus, ProspectStatus, VisitStatus, CommissionStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("AdminTemp123!", 12);

  await prisma.user.upsert({
    where: { email: "demo.admin@fictif.local" },
    update: {},
    create: {
      email: "demo.admin@fictif.local",
      name: "Administrateur DEMO FICTIF",
      passwordHash,
    },
  });

  const properties = await Promise.all(
    [
      {
        codeIsr: "DEMO-ISR-001",
        address: "101 Rue Fictive",
        city: "Québec",
        district: "Limoilou",
        monthlyPrice: 1250,
        propertyType: "Appartement",
        bedrooms: 2,
        descriptionFr: "LOGEMENT FICTIF 1 - Ne pas utiliser en production.",
        descriptionEn: "FAKE UNIT 1 - Do not use in production.",
      },
      {
        codeIsr: "DEMO-ISR-002",
        address: "202 Avenue Démo",
        city: "Lévis",
        district: "Desjardins",
        monthlyPrice: 1100,
        propertyType: "Condo",
        bedrooms: 1,
        descriptionFr: "LOGEMENT FICTIF 2 - Ne pas utiliser en production.",
        descriptionEn: "FAKE UNIT 2 - Do not use in production.",
      },
      {
        codeIsr: "DEMO-ISR-003",
        address: "303 Boulevard Simulation",
        city: "Québec",
        district: "Sainte-Foy",
        monthlyPrice: 1650,
        propertyType: "Appartement",
        bedrooms: 3,
        descriptionFr: "LOGEMENT FICTIF 3 - Ne pas utiliser en production.",
        descriptionEn: "FAKE UNIT 3 - Do not use in production.",
      },
      {
        codeIsr: "DEMO-ISR-004",
        address: "404 Chemin Test",
        city: "Québec",
        district: "Charlesbourg",
        monthlyPrice: 950,
        propertyType: "Studio",
        bedrooms: 0,
        descriptionFr: "LOGEMENT FICTIF 4 - Ne pas utiliser en production.",
        descriptionEn: "FAKE UNIT 4 - Do not use in production.",
      },
      {
        codeIsr: "DEMO-ISR-005",
        address: "505 Place Exemple",
        city: "Lévis",
        district: "Saint-Romuald",
        monthlyPrice: 1400,
        propertyType: "Appartement",
        bedrooms: 2,
        descriptionFr: "LOGEMENT FICTIF 5 - Ne pas utiliser en production.",
        descriptionEn: "FAKE UNIT 5 - Do not use in production.",
      },
    ].map((p) =>
      prisma.property.upsert({
        where: { codeIsr: p.codeIsr },
        update: {},
        create: {
          ...p,
          petsAllowed: true,
          petsDetails: "Chats autorisés (jeu de données fictif).",
          parking: true,
          inclusions: "Chauffage (fictif)",
          status: PropertyStatus.AVAILABLE,
        },
      }),
    ),
  );

  const prospects = await Promise.all(
    [
      {
        name: "Prospect FICTIF A",
        phone: "555-000-0001",
        email: "prospect.a@fictif.local",
        preferredLanguage: "fr",
        maxBudget: 1300,
        preferredDistricts: ["Limoilou", "Sainte-Foy"],
        bedroomsNeeded: 2,
        hasPets: true,
        needsParking: true,
      },
      {
        name: "Prospect FICTIF B",
        phone: "555-000-0002",
        email: "prospect.b@fictif.local",
        preferredLanguage: "en",
        maxBudget: 1600,
        preferredDistricts: ["Charlesbourg"],
        bedroomsNeeded: 1,
        hasPets: false,
        needsParking: false,
      },
      {
        name: "Prospect FICTIF C",
        phone: "555-000-0003",
        email: "prospect.c@fictif.local",
        preferredLanguage: "fr",
        maxBudget: 1800,
        preferredDistricts: ["Desjardins", "Saint-Romuald"],
        bedroomsNeeded: 3,
        hasPets: true,
        needsParking: true,
      },
    ].map((p, index) =>
      prisma.prospect.upsert({
        where: { id: `seed-prospect-${index}` },
        update: {},
        create: {
          id: `seed-prospect-${index}`,
          ...p,
          status: ProspectStatus.NEW,
          firstContactPropertyId: properties[index % properties.length].id,
        },
      }),
    ),
  );

  const visit1 = await prisma.visit.create({
    data: {
      prospectId: prospects[0].id,
      propertyId: properties[0].id,
      startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: VisitStatus.PENDING_APPROVAL,
      notes: "VISITE FICTIVE EN ATTENTE",
    },
  });

  await prisma.visit.create({
    data: {
      prospectId: prospects[1].id,
      propertyId: properties[1].id,
      startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000),
      status: VisitStatus.CONFIRMED,
      approvedAt: new Date(),
      notes: "VISITE FICTIVE CONFIRMEE",
    },
  });

  const placement = await prisma.placement.create({
    data: {
      prospectId: prospects[2].id,
      propertyId: properties[2].id,
      visitId: visit1.id,
      visitDate: visit1.startsAt,
      notes: "PLACEMENT FICTIF",
    },
  });

  await prisma.commission.create({
    data: {
      placementId: placement.id,
      plannedAmount: 500,
      status: CommissionStatus.PLANNED,
      notes: "COMMISSION FICTIVE",
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });