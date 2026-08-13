import { requireProfile } from "@/lib/auth/require-user";
import { TopNav } from "@/components/top-nav";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { supabase, profile } = await requireProfile();

  const avatarUrl = profile.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(profile.avatar_path).data.publicUrl
    : null;

  return (
    <div className="min-h-screen">
      <TopNav profile={profile} avatarUrl={avatarUrl} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">{children}</main>
    </div>
  );
}
