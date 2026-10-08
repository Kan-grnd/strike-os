/**
 * One-shot backfill for memories stored before categories existed.
 *
 * Assigns a category by matching keywords against each memory's content and
 * source. Where nothing matches, the memory is labelled `uncategorized` rather
 * than being given a category it was never about — a wrong label is worse than
 * an honest blank.
 *
 * Safe to re-run: it never overwrites a memory that already has categories.
 *
 * Usage: npx tsx scripts/backfill-memory-categories.ts
 */
import prisma from "../src/lib/db";
import {
  serializeCategories,
  UNCATEGORIZED,
} from "../src/lib/memory-categories";

/** Order matters only for readability; each rule contributes its own slug. */
const RULES: { slug: string; pattern: RegExp }[] = [
  { slug: "runbook", pattern: /runbook|restart|deploy|gateway|ops\b|rollback/ },
  { slug: "decision", pattern: /decided|decision|chose|we will go with/ },
  { slug: "preference", pattern: /prefer|\blikes?\b|dislikes?\b/ },
  { slug: "hours", pattern: /\bhours?\b|open|closed/ },
  { slug: "pricing", pattern: /pric|cost|quote|budget|invoice/ },
  { slug: "contact", pattern: /contact|email|phone|address/ },
  { slug: "policy", pattern: /polic|compliance|rule/ },
  { slug: "troubleshooting", pattern: /troubleshoot|error|fails?|broken/ },
  { slug: "procedure", pattern: /procedure|workflow|process|steps/ },
  { slug: "fact", pattern: /is|are|has|have/ },
];

function infer(content: string, source: string | null): string[] {
  const haystack = `${content ?? ""} ${source ?? ""}`.toLowerCase();
  const hits = RULES.filter((r) => r.pattern.test(haystack)).map((r) => r.slug);
  /* "fact" is the catch-all pattern, so it only counts when nothing more
     specific matched — otherwise every memory would land on it. */
  if (hits.length === 0) return [UNCATEGORIZED];
  const specific = hits.filter((s) => s !== "fact");
  return specific.length ? specific : ["fact"];
}

async function main() {
  const memories = await prisma.memory.findMany({
    select: { id: true, content: true, source: true, categories: true },
  });

  const counts = new Map<string, number>();
  let updated = 0;
  let skipped = 0;

  for (const m of memories) {
    let existing: string[] = [];
    try {
      const parsed = JSON.parse(m.categories);
      if (Array.isArray(parsed)) existing = parsed.filter((x) => typeof x === "string");
    } catch {
      existing = [];
    }
    if (existing.length) {
      skipped += 1;
      continue;
    }

    const inferred = infer(m.content, m.source);
    await prisma.memory.update({
      where: { id: m.id },
      data: { categories: serializeCategories(inferred) },
    });
    updated += 1;
    for (const slug of inferred) counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }

  console.log(`Existing categories kept: ${skipped}`);
  console.log(`Updated: ${updated}`);
  const assigned = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([slug, n]) => `${slug}=${n}`)
    .join(", ");
  console.log("Assigned:", assigned || "none");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());