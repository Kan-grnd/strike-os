"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cpu, Globe } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ModelsPage() {
  const { data } = useSWR("/api/models", fetcher);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  const models = (data?.models || []).filter((m: any) =>
    !search || m.name.toLowerCase().includes(search.toLowerCase()) ||
    (m.capabilities && JSON.parse(m.capabilities || "[]").some((c: string) => c.includes(search)))
  ).filter((m: any) => !providerFilter || m.provider?.name === providerFilter);

  const providers = Array.from(new Set((data?.models || []).map((m: any) => m.provider?.name).filter(Boolean))) as string[];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Models</h1>
        <p className="text-sm text-muted-foreground">Model registry — capabilities, pricing, and routing</p>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search models..." className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="rounded-md border bg-background px-3 py-2 text-sm h-10" value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)}>
          <option value="">All Providers</option>
          {providers.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {models.map((m: any) => {
          const caps = JSON.parse(m.capabilities || "[]") as string[];
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-start justify-between mb-2">
                <div className="rounded-md bg-muted p-2"><Cpu className="h-4 w-4 text-muted-foreground" /></div>
                <Badge variant="outline">{m.provider?.name || "Unknown"}</Badge>
              </div>
              <h3 className="font-semibold">{m.name}</h3>
              <p className="text-xs text-muted-foreground">{m.contextWindow.toLocaleString()} context window</p>
              <div className="flex flex-wrap gap-1 my-3">
                {caps.slice(0, 3).map((c) => <Badge key={c} variant="outline" className="text-[10px]">{c}</Badge>)}
              </div>
              <div className="text-xs text-faint">${(m.costPer1KInput || 0)?.toFixed(2)}/1K in • ${(m.costPer1KOutput || 0)?.toFixed(2)}/1K out</div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
