import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold tracking-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-50";

const variants: Record<Variant, string> = {
  primary:
    "bg-lime-400 text-black shadow-[0_0_28px_rgba(202,253,0,0.25)] hover:brightness-110 active:translate-y-px",
  secondary:
    "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/8 active:translate-y-px",
  ghost:
    "bg-transparent text-white/80 hover:text-white hover:bg-white/5",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export type ButtonProps = {
  variant?: Variant;
  size?: Size;
} & (
  | ({ href: string } & Omit<ComponentProps<typeof Link>, "href">)
  | Omit<ComponentProps<"button">, "className"> & { href?: undefined }
) & {
    className?: string;
  };

export function Button(props: ButtonProps) {
  const { className, variant = "secondary", size = "md" } = props;

  const classes = cn(base, variants[variant], sizes[size], className);

  if ("href" in props && typeof props.href === "string") {
    const { href, ...rest } = props;
    return (
      <Link href={href} className={classes} {...rest} />
    );
  }

  const { ...rest } = props;
  return <button className={classes} type="button" {...rest} />;
}
