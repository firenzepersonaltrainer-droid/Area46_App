// glide-ui: 4
// Input — styled native <input>.
// <Input type="email" placeholder="jane@…" value={email} onChange={e => setEmail(e.target.value)} />

import React, { forwardRef } from "react";
import { cn } from "@glide/cn";

export type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: "sm" | "default";
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, size = "default", ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      data-slot="input"
      data-size={size}
      className={cn(
        "flex w-full rounded-md border border-transparent bg-inset px-3 py-2 text-sm",
        "data-[size=default]:h-9 data-[size=sm]:h-8",
        "file:border-0 file:bg-transparent file:text-xs file:font-medium file:text-primary",
        "placeholder:text-tertiary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-error aria-invalid:ring-error/20",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";