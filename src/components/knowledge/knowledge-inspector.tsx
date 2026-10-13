"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ExternalLink, Network } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatRelativeTime } from "@/lib/utils";
import type {
  KnowledgeEdge,
  KnowledgeNode,
} from "@/lib/knowledge-graph";

export type KnowledgeSelection =
  | { kind: "node"; key: string }
  | { kind: "edge"; id: string }
  | null;

interface InspectorProps {
  selection: KnowledgeSelection;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  /** Relationships that survive the current graph filters, for the list tab. */
  visibleEdges: KnowledgeEdge[];
  onSelect: (selection: KnowledgeSelection) => void;
  onClose: () => void;
}

function ConnectionRow({
  direction,
  relation,
  node,
  onSelect,
}: {
  direction: "in" | "out";
  relation: string;
  node: KnowledgeNode | undefined;
  onSelect: () => void;
}) {
  const Icon = direction === "out" ? ArrowRight : ArrowLeft;
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="shrink-0 font-mono text-muted-foreground">{relation}</span>
      <span className="min-w-0 flex-1 truncate">{node?.label ?? "Missing entity"}</span>
      <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
        {node?.type ?? "unknown"}
      </span>
    </button>
  );
}

function NodeHeader({ node }: { node: KnowledgeNode }) {
  return (
    <DrawerHeader className="p-0 pr-8">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="uppercase tracking-wide">
          {node.type}
        </Badge>
        {node.subtitle ? (
          <span className="text-xs text-muted-foreground">{node.subtitle}</span>
        ) : null}
      </div>
      <DrawerTitle className="mt-1 break-words">{node.label}</DrawerTitle>
      <DrawerDescription className="break-all font-mono text-xs">
        {node.id}
      </DrawerDescription>
    </DrawerHeader>
  );
}

function EdgeHeader({ edge }: { edge: KnowledgeEdge }) {
  return (
    <DrawerHeader className="p-0 pr-8">
      <Badge variant="secondary" className="w-fit font-mono">
        {edge.relation}
      </Badge>
      <DrawerTitle className="mt-1">Relationship</DrawerTitle>
      <DrawerDescription>
        A stored link between two entities. Relationships are written by the
        runtime, not by hand.
      </DrawerDescription>
    </DrawerHeader>
  );
}

