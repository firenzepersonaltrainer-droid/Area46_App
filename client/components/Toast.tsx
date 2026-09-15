// glide-ui: 4
// Toast — sonner-backed. Monta <Toaster /> una volta al root; usa toast(...) ovunque.
// toast("Salvato")  toast.success("Fatto")  toast.error("Errore")

import React, { useEffect, useState } from "react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { cn } from "@glide/cn";

export { toast };

export function Toaster({ className, ...props }: ToasterProps) {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  useEffect(() => {
    if (typeof document === "undefined") return;
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner data-slot="toaster" theme={theme} position="bottom-center" visibleToasts={3} className={cn("toaster group", className)}
      style={{
        "--normal-bg": "var(--color-primary)", "--normal-text": "var(--color-background)", "--normal-border": "transparent",
        "--success-bg": "var(--color-success)", "--success-text": "var(--color-background)", "--success-border": "transparent",
        "--error-bg": "var(--color-error)", "--error-text": "var(--color-background)", "--error-border": "transparent",
        "--warning-bg": "var(--color-warning)", "--warning-text": "var(--color-background)", "--warning-border": "transparent",
        "--info-bg": "var(--color-info)", "--info-text": "var(--color-background)", "--info-border": "transparent",
      } as React.CSSProperties}
      toastOptions={{ classNames: { description: "group-[.toast]:text-background/70", actionButton: "group-[.toast]:bg-background group-[.toast]:text-primary", cancelButton: "group-[.toast]:bg-background/20 group-[.toast]:text-background" } }}
      {...props} />
  );
}
Toaster.displayName = "Toaster";