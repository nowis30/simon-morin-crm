import { MarketplacePreparationClient } from "@/components/marketplace-preparation-client";

export default async function MarketplacePreparationPage({ params }: { params: Promise<{ advertisementId: string }> }) {
  const { advertisementId } = await params;
  return <MarketplacePreparationClient advertisementId={advertisementId} />;
}
