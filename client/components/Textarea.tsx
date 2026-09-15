// glide-ui: 4
// Textarea — styled native <textarea>.
// <Textarea placeholder="Note…" value={v} onChange={e => setV(e.target.value)} />

import React, { forwardRef } from "react";
import { cn } from "@glide/cn";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} data-slot="textarea"
      className={cn("flex min-h-[80px] w-full resize-y rounded-md border border-transparent bg-inset px-3 py-2 text-sm", "placeholder:text-tertiary", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring", "disabled:cursor-not-allowed disabled:opacity-50", "aria-invalid:border-error aria-invalid:ring-error/20", className)}
      {...props} />
  ),
);
Textarea.displayName = "Textarea";