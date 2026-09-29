import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import { SETTING_KEYS, SETTING_DEFAULTS, type SettingKey } from "@/lib/settings";
import { DEFAULT_THEME, isThemeId } from "@/lib/theme-packs";

export const dynamic = "force-dynamic";

/**
 * Builds the settings payload from defaults + stored rows. Stored values that
 * no longer validate (a retired theme pack, say) are normalized on read so
 * clients never have to defend against them.
 */
async function readSettings() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: SETTING_KEYS as unknown as string[] } },
  });
  const settings: Record<string, string> = { ...SETTING_DEFAULTS };
  rows.forEach((r) => {
    settings[r.key] = r.value;
  });
  if (!isThemeId(settings["appearance.defaultThemeId"])) {
    settings["appearance.defaultThemeId"] = DEFAULT_THEME;
  }
  return settings;
}

export async function GET() {
  return NextResponse.json({ settings: await readSettings() });
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
      if (key === "appearance.defaultThemeId" && !isThemeId(value)) {
        return NextResponse.json(
          { error: `Unknown theme pack: ${value}` },
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

    return NextResponse.json({ settings: await readSettings() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
