// glide-ui: 4
// Nav — top bar (desktop) + floating bottom pill (mobile).
// <Nav items={[{ href: "/", label: "Home", icon: <Home /> }]} />

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@glide/cn";

export interface NavItem { href: string; label: string; icon: React.ReactNode; }
export interface NavProps { items: NavItem[]; layout?: "top" | "sidebar"; className?: string; }

export function Nav({ items, className }: NavProps) {
  const { pathname } = useLocation();

  if (items.length <= 1) return null;
  const isActive = (href: string) =>
    pathname === href || (href !== "/" && pathname.startsWith(href + "/"));

  return (
    <nav
      data-slot="nav-mobile"
      className={cn(
        "fixed sm:absolute bottom-3 left-1/2 -translate-x-1/2 z-40",
        "w-[calc(100%-24px)] max-w-[390px]",
        "rounded-full bg-white/95 border border-zinc-200/90 shadow-xl backdrop-blur-md",
        "p-1",
        className,
      )}
    >
      <div className="flex items-center justify-around gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5",
                "rounded-full px-2.5 py-1.5",
                "min-w-[60px] flex-1 shrink-0",
                "text-[10px] font-medium",
                "transition-colors duration-150",
                "outline-none focus-visible:ring-focus-ring/50 focus-visible:ring-[3px]",
                "[&_svg]:size-5",
                active
                  ? "bg-[#1c00ff]/10 text-[#1c00ff] font-bold"
                  : "text-zinc-500 hover:text-zinc-900",
              )}
            >
              {item.icon}
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
Nav.displayName = "Nav";