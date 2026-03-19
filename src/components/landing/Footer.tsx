import Link from "next/link";

import { footerGroups } from "@/config/landing";
import { Container } from "@/components/ui/Container";

export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-black py-12">
      <Container>
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <Link
            href="#top"
            className="font-display text-2xl font-extrabold italic tracking-tight text-lime-100"
          >
            Rivaly
          </Link>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            {footerGroups.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                  {group.title}
                </p>
                <ul className="space-y-2">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-sm text-white/70 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/35">
            © {new Date().getFullYear()} Rivaly. Kinetic high-stakes minimalism.
          </p>
        </div>
      </Container>
    </footer>
  );
}
