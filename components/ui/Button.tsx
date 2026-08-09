import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "accent" | "outline" | "ghost" | "danger" | "muted";
export type ButtonSize = "default" | "lg" | "sm";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-bold transition-all active:scale-[0.98] active:translate-y-px disabled:opacity-50 disabled:active:scale-100 disabled:active:translate-y-0 disabled:pointer-events-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-gradient text-white shadow-pop active:shadow-none",
  accent: "bg-accent-gradient text-white shadow-pop active:shadow-none",
  outline: "border-2 border-brand bg-white text-brand-dark shadow-sm active:bg-brand-light",
  ghost: "border-2 border-gray-200 bg-white text-gray-600 active:bg-gray-50",
  danger: "bg-red-50 text-red-500 active:bg-red-100",
  muted: "bg-gray-100 text-gray-600 active:bg-gray-200",
};

const SIZES: Record<ButtonSize, string> = {
  default: "min-h-[52px] px-5 py-3 text-base",
  lg: "min-h-[64px] px-6 py-4 text-xl",
  sm: "min-h-[40px] rounded-xl px-3 py-2 text-sm",
};

/**
 * shadcn/ui 風のボタンスタイルを、Link や button など任意のタグへ適用するための
 * クラス名生成関数。「asChild」の代わりにこの関数をそのまま className に渡して使う。
 */
export function buttonVariants(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "default",
  className?: string
) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "default", ...props }, ref) => (
    <button ref={ref} className={buttonVariants(variant, size, className)} {...props} />
  )
);
Button.displayName = "Button";

export default Button;
