// glide-ui: 4
// Tabs — pill-style, Radix-backed.
// <Tabs defaultValue="a"><TabsList><TabsTrigger value="a">A</TabsTrigger></TabsList><TabsContent value="a">…</TabsContent></Tabs>

import React, { forwardRef, useEffect, useRef } from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@glide/cn";

export const Tabs = forwardRef<React.ElementRef<typeof TabsPrimitive.Root>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Root ref={ref} data-slot="tabs" className={cn("data-[orientation=vertical]:flex data-[orientation=vertical]:gap-4", className)} {...props} />
  ),
);
Tabs.displayName = TabsPrimitive.Root.displayName;

export const TabsList = forwardRef<React.ElementRef<typeof TabsPrimitive.List>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>>(
  ({ className, children, ...props }, ref) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (el.scrollWidth <= el.clientWidth) return;
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        const atStart = el.scrollLeft <= 0 && e.deltaY < 0;
        const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1 && e.deltaY > 0;
        if (atStart || atEnd) return;
        e.preventDefault();
        el.scrollLeft += e.deltaMode ? e.deltaY * 24 : e.deltaY;
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, []);
    return (
      <TabsPrimitive.List ref={ref} data-slot="tabs-list" className={cn("group/tabs-list flex w-fit max-w-full max-h-full rounded-lg bg-inset", "data-[orientation=vertical]:h-fit", className)} {...props}>
        <div ref={scrollerRef} className={cn("flex min-w-0 min-h-0 items-center justify-start gap-1 overflow-auto scrollbar-none rounded-lg p-1", "group-data-[orientation=vertical]/tabs-list:flex-col group-data-[orientation=vertical]/tabs-list:items-stretch")}>
          {children}
        </div>
      </TabsPrimitive.List>
    );
  },
);
TabsList.displayName = TabsPrimitive.List.displayName;

export const TabsTrigger = forwardRef<React.ElementRef<typeof TabsPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Trigger ref={ref} data-slot="tabs-trigger"
      className={cn("cursor-pointer inline-flex h-7 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium", "transition-colors", "disabled:pointer-events-none disabled:opacity-50", "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4", "text-secondary hover:text-primary", "data-[state=active]:bg-raised data-[state=active]:text-primary data-[state=active]:shadow-sm", "outline-none focus-visible:border-focus-ring", "focus-visible:ring-focus-ring/50 focus-visible:ring-[3px]", "data-[orientation=vertical]:justify-start", className)}
      {...props} />
  ),
);
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

export const TabsContent = forwardRef<React.ElementRef<typeof TabsPrimitive.Content>, React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>>(
  ({ className, ...props }, ref) => (
    <TabsPrimitive.Content ref={ref} data-slot="tabs-content" className={cn("outline-none data-[orientation=vertical]:flex-1", className)} {...props} />
  ),
);
TabsContent.displayName = TabsPrimitive.Content.displayName;