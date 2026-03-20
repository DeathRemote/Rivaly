import Link from "next/link";

import { navItems } from "@/config/landing";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-black focus:px-3 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="#top"
          className={cn(
            "font-display text-2xl font-extrabold italic tracking-tight text-lime-100",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
          )}
        >
          Rivaly
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "font-display text-sm font-bold tracking-tight",
                item.href === "#top"
                  ? "text-lime-100 underline decoration-lime-200/60 underline-offset-[10px]"
                  : "text-white/60 hover:text-white",
                "transition-colors",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            href="#pricing"
            variant="primary"
            size="sm"
            className="hidden sm:inline-flex"
          >
            Get started
          </Button>
          <Button href="#pricing" variant="secondary" size="sm" className="sm:hidden">
            Start
          </Button>
        </div>
      </Container>
    </header>
  );
}
