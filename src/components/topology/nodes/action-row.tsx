import { useEffect, useRef, type ComponentProps, type HTMLAttributes } from "react";

/** Action row inside a node card. Double-clicks here must never leak through
 *  to the node's own handlers (focus mode / camera). Playwright verified that a
 *  first click can re-lay the row and the second click lands on the row instead
 *  of a button, so the barrier sits on the row itself, not the buttons. */
export function ActionRow({
  className,
  ...props
}: Omit<ComponentProps<"div">, "ref"> & HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener("dblclick", stop, true);
    el.addEventListener("dblclick", stop, false);
    return () => {
      el.removeEventListener("dblclick", stop, true);
      el.removeEventListener("dblclick", stop, false);
    };
  }, []);

  return <div ref={ref} className={className} {...props} />;
}