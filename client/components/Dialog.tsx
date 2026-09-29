// Radix Dialog unificato — modal universale responsive con scorrimento garantito su mobile e desktop.
import React, { forwardRef } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@glide/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogPortal = DialogPrimitive.Portal;
export const DialogClose = DialogPrimitive.Close;

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    data-slot="dialog-overlay"
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs",
      "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = "DialogOverlay";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  hideCloseButton?: boolean;
};

export const DialogContent = forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, hideCloseButton, ...props }, ref) => (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        data-slot="dialog-content"
        className={cn(
          "fixed left-[50%] top-[50%] z-50 translate-x-[-50%] translate-y-[-50%]",
          "w-[calc(100vw-24px)] max-w-lg max-h-[88vh] overflow-y-auto",
          "flex flex-col gap-4 bg-white p-5 sm:p-6 shadow-2xl rounded-3xl border border-zinc-200",
          "outline-none overscroll-contain [scrollbar-width:thin]",
          "data-[state=open]:animate-dialog-in data-[state=closed]:animate-dialog-out",
          className,
        )}
        {...props}
      >
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className={cn(
              "absolute right-4 top-4 rounded-full p-1 opacity-70 transition-opacity hover:opacity-100 hover:bg-zinc-100 text-zinc-600 cursor-pointer",
              "outline-none focus-visible:ring-2 focus-visible:ring-[#1c00ff]",
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Chiudi</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  ),
);
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-header" className={cn("flex flex-col space-y-1.5 text-left shrink-0", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end pt-2 shrink-0", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    data-slot="dialog-title"
    className={cn("text-lg font-black leading-tight tracking-tight text-zinc-900", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    data-slot="dialog-description"
    className={cn("text-xs text-zinc-500", className)}
    {...props}
  />
));
DialogDescription.displayName = "DialogDescription";