import { redirect } from "next/navigation";

export default async function PublicCatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/logements/${id}`);
}
