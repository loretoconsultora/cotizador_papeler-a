import { requireProfile } from "@/lib/auth/require-user";
import { GlassCard } from "@/components/ui/glass-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProfileAction, uploadAvatarAction } from "./actions";

export default async function ProfilePage() {
  const { supabase, user, profile } = await requireProfile();

  const { data } = await supabase
    .from("profiles")
    .select("full_name, phone, contact_email, avatar_path")
    .eq("id", user.id)
    .single();

  const avatarUrl = data?.avatar_path
    ? supabase.storage.from("avatars").getPublicUrl(data.avatar_path).data.publicUrl
    : null;

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mi perfil</h1>
        <p className="text-sm text-[var(--ink-muted)]">
          Estos datos (nombre, teléfono y correo) aparecen en las cotizaciones que descargas
          para tus clientes.
        </p>
      </div>

      <GlassCard strong className="space-y-4">
        <h2 className="text-sm font-medium">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={profile.full_name} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue/15 text-xl font-semibold text-brand-blue">
              {profile.full_name.trim().charAt(0).toUpperCase() || "?"}
            </span>
          )}
          <form action={uploadAvatarAction} className="flex items-center gap-2">
            <input type="file" name="avatar" accept="image/*" required className="text-xs" />
            <Button type="submit" variant="secondary" className="px-3 py-1.5 text-xs">
              Subir foto
            </Button>
          </form>
        </div>
      </GlassCard>

      <GlassCard strong>
        <form action={updateProfileAction} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Nombre completo</label>
            <Input name="full_name" defaultValue={data?.full_name ?? profile.full_name} required />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo de acceso</label>
            <Input value={user.email ?? ""} disabled />
            <p className="text-xs text-[var(--ink-muted)]">
              Con este entras al sistema — si necesitas cambiarlo, pídeselo al admin.
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Teléfono</label>
            <Input name="phone" defaultValue={data?.phone ?? ""} placeholder="Ej. 55 1234 5678" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Correo de contacto (para tus cotizaciones)</label>
            <Input
              name="contact_email"
              type="email"
              defaultValue={data?.contact_email ?? ""}
              placeholder="Puede ser el mismo u otro"
            />
          </div>
          <Button type="submit">Guardar cambios</Button>
        </form>
      </GlassCard>
    </div>
  );
}
