import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import { SETTING_KEYS, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: SETTING_KEYS as unknown as string[] } },
  });
  const settings: Record<string, string> = { ...SETTING_DEFAULTS };
  rows.forEach((r) => {
    settings[r.key] = r.value;
  });
  return NextResponse.json({ settings });
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const incoming = (body?.settings || {}) as Record<string, unknown>;

    const entries: { key: SettingKey; value: string }[] = [];
    for (const [key, value] of Object.entries(incoming)) {
      if (!SETTING_KEYS.includes(key as SettingKey)) {
        return NextResponse.json(
          { error: `Unknown setting key: ${key}` },
          { status: 400 }
        );
      }
      if (typeof value !== "string") {
        return NextResponse.json(
          { error: `Setting "${key}" must be a string` },
          { status: 400 }
        );
      }
      entries.push({ key: key as SettingKey, value });
    }

    if (entries.length === 0) {
      return NextResponse.json({ error: "No settings provided" }, { status: 400 });
    }

    await Promise.all(
      entries.map((e) =>
        prisma.systemSetting.upsert({
          where: { key: e.key },
          create: { key: e.key, value: e.value },
          update: { value: e.value },
        })
      )
    );

    await eventBus.emit({
      type: "settings.updated",
      source: "settings",
      subject: "settings",
      payload: { keys: entries.map((e) => e.key) },
    });

    const rows = await prisma.systemSetting.findMany({
      where: { key: { in: SETTING_KEYS as unknown as string[] } },
    });
    const settings: Record<string, string> = { ...SETTING_DEFAULTS };
    rows.forEach((r) => {
      settings[r.key] = r.value;
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
