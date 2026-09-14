import { resolveIndexPath, type AncestorCapture } from "@/components/edit-mode/capture";
import type { Shape } from "@/components/edit-mode/edit-mode-provider";

const MAX_BYTES = 80 * 1024;

/**
 * Builds a viewport-sized SVG of the captured page — target rect (outlined)
 * plus any annotation shapes — and returns it as a data URL small enough to
 * store on the ticket row. Callers pass the resolved target id/path so the
 * thumbnail can re-find the element; if it has moved this returns null.
 */
export function buildThumbnailDataUrl(opts: {
  viewport: string;
  nodeIndexPath: number[];
  targetLabel: string;
  shapes: Shape[];
}): string | null {
  const match = opts.viewport.match(/(\d+)\s*×\s*(\d+)/);
  if (!match) return null;
  const vw = Number(match[1]);
  const vh = Number(match[2]);
  if (!vw || !vh || vw > 5000 || vh > 5000) return null;

  const el = resolveIndexPath(opts.nodeIndexPath);
  const rect = el?.getBoundingClientRect();
  if (!rect) return null;

  const scale = 0.4; // downscale so the data URL stays well under 80KB
  const W = Math.round(vw * scale);
  const H = Math.round(vh * scale);
  const px = (v: number) => Math.round(v * scale);

  const rectSvg = [
    `<rect x="${px(rect.left)}" y="${px(rect.top)}" width="${Math.max(0, Math.round(rect.width * scale))}" height="${Math.max(0, Math.round(rect.height * scale))}" fill="rgba(34,211,238,0.12)" stroke="#22d3ee" strokeWidth="${Math.max(1, Math.round(1.5 * scale))}" strokeDasharray="6 3" rx="4"/>`,
  ];

  const shapeSvg = opts.shapes.map((s, i) => {
    const id = `m${i}`;
    const x = px(s.x);
    const y = px(s.y);
    const x2 = px(s.x2);
    const y2 = px(s.y2);
    const w = Math.abs(x2 - x);
    const h = Math.abs(y2 - y);
    const left = Math.min(x, x2);
    const top = Math.min(y, y2);
    const strokeWidth = Math.max(1, Math.round(2 * scale));
    if (s.type === "rectangle") {
      return `<rect x="${left}" y="${top}" width="${Math.max(1, w)}" height="${Math.max(1, h)}" fill="none" stroke="${s.color}" strokeWidth="${strokeWidth}" strokeDasharray="6 3" rx="${Math.round(4 * scale)}"/>`;
    }
    if (s.type === "ellipse") {
      return `<ellipse cx="${left + w / 2}" cy="${top + h / 2}" rx="${Math.max(1, w / 2)}" ry="${Math.max(1, h / 2)}" fill="none" stroke="${s.color}" strokeWidth="${strokeWidth}" strokeDasharray="6 3"/>`;
    }
    if (s.type === "arrow") {
      return `<g><defs><marker id="${id}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${s.color}"/></marker></defs><line x1="${x}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${s.color}" strokeWidth="${strokeWidth}" markerEnd="url(#${id})"/></g>`;
    }
    return "";
  });

  const label = opts.targetLabel ? opts.targetLabel.replace(/["<>&]/g, "").slice(0, 40) : "";
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}" viewBox="0 0 ${vw} ${vh}">`,
    `<rect width="${vw}" height="${vh}" fill="#0c0c0f"/>`,
    rectSvg.join(""),
    shapeSvg.join(""),
    label
      ? `<text x="10" y="${H - 10}" fill="#8b8b93" font-family="monospace" font-size="${Math.round(12 * scale)}">${label}</text>`
      : "",
    `</svg>`,
  ].join("");

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (url.length > MAX_BYTES) return null;
  return url;
}