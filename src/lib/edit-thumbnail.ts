import { resolveIndexPath } from "@/components/edit-mode/capture";
import type { Shape } from "@/components/edit-mode/edit-mode-provider";

const MAX_BYTES = 80 * 1024;

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Builds an SVG of the captured page — target rect (outlined) plus any
 * annotation shapes — and returns it as a data URL small enough to store on
 * the ticket row. Callers pass the resolved target id/path so the thumbnail can
 * re-find the element; if it has moved this returns null.
 *
 * Geometry is authored in viewport pixels and rendered through a `viewBox`, so
 * stroke widths, dash gaps and font sizes are authored as CSS pixels and only
 * the frame is downscaled.
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

  // 0.4 keeps the data URL comfortably under MAX_BYTES without touching the
  // geometry authored in viewport pixels.
  const scale = 0.4;
  const W = Math.max(1, Math.round(vw * scale));
  const H = Math.max(1, Math.round(vh * scale));
  const round = (v: number) => Math.round(v * 10) / 10;

  const rectSvg = [
    `<rect x="${round(rect.left)}" y="${round(rect.top)}" width="${round(Math.max(0, rect.width))}" height="${round(Math.max(0, rect.height))}" fill="rgba(34,211,238,0.12)" stroke="#22d3ee" stroke-width="1.5" stroke-dasharray="6 3" rx="4"/>`,
  ];

  const shapeSvg = opts.shapes.map((s, i) => {
    const id = `m${i}`;
    const x = s.x;
    const y = s.y;
    const x2 = s.x2;
    const y2 = s.y2;
    const w = Math.abs(x2 - x);
    const h = Math.abs(y2 - y);
    const left = Math.min(x, x2);
    const top = Math.min(y, y2);
    const sw = Math.max(1, s.strokeWidth);
    const color = /^#[0-9a-f]{3,8}$/i.test(s.color) ? s.color : "#ef4444";
    const op = s.opacity ?? 1;
    const opAttr = op < 1 ? ` opacity="${round(op)}"` : "";

    if (s.type === "rectangle") {
      const fill = s.fill ? `fill="${color}" fill-opacity="0.2"` : `fill="none"`;
      return `<rect x="${round(left)}" y="${round(top)}" width="${round(Math.max(1, w))}" height="${round(Math.max(1, h))}" ${fill} stroke="${color}" stroke-width="${sw}" stroke-dasharray="6 3" rx="4"${opAttr}/>`;
    }
    if (s.type === "ellipse") {
      const fill = s.fill ? `fill="${color}" fill-opacity="0.2"` : `fill="none"`;
      return `<ellipse cx="${round(left + w / 2)}" cy="${round(top + h / 2)}" rx="${round(Math.max(1, w / 2))}" ry="${round(Math.max(1, h / 2))}" ${fill} stroke="${color}" stroke-width="${sw}" stroke-dasharray="6 3"${opAttr}/>`;
    }
    if (s.type === "arrow") {
      return `<g><defs><marker id="${id}" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><polygon points="0 0, 8 3, 0 6" fill="${color}"/></marker></defs><line x1="${round(x)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${color}" stroke-width="${sw}" marker-end="url(#${id})"${opAttr}/></g>`;
    }
    if (s.type === "line") {
      return `<line x1="${round(x)}" y1="${round(y)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"${opAttr}/>`;
    }
    if (s.type === "pen" || s.type === "highlighter") {
      const pts = (s.points ?? []).map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
      const hsw = s.type === "highlighter" ? Math.max(sw, 8) : sw;
      const hop = s.type === "highlighter" && op === 1 ? ` opacity="0.35"` : opAttr;
      const cap = s.type === "highlighter" ? "square" : "round";
      return pts
        ? `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${hsw}" stroke-linecap="${cap}" stroke-linejoin="round"${hop}/>`
        : "";
    }
    if (s.type === "blur") {
      return `<rect x="${round(left)}" y="${round(top)}" width="${round(Math.max(1, w))}" height="${round(Math.max(1, h))}" fill="rgba(160,160,170,0.35)"${opAttr}/>`;
    }
    if (s.type === "redact") {
      return `<rect x="${round(left)}" y="${round(top)}" width="${round(Math.max(1, w))}" height="${round(Math.max(1, h))}" fill="${color}"${opAttr}/>`;
    }
    if (s.type === "pin") {
      return `<g${opAttr}><circle cx="${round(x)}" cy="${round(y)}" r="11" fill="${color}" stroke="rgba(0,0,0,0.55)" stroke-width="1.5"/><text x="${round(x)}" y="${round(y)}" text-anchor="middle" dominant-baseline="central" font-size="11" font-weight="700" font-family="sans-serif" fill="#fff">${i + 1}</text></g>`;
    }
    if (s.type === "text" && s.label) {
      return `<text x="${round(x)}" y="${round(y)}" text-anchor="middle" dominant-baseline="central" font-size="14" font-weight="600" font-family="sans-serif" fill="${color}" stroke="rgba(0,0,0,0.6)" stroke-width="3" paint-order="stroke" stroke-linejoin="round"${opAttr}>${esc(s.label)}</text>`;
    }
    return "";
  });

  const label = opts.targetLabel ? esc(opts.targetLabel).slice(0, 40) : "";
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${vw} ${vh}">`,
    `<rect width="${vw}" height="${vh}" fill="#0c0c0f"/>`,
    rectSvg.join(""),
    shapeSvg.join(""),
    label
      ? `<text x="10" y="${vh - 12}" fill="#8b8b93" font-family="monospace" font-size="12">${label}</text>`
      : "",
    `</svg>`,
  ].join("");

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  if (url.length > MAX_BYTES) return null;
  return url;
}
