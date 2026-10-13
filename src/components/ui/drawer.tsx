"use client";

import * as React from "react";
import * as DrawerPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

const Drawer = DrawerPrimitive.Root;
const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 glass-scrim data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> & {
    /**
     * Which edge the drawer is anchored to. Navigation lives on the left, so a
     * left drawer has to slide in from the left and put its close button on the
     * left too; the side button on the right of a left-anchored panel reads as
     * belonging to whatever is behind it.
     */
    side?: "left" | "right";
    /**
     * Must match the `modal` prop given to `Drawer`. A modal dialog sets
     * `pointer-events: none` on the body to hold the page still, which means a
     * scrim cannot simply be layered behind it — everything the user needs to
     * reach has to sit on top of that, and no z-index can lift a descendant of a
     * `pointer-events: none` body. Non-modal drawers therefore skip the scrim
     * entirely, which is also the honest thing to draw: nothing is being
     * blocked.
     */
    modal?: boolean;
  }
>(({ className, children, side = "right", modal = true, ...props }, ref) => (
  <DrawerPortal>
    {modal && <DrawerOverlay />}
    <DrawerPrimitive.Content
      ref={ref}
      data-side={side}
      className={cn(
        "fixed z-50 flex flex-col gap-4 border-l glass-elevated p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 pointer-events-auto",
        side === "right" && "right-0 top-0 h-full w-96 max-w-[90vw] rounded-l-xl",
        side === "left" && "left-0 top-0 h-full w-72 max-w-[80vw] rounded-r-xl border-l-0 border-r",
        className
      )}
      {...props}
    >
      <DrawerClose className="absolute right-4 top-4 rounded-xl opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground data-[side=left]:left-4 data-[side=left]:right-auto">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DrawerClose>
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = DrawerPrimitive.Content.displayName;

const DrawerHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("grid gap-1.5 p-4", className)}
    {...props}
  />
);
DrawerHeader.displayName = "DrawerHeader";

const DrawerFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("mt-auto flex flex-col gap-2 p-4", className)}
    {...props}
  />
);
DrawerFooter.displayName = "DrawerFooter";

const DrawerTitle = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerClose,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};