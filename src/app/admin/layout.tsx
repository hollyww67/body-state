import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import "./admin.css";
import AdminPwa from './AdminPwa';
import { adminPwaMetadata, adminViewport } from '@/lib/admin-pwa-metadata';
export const metadata = adminPwaMetadata;
export const viewport = adminViewport;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get(ADMIN_COOKIE)?.value;

  if (!(await verifyAdminSessionToken(session))) {
    redirect("/login");
  }

  return (
    <>
      <div className="admin-shell">
        <AdminSidebar />
        <main className="admin-main">
          <AdminTopbar />
          <AdminPwa />
          <div className="admin-workspace admin-content">{children}</div>
        </main>
      </div>
    </>
  );
}
