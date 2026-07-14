export type Visibility = "PUBLIC" | "PRIVATE";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  image?: string | null;
}