function NodeDetail({
  node,
  nodes,
  edges,
  onSelect,
}: {
  node: KnowledgeNode;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  onSelect: (selection: KnowledgeSelection) => void;
}) {
  const byKey = (key: string) => nodes.find((n) => n.key === key);
  const outgoing = edges.filter((e) => e.source === node.key);
  const incoming = edges.filter((e) => e.target === node.key);
  const connectionCount = outgoing.length + incoming.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {node.href ? (
        <Link
          href={node.href}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          View {node.type}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
      ) : null}

      <div className="min-h-0 flex-1">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {connectionCount} {connectionCount === 1 ? "connection" : "connections"}
        </p>
        {connectionCount === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nothing links to or from this entity yet.
          </p>
        ) : (
          <ScrollArea className="h-full max-h-[55vh]">
            <div className="space-y-1.5 pr-2">
              {outgoing.map((e) => (
                <ConnectionRow
                  key={e.id}
                  direction="out"
                  relation={e.relation}
                  node={byKey(e.target)}
                  onSelect={() => onSelect({ kind: "node", key: e.target })}
                />
              ))}
              {incoming.map((e) => (
                <ConnectionRow
                  key={e.id}
                  direction="in"
                  relation={e.relation}
                  node={byKey(e.source)}
                  onSelect={() => onSelect({ kind: "node", key: e.source })}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

function EdgeDetail({
  edge,
  nodes,
  onSelect,
}: {
  edge: KnowledgeEdge;
  nodes: KnowledgeNode[];
  onSelect: (selection: KnowledgeSelection) => void;
}) {
  const source = nodes.find((n) => n.key === edge.source);
  const target = nodes.find((n) => n.key === edge.target);
  const metadata = Object.entries(edge.metadata);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => onSelect({ kind: "node", key: edge.source })}
          className="rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            from · {source?.type ?? "unknown"}
          </span>
          <p className="truncate font-medium">{source?.label ?? edge.source}</p>
        </button>
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          <span className="font-mono">{edge.relation}</span>
        </div>
        <button
          type="button"
          onClick={() => onSelect({ kind: "node", key: edge.target })}
          className="rounded-xl border px-3 py-2 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            to · {target?.type ?? "unknown"}
          </span>
          <p className="truncate font-medium">{target?.label ?? edge.target}</p>
        </button>
      </div>

      {metadata.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Metadata
          </p>
          <dl className="space-y-1 rounded-xl border p-2.5 text-xs">
            {metadata.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="font-mono text-muted-foreground">{k}</dt>
                <dd className="min-w-0 break-words text-right">
                  {typeof v === "object" ? JSON.stringify(v) : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      {edge.createdAt ? (
        <p className="text-xs text-muted-foreground">
          Created {formatRelativeTime(edge.createdAt)}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The full filtered relationship list — the inspector half of what used to be a
 * separate Connections panel. Every row is a button, so the relationships stay
 * reachable by keyboard even though the canvas only offers pointer selection.
 */
function RelationshipsList({
  edges,
  nodes,
  onSelect,
}: {
  edges: KnowledgeEdge[];
  nodes: KnowledgeNode[];
  onSelect: (selection: KnowledgeSelection) => void;
}) {
  if (edges.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Network className="h-3.5 w-3.5" aria-hidden />
        No relationships match the current filters.
      </p>
    );
  }

  const label = (key: string) => nodes.find((n) => n.key === key);

  return (
    <ScrollArea className="h-full max-h-[60vh]">
      <ul className="space-y-1.5 pr-2">
        {edges.map((e) => {
          const from = label(e.source);
          const to = label(e.target);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onSelect({ kind: "edge", id: e.id })}
                className="flex w-full flex-col gap-1 rounded-xl border px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {from?.label ?? e.source}
                  </span>
                  <span className="shrink-0 font-mono text-muted-foreground">
                    {e.relation}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-right font-medium">
                    {to?.label ?? e.target}
                  </span>
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {from?.type ?? "unknown"} → {to?.type ?? "unknown"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}

export function KnowledgeInspector({
  selection,
  nodes,
  edges,
  visibleEdges,
  onSelect,
  onClose,
}: InspectorProps) {
  const node =
    selection?.kind === "node" ? nodes.find((n) => n.key === selection.key) : undefined;
  const edge =
    selection?.kind === "edge" ? edges.find((e) => e.id === selection.id) : undefined;
  const resolved = !!node || !!edge;

  return (
    <Drawer open={!!selection} onOpenChange={(open) => !open && onClose()}>
      <DrawerContent aria-label="Knowledge inspector" className="overflow-hidden">
        {node ? <NodeHeader node={node} /> : null}
        {edge ? <EdgeHeader edge={edge} /> : null}
        {selection && !resolved ? (
          <p className="text-sm text-muted-foreground">
            This item is no longer in the graph.
          </p>
        ) : null}

        {resolved ? (
          <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="h-9 w-fit">
              <TabsTrigger value="details" className="text-xs">
                Details
              </TabsTrigger>
              <TabsTrigger value="relationships" className="text-xs">
                Relationships
                <span className="ml-1.5 tabular-nums text-muted-foreground">
                  {visibleEdges.length}
                </span>
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="details"
              className="mt-3 min-h-0 flex-1 focus-visible:ring-0"
            >
              {node ? (
                <NodeDetail node={node} nodes={nodes} edges={edges} onSelect={onSelect} />
              ) : edge ? (
                <EdgeDetail edge={edge} nodes={nodes} onSelect={onSelect} />
              ) : null}
            </TabsContent>
            <TabsContent
              value="relationships"
              className="mt-3 min-h-0 flex-1 focus-visible:ring-0"
            >
              <RelationshipsList
                edges={visibleEdges}
                nodes={nodes}
                onSelect={onSelect}
              />
            </TabsContent>
          </Tabs>
        ) : null}
      </DrawerContent>
    </Drawer>
  );
}
