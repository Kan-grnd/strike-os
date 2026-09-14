import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { editTicketsAllowed } from "@/lib/edit-tickets";

export const dynamic = "force-dynamic";

/**
 * Dev-gated metadata for the ticket modal's Data section: the Prisma model
 * names and the available API route paths. Models come from the generated
 * client's datamodel (single source of truth); routes come from walking
 * src/app/api at request time so newly-added handlers show up immediately.
 */
export async function GET() {
  if (!editTicketsAllowed()) {
    return NextResponse.json(
      { error: "Edit tickets are only allowed in development" },
      { status: 403 }
    );
  }

  const models =
    Prisma.dmmf?.datamodel?.models
      ?.map((m) => m.name)
      .filter((n) => n !== "EditTicket")
      .sort() ?? [];

  const apiDir = path.join(process.cwd(), "src", "app", "api");
  const routes: string[] = [];
  try {
    const walk = async (dir: string): Promise<string[]> => {
      const entries = await readdir(dir, { withFileTypes: true });
      const out: string[] = [];
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...(await walk(full)));
        else if (entry.name === "route.ts") {
          const rel = path.relative(apiDir, full);
          const segments = rel.split(path.sep).filter((s) => s && s !== "route.ts");
          if (segments.length === 0) continue;
          out.push(`/api/${segments.join("/")}`.replace(/\/\[([^\]]+)\]/g, "/:$1"));
        }
      }
      return out;
    };
    routes.push(...(await walk(apiDir)));
  } catch {
    // walk failed — return models only
  }

  return NextResponse.json({ models, routes: routes.sort() });
}
