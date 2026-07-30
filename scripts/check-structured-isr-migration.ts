import { prisma } from "../src/lib/prisma";

type RegClassRow = { table_name: string | null };

async function main() {
  const [propertyCount, photoCount, prospectCount, visitCount, placementCount, commissionCount, advertisementCount] = await Promise.all([
    prisma.property.count(),
    prisma.propertyPhoto.count(),
    prisma.prospect.count(),
    prisma.visit.count(),
    prisma.placement.count(),
    prisma.commission.count(),
    prisma.advertisement.count(),
  ]);

  const [buildingTable, rentalUnitTable, propertyBuildingLinks, propertyRentalLinks] = await Promise.all([
    prisma.$queryRawUnsafe<RegClassRow[]>('SELECT to_regclass(\'public."Building"\') AS table_name'),
    prisma.$queryRawUnsafe<RegClassRow[]>('SELECT to_regclass(\'public."RentalUnit"\') AS table_name'),
    prisma.property.count({ where: { buildingId: { not: null } } }),
    prisma.property.count({ where: { rentalUnitId: { not: null } } }),
  ]);

  const issues: string[] = [];
  if (!buildingTable[0]?.table_name) issues.push("Table Building absente");
  if (!rentalUnitTable[0]?.table_name) issues.push("Table RentalUnit absente");
  if (propertyCount > 0 && propertyBuildingLinks === 0) issues.push("Aucune liaison Property -> Building detectee");
  if (propertyCount > 0 && propertyRentalLinks === 0) issues.push("Aucune liaison Property -> RentalUnit detectee");

  const summary = {
    propertyCount,
    photoCount,
    prospectCount,
    visitCount,
    placementCount,
    commissionCount,
    advertisementCount,
    buildingTableExists: Boolean(buildingTable[0]?.table_name),
    rentalUnitTableExists: Boolean(rentalUnitTable[0]?.table_name),
    propertyBuildingLinks,
    propertyRentalLinks,
    issues,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
