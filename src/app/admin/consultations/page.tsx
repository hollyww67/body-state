import { redirect } from "next/navigation";

export default function LegacyConsultationsPage() {
  redirect("/admin/bookings");
}
