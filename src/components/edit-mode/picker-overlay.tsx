"use client";

import { useEffect, useRef, useState } from "react";
import {
  buildIndexPath,
  buildSelectorPath,
  captureAncestors,
  captureSnapshot,
  type CaptureResult,
} from "./capture";

interface Outline {
  top: number;
  left: number;
  width: number;
  height: number;
  tag: string;
  /** Where the tag label goes so it never falls off the screen. */
  labelTop: number;
  labelLeft: number;
}

interface PickerOverlayProps {
  onCapture: (capture: CaptureResult) => void;
}

function crumb(label: string, max = 3): string {
  const parts = label.split(" > ");
  if (parts.length <= max) return label || "node";
  return `… > ${parts.slice(-max + 1).join(" > ")}`;
}

const LABEL_H = 22;
const LABEL_GAP = 4;
const LABEL_MAX_W = 260;

/**
 * Captures everything while edit mode is on. Supports both mouse (hover + click)
 * and keyboard navigation: ArrowUp goes to the parent element, ArrowDown to the
 * first child (or back to the hovered node), Enter captures. The tag label is
 * clamped inside the viewport so a target at the top or right edge stays readable.
 */
export function PickerOverlay({ onCapture }: PickerOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const currentRef = useRef<Element | null>(null);
  const lastPointer = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let raf = 0;

    const targetAt = (x: number, y: number): Element | null => {
      const els = document.elementsFromPoint(x, y);
      return (
        els.find((el) => el !== root && el.nodeType === 1 && !root.contains(el)) ?? null
      );
    };

    const describe = (el: Element | null): Outline | null => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      // Keep the label fully on screen: below the box when there is no room
      // above it, and never past the right edge.
      const above = r.top - LABEL_H - LABEL_GAP;
      const labelTop = above >= 4 ? above : r.top + 4;
      const labelLeft = Math.max(4, Math.min(r.left, window.innerWidth - LABEL_MAX_W - 8));
      return {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
        tag: el.tagName.toLowerCase(),
        labelTop,
        labelLeft,
      };
    };

    const show = (el: Element | null) => {
      cancelAnimationFrame(raf);
      currentRef.current = el;
      setOutline(describe(el));
    };

    const pick = (clientX: number, clientY: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = targetAt(clientX, clientY);
        currentRef.current = t;
        setOutline(describe(t));
      });
    };

    const capture = (t: Element | null) => {
      if (!t) return;
      const textEl = t instanceof HTMLElement ? t : null;
      const text = (
        t.getAttribute("aria-label") ||
        textEl?.innerText ||
        t.textContent ||
        ""
      ).trim().slice(0, 60);
      const html = t.outerHTML;
      onCapture({
        route: window.location.pathname,
        selectorPath: buildSelectorPath(t),
        htmlExcerpt: html.length > 400 ? `${html.slice(0, 397)}…` : html,
        label: text,
        viewport: `${window.innerWidth} × ${window.innerHeight}`,
        computed: captureSnapshot(t),
        nodeIndexPath: buildIndexPath(t),
        ancestors: captureAncestors(t),
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      lastPointer.current = { x: e.clientX, y: e.clientY };
      pick(e.clientX, e.clientY);
    };

    const onClick = (e: MouseEvent) => {
      const t = targetAt(e.clientX, e.clientY);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      capture(t);
    };

    // Keyboard navigation: parent / first-child / capture. Arrows won't scroll
    // while the picker is up — the layout is intentionally frozen for picking.
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement | null)?.tagName === "INPUT" || (e.target as HTMLElement | null)?.tagName === "TEXTAREA";
      if (typing) return;
      if (e.key === "ArrowUp") {
        e.preventDefault();
        const parent = currentRef.current?.parentElement ?? null;
        if (parent && parent !== document.body) show(parent);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const first = currentRef.current?.firstElementChild ?? null;
        if (first) show(first);
        else {
          const t = targetAt(lastPointer.current.x, lastPointer.current.y);
          if (t) show(t);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        capture(currentRef.current);
      }
    };

    // Freeze the page while picking, but put the host page's own overflow value
    // back afterwards instead of blindly clearing it.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onCapture]);

  return (
    <div
      ref={rootRef}
      // Starts below the 56px header on purpose: the "Leave edit mode" toggle
      // lives there, and a full-bleed overlay would make it a dead click.
      className="fixed inset-x-0 bottom-0 top-14 z-[90] cursor-crosshair select-none"
    >
      {outline && (
        <div
          className="pointer-events-none fixed z-[1] border-2 border-dashed border-cyan-400"
          style={{
            top: outline.top,
            left: outline.left,
            width: outline.width,
            height: outline.height,
          }}
        >
          <span
            className="absolute max-w-[260px] truncate rounded bg-cyan-400 px-1.5 py-0.5 text-[11px] font-bold text-black"
            style={{ top: outline.labelTop - outline.top, left: outline.labelLeft - outline.left }}
          >
            &lt;{outline.tag}&gt; · {crumb(currentRef.current?.getAttribute?.("aria-label") ?? "")} · click/Enter
          </span>
        </div>
      )}
    </div>
  );
}
