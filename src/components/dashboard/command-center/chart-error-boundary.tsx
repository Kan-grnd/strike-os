"use client";

import { Component, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  children: ReactNode;
  className?: string;
}

interface State {
  hasError: boolean;
}

export class ChartErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error("Chart render error:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "flex min-h-40 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground",
            this.props.className
          )}
        >
          This chart could not be drawn.
        </div>
      );
    }
    return this.props.children;
  }
}
