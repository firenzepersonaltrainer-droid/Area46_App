// glide-ui: 4
//
// Button — primary action with variants, sizes, loading state, asChild.
// variants: primary | primary-neutral | primary-destructive | secondary | secondary-destructive | tertiary | ghost | ghost-destructive
// sizes: xs (h-6) | sm (h-8) | md (h-9, default) | lg (h-10) | xl (h-11) | 2xl (h-12) | icon (size-9)
// md/sm match Input + Select default/sm heights, so default-with-default composes flush in a row
// <Button variant="primary" isLoading>Save</Button>

import React, { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@glide/cn";

const buttonVariants = cva(
  "cursor-pointer inline-flex items-center justify-center whitespace-nowrap rounded-lg " +
    "text-sm font-semibold transition-all " +
    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
    "outline-none focus-visible:border-focus-ring " +
    "focus-visible:ring-focus-ring/50 focus-visible:ring-[3px] " +
    "aria-invalid:ring-error/20 aria-invalid:border-error " +
    "shrink-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:m-0 " +
    "[&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        primary: "bg-accent text-accent-fg hover:bg-accent-hover",
        "primary-neutral": "bg-primary text-background hover:bg-primary/90",
        "primary-destructive":
          "bg-error text-white hover:bg-error/90 focus-visible:ring-error/20",
        secondary: "bg-inset text-primary hover:bg-border",
        "secondary-destructive": "bg-error/10 text-error hover:bg-error/20",
        tertiary: "border border-border bg-background hover:bg-inset",
        outline: "border border-border bg-background hover:bg-inset",
        destructive: "bg-error text-white hover:bg-error/90 focus-visible:ring-error/20",
        ghost: "hover:bg-inset",
        "ghost-destructive": "text-error hover:bg-error/10",
      },
      size: {
        xs: "h-6 gap-1 px-2 has-[>svg:not(.animate-spin)]:px-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        sm: "h-8 gap-1.5 px-3 has-[>svg:not(.animate-spin)]:px-2.5",
        md: "h-9 gap-2 px-4 has-[>svg:not(.animate-spin)]:px-3",
        lg: "h-10 gap-2 px-5 has-[>svg:not(.animate-spin)]:px-4",
        xl: "h-11 gap-2 px-6 has-[>svg:not(.animate-spin)]:px-5",
        "2xl": "h-12 gap-2.5 px-8 has-[>svg:not(.animate-spin)]:px-6",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, isLoading, disabled, type, children, onClick, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const isDisabled = disabled || isLoading;
    const showLoadingUI = isLoading && !asChild;
    const buttonType = asChild ? undefined : (type ?? "button");
    const handleClick = isDisabled
      ? (event: React.MouseEvent<HTMLButtonElement>) => {
          event.preventDefault();
          event.stopPropagation();
        }
      : onClick;
    return (
      <Comp
        ref={ref}
        data-slot="button"
        type={buttonType}
        className={cn(buttonVariants({ variant, size, className }), showLoadingUI && "relative")}
        disabled={asChild ? undefined : isDisabled}
        data-disabled={isDisabled || undefined}
        aria-disabled={isDisabled || undefined}
        aria-busy={isLoading || undefined}
        onClick={handleClick}
        {...props}
      >
        {showLoadingUI ? (
          <>
            <span className="invisible inline-flex items-center gap-2">{children}</span>
            <Loader2 className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
            <span className="sr-only">Loading...</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };