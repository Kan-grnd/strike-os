import type { ComputeStyleSnapshot } from "@/lib/edit-tickets";

function cssEscape(sel: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(sel);
  return sel.replace(/[ ?!<>"#$%&'()*+,./:;=@[\]^`{|}~]/g, (m) => `\\${m}`);
}

/** Build a readable, mostly-stable CSS selector path for the captured element. */
export function buildSelectorPath(el: Element, maxDepth = 6): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1 && parts.length < maxDepth) {
    const tag = node.tagName.toLowerCase();
    const id = node.id ? `#${cssEscape(node.id)}` : "";
    const classes = Array.from(node.classList || [])
      .filter((c) => !/react-flow|rdx-|lucide|lucide-icon|^claude/.test(c))
      .slice(0, 3)
      .map((c) => `.${cssEscape(c)}`)
      .join("");
    parts.push(`${tag}${id}${classes}`);
    if (node.id) break;
    if (tag === "main" || tag === "body") break;
    node = node.parentElement;
  }
  return parts.reverse().join(" > ") || el.tagName.toLowerCase();
}

/** Inline template of the exact computed styles that make micro-tickets precise. */
export function captureSnapshot(el: Element): ComputeStyleSnapshot {
  const cs = getComputedStyle(el);
  const square =
    cs.paddingTop === cs.paddingRight && cs.paddingRight === cs.paddingBottom && cs.paddingBottom === cs.paddingLeft
      ? cs.paddingTop
      : [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(" ");
  const msquare =
    cs.marginTop === cs.marginRight && cs.marginRight === cs.marginBottom && cs.marginBottom === cs.marginLeft
      ? cs.marginTop
      : [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].join(" ");
  return {
    fontSize: cs.fontSize,
    fontFamily: (cs.fontFamily.split(",")[0] ?? cs.fontFamily).trim().replace(/["']/g, ""),
    fontWeight: cs.fontWeight,
    color: cs.color,
    backgroundColor: cs.backgroundColor === "rgba(0, 0, 0, 0)" ? "transparent" : cs.backgroundColor,
    padding: square,
    margin: msquare,
    borderRadius: cs.borderTopLeftRadius,
    borderWidth: cs.borderTopWidth,
    borderColor: cs.borderColor,
    display: cs.display,
    width: cs.width,
    height: cs.height,
  };
}

/**
 * Index path from <body>: each number is the child index (element children
 * only) of its parent, so resolving walks `body.children[i].children[j]...`.
 * The first entry indexes into `document.body`, the last indexes into the
 * captured element's parent.
 */
export function buildIndexPath(el: Element): number[] {
  const path: number[] = [];
  let node: Element | null = el;
  while (node && node !== document.body) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    path.unshift(Array.prototype.indexOf.call(parent.children, node));
    node = parent;
  }
  return path;
}

/** Reverse of buildIndexPath — re-find the live node, or null if moved. */
export function resolveIndexPath(path: number[]): Element | null {
  let node: Element = document.body;
  for (const i of path) {
    const next = node.children[i];
    if (!next) return null;
    node = next;
  }
  return node;
}

export interface AncestorCapture {
  tag: string;
  label: string;
  selectorPath: string;
  htmlExcerpt: string;
  nodeIndexPath: number[];
  computed: ComputeStyleSnapshot;
}

/** Up to `limit` element ancestors (root→node order), each self-contained. */
export function captureAncestors(el: Element, limit = 4): AncestorCapture[] {
  const out: AncestorCapture[] = [];
  let node: Element | null = el.parentElement;
  while (node && node !== document.body && out.length < limit) {
    const textEl = node instanceof HTMLElement ? node : null;
    const text = (
      node.getAttribute("aria-label") ||
      textEl?.innerText ||
      node.textContent ||
      ""
    ).trim().slice(0, 60);
    const html = node.outerHTML;
    out.push({
      tag: node.tagName.toLowerCase(),
      label: text,
      selectorPath: buildSelectorPath(node),
      htmlExcerpt: html.length > 400 ? `${html.slice(0, 397)}…` : html,
      nodeIndexPath: buildIndexPath(node),
      computed: captureSnapshot(node),
    });
    node = node.parentElement;
  }
  return out.reverse();
}

export interface CaptureResult {
  route: string;
  selectorPath: string;
  htmlExcerpt: string;
  label: string;
  viewport: string;
  computed: ComputeStyleSnapshot;
  nodeIndexPath: number[];
  ancestors: AncestorCapture[];
}