import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getCurrentUser, hasAnyAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AdminEntryPage() {
  const adminExists = await hasAnyAdmin();
  if (!adminExists) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/admin");
  }

  redirect("/dashboard");
}
