import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || "";
  let dbPath = "";
  let dbSizeBytes = 0;
  if (dbUrl.includes("/") || dbUrl.startsWith("file:")) {
    const file = dbUrl.replace(/^file:/, "");
    const abs = path.isAbsolute(file)
      ? file
      : path.join(process.cwd(), "prisma", file.replace(/^\.\//, ""));
    if (fs.existsSync(abs)) {
      dbPath = abs;
      dbSizeBytes = fs.statSync(abs).size;
    }
  }

  return NextResponse.json({
    appName: APP_NAME,
    version: APP_VERSION,
    dbUrl,
    dbPath,
    dbSizeBytes,
  });
}