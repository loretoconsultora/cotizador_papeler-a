export type Role = "admin" | "seller";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
  phone?: string | null;
  contact_email?: string | null;
  avatar_path?: string | null;
};
