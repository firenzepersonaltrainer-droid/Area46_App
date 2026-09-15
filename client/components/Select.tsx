// glide-ui: 4
// Select — Radix su desktop, native <select> su mobile (OS picker).
// <Select value={v} onValueChange={setV}><SelectTrigger><SelectValue placeholder="Pick one" /></SelectTrigger><SelectContent><SelectItem value="a">A</SelectItem></SelectContent></Select>

import React, { forwardRef, useEffect, useState } from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@glide/cn";

const FINE_POINTER_QUERY = "(any-hover: hover) and (any-pointer: fine)";
function useCanHover(): boolean {
  const [canHover, setCanHover] = useState(() => typeof window !== "undefined" ? window.matchMedia(FINE_POINTER_QUERY).matches : true);
  useEffect(() => {
    const mq = window.matchMedia(FINE_POINTER_QUERY);
    const onChange = () => setCanHover(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return canHover;
}

export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export const SelectTrigger = forwardRef<React.ElementRef<typeof SelectPrimitive.Trigger>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> & { size?: "sm" | "default" }>(
  ({ className, children, size = "default", style, ...props }, ref) => (
    <SelectPrimitive.Trigger ref={ref} data-slot="select-trigger" data-size={size}
      className={cn("cursor-pointer flex w-full items-center justify-between rounded-md border", "px-3 py-2 text-sm", "data-[size=default]:h-9 data-[size=sm]:h-8", "[&>span[data-placeholder]]:text-zinc-400", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring", "disabled:cursor-not-allowed disabled:opacity-50", "aria-invalid:border-error aria-invalid:ring-error/20", "[&>span]:line-clamp-1", className)}
      style={{
        backgroundColor: "#ffffff",
        borderColor: "#e2e5ea",
        color: "#09090b",
        ...style,
      }}
      {...props}>
      {children}
      <SelectPrimitive.Icon asChild><ChevronDown className="h-4 w-4 opacity-70" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  ),
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectScrollUpButton = forwardRef<React.ElementRef<typeof SelectPrimitive.ScrollUpButton>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollUpButton ref={ref} data-slot="select-scroll-up-button" className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronUp className="h-4 w-4" />
    </SelectPrimitive.ScrollUpButton>
  ),
);
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

export const SelectScrollDownButton = forwardRef<React.ElementRef<typeof SelectPrimitive.ScrollDownButton>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>>(
  ({ className, ...props }, ref) => (
    <SelectPrimitive.ScrollDownButton ref={ref} data-slot="select-scroll-down-button" className={cn("flex cursor-default items-center justify-center py-1", className)} {...props}>
      <ChevronDown className="h-4 w-4" />
    </SelectPrimitive.ScrollDownButton>
  ),
);
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export const SelectContent = forwardRef<React.ElementRef<typeof SelectPrimitive.Content>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>>(
  ({ className, children, position = "popper", style, ...props }, ref) => (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content ref={ref} data-slot="select-content"
        className={cn("relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border", "bg-white text-zinc-900 shadow-xl", "data-[state=open]:animate-popover-in data-[state=closed]:animate-popover-out", position === "popper" && "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1", className)}
        style={{
          backgroundColor: "#ffffff",
          borderColor: "#e2e5ea",
          borderWidth: 1,
          borderStyle: "solid",
          color: "#09090b",
          boxShadow: "0 10px 30px rgba(0, 0, 0, 0.12)",
          ...style,
        }}
        position={position} {...props}>
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport className={cn("p-1.5", position === "popper" && "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]")}>
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  ),
);
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectLabel = forwardRef<React.ElementRef<typeof SelectPrimitive.Label>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>>(
  ({ className, ...props }, ref) => <SelectPrimitive.Label ref={ref} data-slot="select-label" className={cn("px-2 py-1.5 text-xs font-semibold text-zinc-500", className)} {...props} />,
);
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const EMPTY_VALUE = " ";
function encodeValue<T extends string | undefined>(v: T): T { return (v === "" ? EMPTY_VALUE : v) as T; }
function decodeValue(v: string): string { return v === EMPTY_VALUE ? "" : v; }

export const SelectItem = forwardRef<React.ElementRef<typeof SelectPrimitive.Item>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>>(
  ({ className, children, style, ...props }, ref) => (
    <SelectPrimitive.Item ref={ref} data-slot="select-item"
      className={cn("relative flex w-full cursor-pointer select-none items-center rounded-md", "py-2 pl-8 pr-3 text-sm outline-none transition-colors", "hover:bg-[#f1f3f6] focus:bg-[#f1f3f6] text-zinc-900", "data-[disabled]:pointer-events-none data-[disabled]:opacity-50", className)}
      style={{
        color: "#09090b",
        ...style,
      }}
      {...props} value={encodeValue(props.value)}>
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator><Check className="h-4 w-4 text-[#1c00ff]" /></SelectPrimitive.ItemIndicator>
      </span>
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  ),
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectSeparator = forwardRef<React.ElementRef<typeof SelectPrimitive.Separator>, React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>>(
  ({ className, ...props }, ref) => <SelectPrimitive.Separator ref={ref} data-slot="select-separator" className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />,
);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

type SelectRootProps = React.ComponentProps<typeof SelectPrimitive.Root>;
function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}
function parseSelectChildren(node: React.ReactNode) {
  let placeholder: string | undefined;
  let size: "sm" | "default" = "default";
  const items: { value: string; label: string; disabled?: boolean }[] = [];
  function visit(n: React.ReactNode) {
    React.Children.forEach(n, (child) => {
      if (!React.isValidElement(child)) return;
      const props = child.props as { size?: "sm" | "default"; placeholder?: string; value?: string; disabled?: boolean; children?: React.ReactNode };
      if (child.type === SelectTrigger) { if (props.size) size = props.size; }
      else if (child.type === SelectValue) { if (typeof props.placeholder === "string") placeholder = props.placeholder; return; }
      else if (child.type === SelectItem) { items.push({ value: props.value ?? "", label: textOf(props.children), disabled: props.disabled }); return; }
      if (props.children !== undefined) visit(props.children);
    });
  }
  visit(node);
  return { placeholder, size, items };
}
function MobileNativeSelect({ value, defaultValue, onValueChange, disabled, name, required, children }: SelectRootProps) {
  const { placeholder, size, items } = parseSelectChildren(children);
  const isControlled = value !== undefined;
  const [internal, setInternal] = useState<string>(defaultValue ?? "");
  const v = isControlled ? (value ?? "") : internal;
  return (
    <div className="relative w-full">
      <select value={v} onChange={(e) => { if (!isControlled) setInternal(e.target.value); onValueChange?.(e.target.value); }} disabled={disabled} name={name} required={required} data-slot="select-trigger" data-size={size}
        style={{ backgroundColor: "#ffffff", borderColor: "#d1d5db", color: "#09090b" }}
        className={cn("flex w-full appearance-none items-center justify-between rounded-md border", "px-3 pr-9 py-2 text-sm", size === "default" ? "h-9" : "h-8", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring", "disabled:cursor-not-allowed disabled:opacity-50", "aria-invalid:border-error aria-invalid:ring-error/20")}>
        {placeholder !== undefined && <option value="" disabled hidden style={{ backgroundColor: "#ffffff", color: "#6b7280" }}>{placeholder}</option>}
        {items.map((i) => <option key={i.value} value={i.value} disabled={i.disabled} style={{ backgroundColor: "#ffffff", color: "#09090b" }}>{i.label}</option>)}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}
export function Select(props: SelectRootProps) {
  const canHover = useCanHover();
  if (canHover) {
    return <SelectPrimitive.Root {...props} onValueChange={props.onValueChange ? (v) => props.onValueChange!(decodeValue(v)) : undefined} />;
  }
  return <MobileNativeSelect {...props} />;
}