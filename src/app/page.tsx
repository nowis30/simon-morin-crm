import { redirect } from "next/navigation";
import { getCurrentUser, hasAnyAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Home() {
  const adminExists = await hasAnyAdmin();

  if (!adminExists) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  redirect("/dashboard");
}
