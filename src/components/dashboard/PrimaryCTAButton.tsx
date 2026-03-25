import Link from "next/link";

import { cn } from "@/lib/cn";

type BaseProps = {
  children: React.ReactNode;
  className?: string;
};

type ButtonProps = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined;
  };

type LinkButtonProps = BaseProps & {
  href: string;
};

export function PrimaryCTAButton(props: ButtonProps | LinkButtonProps) {
  const classes = cn(
    "w-full rounded-xl px-6 py-4",
    "bg-gradient-to-br from-lime-100 to-lime-400 text-black",
    "font-display text-sm font-black uppercase tracking-[0.18em]",
    "shadow-lg shadow-lime-400/15",
    "hover:brightness-110 active:scale-[0.98] transition",
    props.className,
  );

  if ("href" in props && typeof props.href === "string") {
    return (
      <Link href={props.href} className={classes}>
        {props.children}
      </Link>
    );
  }

  const { children, ...rest } = props;
  return (
    <button {...rest} className={classes}>
      {children}
    </button>
  );
}
