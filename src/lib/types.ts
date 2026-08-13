export type Role = "admin" | "seller";

export type Profile = {
  id: string;
  full_name: string;
  role: Role;
  active: boolean;
};
