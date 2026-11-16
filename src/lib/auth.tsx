"use client";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "./supabase";
import type { Me } from "./data";

type Ctx = {
  ready: boolean;
  session: Session | null;
  me: Me | null;
  refresh: () => Promise<Me | null>;
  checkIn: () => Promise<{ ok: boolean; reason?: string; streak: number; got_tickets?: number; got_cookies?: number; bonus?: boolean }>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(async () => {
    const { data: s } = await sb.auth.getSession();
    if (!s.session) { setMe(null); return null; }
    const { data, error } = await sb.rpc("jr_me", {});
    if (error) { console.error(error); return null; }
    setMe(data as Me);
    return data as Me;
  }, []);

  useEffect(() => {
    sb.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refresh();
      setReady(true);
    });
    const { data } = sb.auth.onAuthStateChange((ev, s) => {
      setSession(s);
      if (ev === "SIGNED_OUT") setMe(null);
      if (ev === "SIGNED_IN" || ev === "USER_UPDATED") setTimeout(() => refresh(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  const checkIn = useCallback(async () => {
    const { data, error } = await sb.rpc("jr_check_in");
    if (error) throw error;
    await refresh();
    return data;
  }, [refresh]);

  const signOut = useCallback(async () => { await sb.auth.signOut(); setMe(null); }, []);

  return <AuthCtx.Provider value={{ ready, session, me, refresh, checkIn, signOut }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
