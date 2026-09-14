import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const secrets = await prisma.secret.findMany({
    select: {
      id: true,
      name: true,
      provider: true,
      reference: true,
      createdAt: true,
    },
  });

  // Never return actual secret values — only references.
  return NextResponse.json({ secrets });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const secret = await prisma.secret.create({
      data: {
        name: body.name,
        provider: body.provider,
        reference: body.reference,
      },
    });

    return NextResponse.json(
      {
        secret: {
          id: secret.id,
          name: secret.name,
          provider: secret.provider,
          reference: secret.reference,
          createdAt: secret.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create secret" }, { status: 500 });
  }
}