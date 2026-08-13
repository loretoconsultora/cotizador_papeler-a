import { requireProfile } from "@/lib/auth/require-user";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { profile } = await requireProfile();

  return (
    <div className="min-h-screen">
      <TopNav profile={profile} />
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
