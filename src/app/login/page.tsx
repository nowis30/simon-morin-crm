import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser, hasAnyAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function LoginPage() {
  const adminExists = await hasAnyAdmin();
  if (!adminExists) {
    redirect("/setup");
  }

  const user = await getCurrentUser();
  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="shell-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md min-w-0">
        <LoginForm />
      </div>
    </div>
  );
}
