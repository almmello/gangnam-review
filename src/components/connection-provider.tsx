"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { DEFAULT_PROVIDER, type ProviderId } from "@/lib/analysis/providers";
type Credential = { mode: "demo" | "personal"; key: string };
type Connection = Credential & { provider: ProviderId; setMode: (mode: Credential["mode"]) => void; setKey: (key: string) => void };
const Context = createContext<Connection>({ provider: DEFAULT_PROVIDER, mode: "demo", key: "", setMode: () => {}, setKey: () => {} });
export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [credential, setCredential] = useState<Credential>({ mode: "demo", key: "" });
  const setMode = (mode: Credential["mode"]) => setCredential((current) => ({ ...current, mode }));
  const setKey = (key: string) => setCredential((current) => ({ ...current, key }));
  return <Context.Provider value={{ provider: DEFAULT_PROVIDER, ...credential, setMode, setKey }}>{children}</Context.Provider>;
}
export function useConnection() { return useContext(Context); }
