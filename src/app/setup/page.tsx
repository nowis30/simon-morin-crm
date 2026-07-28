import { redirect } from "next/navigation";
import { SetupForm } from "@/components/auth/setup-form";
import { getCurrentUser, hasAnyAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const adminExists = await hasAnyAdmin();
  if (adminExists) {
    const user = await getCurrentUser();
    redirect(user ? "/dashboard" : "/login");
  }

  return (
    <div className="shell-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <SetupForm />
      </div>
    </div>
  );
}
