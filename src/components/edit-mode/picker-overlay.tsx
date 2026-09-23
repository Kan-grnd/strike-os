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

function crumb(label: string, max = 3): string {
  const parts = label.split(" > ");
  if (parts.length <= max) return label || "node";
  return `… > ${parts.slice(-max + 1).join(" > ")}`;
}

/**
 * Captures everything while edit mode is on. Supports both mouse (hover + click)
 * and keyboard navigation: ArrowUp goes to the parent element, ArrowDown to the
 * first child (or back to the hovered node), Enter captures. The tag label shows
 * a shortened selector path so you always know which node you are targeting.
 */
export function PickerOverlay({ onCapture }: PickerOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [outline, setOutline] = useState<Outline | null>(null);
  const [current, setCurrent] = useState<Element | null>(null);
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

    const show = (el: Element | null) => {
      cancelAnimationFrame(raf);
      const t = el;
      setCurrent(t);
      if (!t) return setOutline(null);
      const r = t.getBoundingClientRect();
      setOutline({ top: r.top, left: r.left, width: r.width, height: r.height, tag: t.tagName.toLowerCase() });
    };

    const pick = (clientX: number, clientY: number) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const t = targetAt(clientX, clientY);
        if (!t) return setOutline(null);
        setCurrent(t);
        const r = t.getBoundingClientRect();
        setOutline({ top: r.top, left: r.left, width: r.width, height: r.height, tag: t.tagName.toLowerCase() });
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
        const parent = current?.parentElement ?? null;
        if (parent && parent !== document.body) show(parent);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const first = current?.firstElementChild ?? null;
        if (first) show(first);
        else {
          const t = targetAt(lastPointer.current.x, lastPointer.current.y);
          if (t) show(t);
        }
      } else if (e.key === "Enter") {
        e.preventDefault();
        capture(current);
      }
    };

    root.addEventListener("pointermove", onPointerMove, { passive: true });
    root.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(raf);
      root.removeEventListener("pointermove", onPointerMove);
      root.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onCapture, current]);

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
          <span className="absolute -top-[26px] left-0 max-w-[420px] truncate whitespace-nowrap rounded bg-cyan-400 px-1.5 py-0.5 text-[10px] font-bold text-black">
            &lt;{outline.tag}&gt; · {crumb(current?.getAttribute?.("aria-label") ?? "")} · click/Enter to ticket
          </span>
        </div>
      )}

      <div className="pointer-events-none fixed bottom-3 z-[2] left-1/2 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-background/95 px-3 py-1 text-[10.5px] font-medium text-cyan-300 shadow-lg backdrop-blur">
        Scroll paused while picking
      </div>
    </div>
  );
}