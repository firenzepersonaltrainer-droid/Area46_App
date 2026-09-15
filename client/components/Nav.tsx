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
        "w-[calc(100%-20px)] max-w-[390px]",
        "rounded-full bg-[#09090b]/95 border border-zinc-800 shadow-2xl backdrop-blur-md",
        "p-1.5",
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
                "flex flex-col items-center justify-center relative",
                "rounded-full px-2.5 py-1.5",
                "min-w-[60px] flex-1 shrink-0",
                "text-[10px] font-bold tracking-tight",
                "transition-all duration-200",
                "outline-none focus-visible:ring-focus-ring/50 focus-visible:ring-[2px]",
                "[&_svg]:size-5",
                active
                  ? "bg-[#1c00ff] text-white shadow-lg"
                  : "text-zinc-400 hover:text-white",
              )}
            >
              {item.icon}
              <span className="truncate mt-0.5">{item.label}</span>
              {active && (
                <span className="w-1 h-1 rounded-full bg-[#e3ff00] absolute -bottom-0.5 shadow-[0_0_6px_#e3ff00]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
Nav.displayName = "Nav";