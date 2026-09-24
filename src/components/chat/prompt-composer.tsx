"use client";

import React, { createContext, useContext, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

// Adapted from prompt-kit's <PromptInput> (github.com/ibelick/prompt-kit, MIT)
// — reduced to a controlled composer that fits Strike OS tokens and React 18.

type PromptComposerContextType = {
  value: string;
  setValue: (v: string) => void;
  disabled: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

const Ctx = createContext<PromptComposerContextType | null>(null);

function useComposer(): PromptComposerContextType {
  const c = useContext(Ctx);
  if (!c) throw new Error("useComposer must be used within <PromptComposer>");
  return c;
}

export function PromptComposer({
  className,
  value,
  onValueChange,
  children,
  disabled = false,
  textareaRef: externalRef,
  ...props
}: {
  className?: string;
  value: string;
  onValueChange: (v: string) => void;
  children?: React.ReactNode;
  disabled?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
} & React.ComponentProps<"div">) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null);
  const textareaRef = externalRef ?? internalRef;

  const handleBoxClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    // Let interactions inside (picker, buttons) keep their own target.
    const t = e.target as HTMLElement;
    if (t.tagName === "TEXTAREA") return;
    if (t.closest("button, a, input, [role=combobox], [role=option]")) return;
    if (!disabled) textareaRef.current?.focus();
  };

  return (
    <Ctx.Provider
      value={{ value, setValue: onValueChange, disabled, textareaRef }}
    >
      <div
        onClick={handleBoxClick}
        className={cn(
          "cursor-text rounded-3xl border border-border bg-card p-3 shadow-sm transition-[border-color,box-shadow] focus-within:border-input focus-within:border-ring/60 focus-within:ring-2 focus-within:ring-ring/30",
          disabled && "cursor-not-allowed opacity-60",
          className
        )}
        {...props}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

export function PromptTextarea({
  className,
  maxHeight = 200,
  rows = 1,
  ...props
}: {
  className?: string;
  maxHeight?: number;
  rows?: number;
} & React.ComponentProps<"textarea">) {
  const { value, setValue, disabled, textareaRef } = useComposer();

  const adjust = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  };

  useLayoutEffect(() => {
    adjust(textareaRef.current);
  }, [value, maxHeight, textareaRef]);

  return (
    <textarea
      ref={textareaRef as React.Ref<HTMLTextAreaElement>}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      rows={rows}
      disabled={disabled}
      className={cn(
        "block max-h-[200px] w-full resize-none border-none bg-transparent px-1 pb-1 pt-1 text-base leading-snug text-foreground outline-none [overflow-wrap:anywhere] placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:ring-offset-0 disabled:opacity-60",
        className
      )}
      {...props}
    />
  );
}