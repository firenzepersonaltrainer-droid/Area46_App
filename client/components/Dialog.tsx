// glide-ui: 4
// Dialog — modal su desktop, bottom sheet (vaul) su mobile.
// parts: Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose, DialogPortal, DialogOverlay

import React, { createContext, forwardRef, useContext, useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer as VaulDrawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@glide/cn";

const DESKTOP_QUERY = "(min-width: 768px)";

function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(DESKTOP_QUERY).matches : true,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return isDesktop;
}

const MobileSheetContext = createContext(false);

type DialogRootProps = React.ComponentProps<typeof DialogPrimitive.Root>;

export function Dialog(props: DialogRootProps) {
  const isDesktop = useIsDesktop();
  if (isDesktop) return <DialogPrimitive.Root {...props} />;
  return (
    <MobileSheetContext.Provider value={true}>
      <VaulDrawer.Root {...props} />
    </MobileSheetContext.Provider>
  );
}

export const DialogTrigger = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const isMobile = useContext(MobileSheetContext);
  return isMobile ? <VaulDrawer.Trigger ref={ref} {...props} /> : <DialogPrimitive.Trigger ref={ref} {...props} />;
});
DialogTrigger.displayName = "DialogTrigger";

export const DialogPortal = ({ children, ...props }: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>) => {
  const isMobile = useContext(MobileSheetContext);
  return isMobile ? (
    <VaulDrawer.Portal {...props}>{children}</VaulDrawer.Portal>
  ) : (
    <DialogPrimitive.Portal {...props}>{children}</DialogPrimitive.Portal>
  );
};
DialogPortal.displayName = "DialogPortal";

export const DialogClose = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>((props, ref) => {
  const isMobile = useContext(MobileSheetContext);
  return isMobile ? <VaulDrawer.Close ref={ref} {...props} /> : <DialogPrimitive.Close ref={ref} {...props} />;
});
DialogClose.displayName = "DialogClose";

export const DialogOverlay = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const isMobile = useContext(MobileSheetContext);
  const Cmp = isMobile ? VaulDrawer.Overlay : DialogPrimitive.Overlay;
  return (
    <Cmp
      ref={ref}
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/60",
        "data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out",
        className,
      )}
      {...props}
    />
  );
});
DialogOverlay.displayName = "DialogOverlay";

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  hideCloseButton?: boolean;
};

export const DialogContent = forwardRef<React.ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, hideCloseButton, ...props }, ref) => {
    const isMobile = useContext(MobileSheetContext);
    if (!isMobile) {
      return (
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            ref={ref}
            data-slot="dialog-content"
            className={cn(
              "fixed left-[50%] top-[50%] z-50 grid w-[calc(100vw-32px)] max-w-[390px] translate-x-[-50%] translate-y-[-50%]",
              "gap-4 border bg-raised p-6 shadow-lg sm:rounded-2xl",
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
                  "absolute right-4 top-4 rounded-sm opacity-70 transition-opacity",
                  "hover:opacity-100",
                  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  "disabled:pointer-events-none",
                  "data-[state=open]:bg-inset data-[state=open]:text-secondary",
                )}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </DialogPrimitive.Close>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      );
    }
    return (
      <DialogPortal>
        <DialogOverlay />
        <VaulDrawer.Content
          ref={ref}
          data-slot="dialog-content"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto max-h-[90vh] flex-col",
            "rounded-t-2xl border-t border-border-weak bg-raised shadow-lg",
            "outline-none",
            className,
          )}
          {...props}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-border-strong" />
          <div
            className="flex flex-col gap-4 px-6 pt-4 pb-6"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          >
            {children}
            {!hideCloseButton && (
              <VaulDrawer.Close
                data-slot="dialog-close"
                className={cn(
                  "absolute right-4 top-4 rounded-sm opacity-70 transition-opacity",
                  "hover:opacity-100",
                  "outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  "disabled:pointer-events-none",
                )}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </VaulDrawer.Close>
            )}
          </div>
        </VaulDrawer.Content>
      </DialogPortal>
    );
  },
);
DialogContent.displayName = "DialogContent";

export const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-header" className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

export const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div data-slot="dialog-footer" className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

export const DialogTitle = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const isMobile = useContext(MobileSheetContext);
  const Cmp = isMobile ? VaulDrawer.Title : DialogPrimitive.Title;
  return (
    <Cmp
      ref={ref}
      data-slot="dialog-title"
      className={cn("text-base font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  );
});
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const isMobile = useContext(MobileSheetContext);
  const Cmp = isMobile ? VaulDrawer.Description : DialogPrimitive.Description;
  return (
    <Cmp ref={ref} data-slot="dialog-description" className={cn("text-sm text-secondary", className)} {...props} />
  );
});
DialogDescription.displayName = "DialogDescription";