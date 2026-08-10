import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("admin_session")?.value;

  if (!session) {
    redirect("/login");
  }

  return (
    <>
      <link rel="manifest" href="/manifest.json" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Админка" />
      <link rel="apple-touch-icon" href="/logo.png" />
      <div className="min-h-screen bg-[#F6F5F2] flex">
        <AdminSidebar />
        <main className="flex-1 p-4 md:p-6 lg:p-8 pt-16 md:pt-6 lg:pt-8 w-full overflow-x-hidden max-w-full">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </>
  );
}
