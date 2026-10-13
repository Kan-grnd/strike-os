"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type ModelPickerModel = {
  id: string;
  name: string;
  provider: { name: string };
};

/**
 * Themed model picker for the chat composer. Replaces the native <select> so
 * the popup matches Strike OS tokens instead of the browser's default menu.
 */
export function ModelPicker({
  models,
  value,
  onChange,
  disabled = false,
}: {
  models: ModelPickerModel[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}) {
  const selected = models.find((m) => m.id === value);
  const empty = models.length === 0;

  return (
    <SelectPrimitive.Root
      value={value ?? ""}
      onValueChange={(v) => onChange(v || null)}
      disabled={disabled || empty}
    >
      <SelectPrimitive.Trigger
        aria-label="Model"
        className={cn(
          "flex h-8 min-w-0 max-w-[46%] shrink items-center gap-1.5 rounded-full border glass-control px-2.5 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:ring-2 data-[state=open]:ring-ring/40 disabled:opacity-50"
        )}
      >
        <span className="truncate">
          {empty
            ? "No models configured"
            : selected
              ? `${selected.name} · ${selected.provider.name}`
              : "Select model"}
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          side="top"
          align="start"
          sideOffset={6}
          className="z-50 max-h-64 overflow-hidden rounded-xl border glass-elevated text-popover-foreground"
        >
          <SelectPrimitive.ScrollUpButton className="flex h-5 items-center justify-center text-muted-foreground">
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          </SelectPrimitive.ScrollUpButton>
          <SelectPrimitive.Viewport className="p-1">
            {models.map((m) => (
              <SelectPrimitive.Item
                key={m.id}
                value={m.id}
                className="relative flex cursor-pointer select-none items-center rounded-xl py-1.5 pl-7 pr-3 text-[13px] text-foreground outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3.5 w-3.5" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>
                  {m.name} · {m.provider.name}
                </SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
          <SelectPrimitive.ScrollDownButton className="flex h-5 items-center justify-center text-muted-foreground">
            <ChevronDown className="h-3.5 w-3.5" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}