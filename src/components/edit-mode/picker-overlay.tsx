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
}

interface PickerOverlayProps {
  onCapture: (capture: CaptureResult) => void;
}

/**
 * Captures everything while edit mode is on: crosshair + hover outline over
 * the real DOM node (hit-testing through elementsFromPoint, so the overlay's
 * own chrome is skipped), and a click snaps route + selector path + HTML
 * excerpt + a computed-style snapshot of the exact node.
 */
export function PickerOverlay({ onCapture }: PickerOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<Outline | null>(null);

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

    const pick = (clientX: number, clientY: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = targetAt(clientX, clientY);
        if (!t) return setOutline(null);
        const r = t.getBoundingClientRect();
        setOutline({ top: r.top, left: r.left, width: r.width, height: r.height, tag: t.tagName.toLowerCase() });
      });
    };

    const onPointerMove = (e: PointerEvent) => pick(e.clientX, e.clientY);

    const onClick = (e: MouseEvent) => {
      const t = targetAt(e.clientX, e.clientY);
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();

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

    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("click", onClick, true);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("click", onClick, true);
      document.body.style.overflow = "";
    };
  }, [onCapture]);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[90] cursor-crosshair select-none"
    >
      {outline && (
        <div
          className="pointer-events-none fixed z-[1] border-2 border-dashed border-cyan-400"
          style={{ top: outline.top, left: outline.left, width: outline.width, height: outline.height }}
        >
          <span className="absolute -top-[22px] left-0 whitespace-nowrap rounded bg-cyan-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
            &lt;{outline.tag}&gt; · click to ticket
          </span>
        </div>
      )}
    </div>
  );
}