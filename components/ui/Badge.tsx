import { cn } from "@/lib/utils";

export type BadgeVariant = "success" | "warning" | "neutral" | "danger";

const VARIANTS: Record<BadgeVariant, string> = {
  success: "bg-brand-soft text-brand-darker border border-brand/15",
  warning: "bg-accent-soft text-accent-dark border border-accent/20",
  neutral: "bg-gray-100 text-gray-600 border border-gray-200",
  danger: "bg-red-50 text-red-600 border border-red-200",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-sm font-bold",
        VARIANTS[variant],
        className
      )}
      {...props}
    />
  );
}
