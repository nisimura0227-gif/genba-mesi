import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const FIELD_CLASS =
  "w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3.5 text-base shadow-sm transition-colors focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(FIELD_CLASS, className)} {...props} />
);
Input.displayName = "Input";

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn(FIELD_CLASS, className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export function FieldLabel({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-2 block text-base font-bold text-gray-700", className)} {...props} />;
}

export function HelpText({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-xs leading-relaxed text-gray-400", className)} {...props} />;
}
