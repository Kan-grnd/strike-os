"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { THEME_PACKS, DEFAULT_THEME } from "@/lib/theme-packs";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const activePack = THEME_PACKS.some((p) => p.id === theme) ? theme : DEFAULT_THEME;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Palette className="h-4 w-4" />
          <span className="sr-only">Theme packs</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {THEME_PACKS.map((p) => (
          <DropdownMenuItem key={p.id} onClick={() => setTheme(p.id)}>
            <span
              className="mr-2 inline-block h-3.5 w-3.5 rounded-full border border-black/20"
              style={{ background: p.bg }}
            />
            <span className={activePack === p.id ? "font-medium" : undefined}>
              {p.name}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}