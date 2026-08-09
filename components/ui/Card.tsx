import { cn } from "@/lib/utils";

/** 白背景・角丸・柔らかい二重の影で立体感を出したカード。 */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-2xl border border-black/[0.04] bg-white p-4 shadow-card", className)}
      {...props}
    />
  );
}

export function CardSection({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-t border-gray-100 pt-3", className)} {...props} />;
}
