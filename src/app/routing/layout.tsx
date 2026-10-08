import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = { title: "Routing" };

export default function RouteLayout({ children }: { children: ReactNode }) {
  return children;
}
