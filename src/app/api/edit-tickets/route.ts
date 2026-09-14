import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { editTicketsAllowed } from "@/lib/edit-tickets";

export async function GET() {
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
    } = body ?? {};

    if (!scope || !tweakKind || !route || !selectorPath || !intent?.trim()) {
      return NextResponse.json(
        { error: "scope, tweakKind, route, selectorPath and intent are required" },
        { status: 400 }
      );
    }

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
        changes: changes == null ? null : JSON.stringify(changes),
        dataContext:
          dataContext == null || Object.keys(dataContext).length === 0
            ? null
            : JSON.stringify(dataContext),
        thumbnail:
          typeof thumbnail === "string" && thumbnail.length > 0 && thumbnail.length < 100_000
            ? thumbnail
            : null,
        status: "OPEN",
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create edit ticket" }, { status: 500 });
  }
}