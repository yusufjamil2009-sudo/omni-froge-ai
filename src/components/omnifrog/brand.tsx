import { cn } from "@/lib/utils";

export function OmniFrogMark({
  className,
  subtitle,
  size = "md",
}: {
  className?: string;
  subtitle?: string;
  size?: "sm" | "md" | "lg";
}) {
  const title = size === "lg" ? "text-3xl sm:text-4xl" : size === "sm" ? "text-base" : "text-xl";

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span
        aria-hidden
        className={cn(
          "grid place-items-center rounded-xl border border-border/70 bg-card shadow-[var(--shadow-soft)]",
          size === "lg" ? "size-12 text-2xl" : size === "sm" ? "size-8 text-base" : "size-10 text-xl",
        )}
      >
        🐸
      </span>
      <span className="min-w-0">
        <span className={cn("block font-semibold tracking-tight brand-mark", title)}>
          OmniFrog AI
        </span>
        {subtitle ? (
          <span className="block truncate text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
    </div>
  );
}
