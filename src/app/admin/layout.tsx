import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "./AdminSidebar";
import AdminTopbar from "./AdminTopbar";
import { ADMIN_COOKIE, verifyAdminSessionToken } from "@/lib/admin-auth";
import "./admin.css";
import "./design-system.css";
import "./phase2.css";
import "./healthcare-shell.css";
import "./healthcare-dashboard.css";
import "./healthcare-calendar.css";
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
        <a href="#admin-workspace" className="sr-only focus:not-sr-only">К содержимому</a>
        <main className="admin-main">
          <AdminTopbar />
          <AdminPwa />
          <div id="admin-workspace" tabIndex={-1} className="admin-workspace admin-content">{children}</div>
        </main>
      </div>
    </>
  );
}
