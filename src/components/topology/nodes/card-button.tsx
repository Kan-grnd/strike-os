import { Button } from "@/components/ui/button";
import { useEffect, useRef, type ComponentProps, type KeyboardEvent, type MouseEvent } from "react";

/** shadcn Button that deliberately stops propagation: a card-level click
 *  would otherwise double-fire the node's click/double-click handlers, and the
 *  pane's native d3 double-click zoom cannot be stopped from a React handler
 *  (React delegates at the root, which is too late), so we stop the native
 *  `dblclick` on the element itself. */
export function CardButton({
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "onKeyDown"> & {
  onClick?: () => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

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

  return (
    <Button
      ref={ref}
      {...props}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => e.stopPropagation()}
    />
  );
}