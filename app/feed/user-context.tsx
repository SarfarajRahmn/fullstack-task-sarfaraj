"use client";

import { createContext, useContext } from "react";
import type { Session } from "@/lib/auth";

const UserContext = createContext<Session["user"] | null>(null);

export function UserProvider({
  user,
  children,
}: {
  user: Session["user"];
  children: React.ReactNode;
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
