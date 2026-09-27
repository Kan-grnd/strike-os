import { Button } from "@/components/ui/button";
import type { ComponentProps, KeyboardEvent, MouseEvent } from "react";

/** shadcn Button that deliberately stops propagation: a card-level click
 *  would otherwise double-fire the node's click/double-click handlers. */
export function CardButton({
  onClick,
  ...props
}: Omit<ComponentProps<typeof Button>, "onClick" | "onKeyDown"> & {
  onClick?: () => void;
}) {
  return (
    <Button
      {...props}
      onClick={(e: MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        onClick?.();
      }}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => e.stopPropagation()}
    />
  );
}