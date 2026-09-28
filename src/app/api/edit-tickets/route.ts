import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { editTicketsAllowed } from "@/lib/edit-tickets";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!editTicketsAllowed()) {
    return NextResponse.json({ tickets: [] });
  }
  const tickets = await prisma.editTicket.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  if (!editTicketsAllowed()) {
    return NextResponse.json(
      { error: "Edit tickets are only allowed in development" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();

    const {
      scope,
      tweakKind,
      route,
      selectorPath,
      htmlExcerpt,
      currentStyles,
      intent,
      changes,
      dataContext,
      thumbnail,
      priority,
    } = body ?? {};

    if (!scope || !tweakKind || !route || !selectorPath || !intent?.trim()) {
      return NextResponse.json(
        { error: "scope, tweakKind, route, selectorPath and intent are required" },
        { status: 400 }
      );
    }

    // A ticket with no "after" value is not a ticket — reject it server-side
    // too, so a hand-rolled request cannot file an empty change set. A missing
    // `changes` array counts as an empty one.
    const rows = Array.isArray(changes) ? changes : [];
    if (!rows.some((c) => String(c?.desired ?? "").trim())) {
      return NextResponse.json(
        { error: "at least one change needs a desired value" },
        { status: 400 }
      );
    }

    // All-empty data context is the same as no data context.
    const data =
      dataContext && typeof dataContext === "object"
        ? Object.fromEntries(
            Object.entries(dataContext as Record<string, unknown>).filter(
              ([, v]) => String(v ?? "").trim() !== ""
            )
          )
        : null;
    const cleanData = data && Object.keys(data).length > 0 ? data : null;

    const ticket = await prisma.editTicket.create({
      data: {
        scope,
        tweakKind,
        route,
        selectorPath,
        htmlExcerpt: String(htmlExcerpt ?? "").slice(0, 2000),
        currentStyles:
          typeof currentStyles === "string"
            ? currentStyles
            : JSON.stringify(currentStyles ?? {}),
        intent: String(intent).slice(0, 4000),
        changes: JSON.stringify(rows),
        dataContext: cleanData ? JSON.stringify(cleanData) : null,
        thumbnail:
          typeof thumbnail === "string" && thumbnail.length > 0 && thumbnail.length < 100_000
            ? thumbnail
            : null,
        status: "OPEN",
        priority: ["LOW", "MEDIUM", "HIGH"].includes(priority) ? priority : "MEDIUM",
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create edit ticket" }, { status: 500 });
  }
}
