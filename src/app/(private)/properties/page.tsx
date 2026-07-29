import { redirect } from "next/navigation";

export default function PropertiesPage() {
  redirect("/admin/logements");
  return null;
}
