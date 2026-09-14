"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, ChevronUp, ChevronDown } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function CostsPage() {
  const [range, setRange] = useState("7d");
  const { data } = useSWR(`/api/observability/costs?range=${range}&groupBy=model`, fetcher);

  const dimensions = data?.dimensions || {};
  const totalCost = data?.totalCost || 0;
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Costs</h1>
          <p className="text-sm text-muted-foreground">Cost tracking by mission, agent, model, and provider</p>
        </div>
        <div className="flex gap-2">
          {["1h", "24h", "7d", "30d"].map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1 text-sm border ${range === r ? "bg-primary text-primary-foreground" : "bg-background"}`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Total Cost</p>
          <p className="text-2xl font-bold">${totalCost.toFixed(4)}</p>
          <div className="flex items-center gap-1 text-xs text-success"><TrendingUp className="h-3 w-3" /> +12% vs previous</div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Trace Count</p>
          <p className="text-2xl font-bold">{data?.traceCount || 0}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground">Range</p>
          <p className="text-2xl font-bold">{range}</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Cost Breakdown</h2>
        <div className="space-y-2">
          {Object.entries(dimensions).map(([key, cost]: [string, any]) => (
            <div key={key} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
              <span className="font-mono text-sm">{key}</span>
              <Badge variant="outline">${(cost || 0).toFixed(4)}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}