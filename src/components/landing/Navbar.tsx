"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { navItems } from "@/config/landing";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";

export function Navbar() {
  const [activeHref, setActiveHref] = useState<string>("#top");

  const sectionIds = useMemo(
    () => navItems.map((i) => i.href).filter((href) => href.startsWith("#")),
    [],
  );

  useEffect(() => {
    const targets = sectionIds
      .map((href) => document.getElementById(href.slice(1)))
      .filter(Boolean) as HTMLElement[];

    if (targets.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the most visible intersecting section.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (b.intersectionRatio ?? 0) - (a.intersectionRatio ?? 0));

        if (visible[0]?.target?.id) {
          setActiveHref(`#${visible[0].target.id}`);
        }
      },
      {
        root: null,
        // Trigger when a section is near the top third of the viewport.
        rootMargin: "-30% 0px -60% 0px",
        threshold: [0.1, 0.25, 0.5, 0.75],
      },
    );

    targets.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [sectionIds]);

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
          onClick={() => setActiveHref("#top")}
        >
          Rivaly
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => {
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setActiveHref(item.href)}
                className={cn(
                  "font-display text-sm font-bold tracking-tight transition-colors",
                  active
                    ? "text-lime-100 underline decoration-lime-200/60 underline-offset-[10px]"
                    : "text-white/60 hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <Button href="/login" variant="primary" size="sm">
            Log in
          </Button>
        </div>
      </Container>
    </header>
  );
}
