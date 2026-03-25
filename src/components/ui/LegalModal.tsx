"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";

export type LegalModalMode = "privacy" | "terms";

export function LegalModal({
  open,
  mode,
  onClose,
}: {
  open: boolean;
  mode: LegalModalMode;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Focus the close button on open (basic a11y).
    closeBtnRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);

    // Prevent background scroll while modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const title = mode === "privacy" ? "Privacy Policy" : "Terms & Conditions";

  return (
    <div
      className={cn(
        "fixed inset-0 z-[100]",
        "flex items-center justify-center",
        "px-4 py-6 sm:px-6",
      )}
      aria-modal="true"
      role="dialog"
      aria-label={title}
      onMouseDown={(e) => {
        // Close only when clicking the backdrop, not when dragging inside content.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        ref={panelRef}
        className={cn(
          "relative w-full max-w-2xl",
          "rounded-3xl border border-white/10",
          "bg-black/60 shadow-2xl",
          "backdrop-blur-xl",
          "overflow-hidden",
          "animate-in fade-in zoom-in-95 duration-200",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
              Legal
            </div>
            <h2 className="mt-1 font-display text-xl font-black italic tracking-tight text-white">
              {title}
            </h2>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            className={cn(
              "rounded-xl border border-white/10 bg-white/5",
              "px-3 py-2 text-xs font-black uppercase tracking-[0.18em]",
              "text-white/70 hover:bg-white/10 hover:text-white",
              "focus:outline-none focus:ring-2 focus:ring-lime-300/40",
            )}
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-6 py-6">
          {mode === "privacy" ? <PrivacyPolicyContent /> : <TermsContent />}
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white/80">
        {title}
      </h3>
      <div className="mt-2 space-y-3 text-sm leading-6 text-white/60">{children}</div>
    </section>
  );
}

function PrivacyPolicyContent() {
  return (
    <div>
      <Section title="Introduction">
        <p>
          Rivaly ("we", "our", "us") operates a platform for sports predictions and social competition.
          This Privacy Policy explains how we collect, use, and protect your information.
        </p>
        <p className="mt-2 text-sm opacity-70">Last updated: March 25, 2026</p>
      </Section>

      <Section title="Information We Collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>Account information (email address, username)</li>
          <li>User-generated content (predictions, group activity, interactions)</li>
          <li>Usage data (pages visited, interactions, device and browser information, IP address)</li>
          <li>Technical data (cookies, session data, analytics)</li>
        </ul>
      </Section>

      <Section title="How We Use Your Information">
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide and operate the Rivaly platform</li>
          <li>Improve features and user experience</li>
          <li>Enable social functionality such as groups and leaderboards</li>
          <li>Monitor performance, security, and abuse</li>
          <li>Display relevant advertisements</li>
        </ul>
      </Section>

      <Section title="Cookies and Tracking Technologies">
        <p>
          We use cookies and similar technologies to keep users logged in, understand user behavior,
          and improve the performance of the platform.
        </p>
      </Section>

      <Section title="Google AdSense">
        <p>
          We use Google AdSense to display advertisements. Google may use cookies (including the
          DoubleClick cookie) to serve ads based on users’ visits to this and other websites.
        </p>
        <p className="mt-2">
          Users may opt out of personalized advertising by visiting{" "}
          <a
            className="text-lime-200/80 hover:text-lime-200 underline underline-offset-4"
            href="https://adssettings.google.com"
            target="_blank"
          >
            https://adssettings.google.com
          </a>
          .
        </p>
      </Section>

      <Section title="Data Sharing">
        <p>
          We do not sell personal data. We may share data with trusted third-party services required
          to operate the platform, including hosting providers, analytics tools, and advertising partners.
        </p>
      </Section>

      <Section title="Data Retention">
        <p>
          We retain user data only as long as necessary to provide the service and comply with legal obligations.
        </p>
      </Section>

      <Section title="User Rights">
        <p>
          You may request access, correction, or deletion of your data at any time by contacting us.
        </p>
      </Section>

      <Section title="Data Security">
        <p>
          We take reasonable technical and organizational measures to protect your data. However,
          no system can be guaranteed to be completely secure.
        </p>
      </Section>

      <Section title="Children’s Privacy">
        <p>
          Rivaly is not intended for users under the age of 13 (or the minimum legal age in your jurisdiction).
        </p>
      </Section>

      <Section title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. Continued use of the platform
          constitutes acceptance of any changes.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          If you have questions about this Privacy Policy, contact us at{" "}
          <a
            className="text-lime-200/80 hover:text-lime-200 underline underline-offset-4"
            href="mailto:rivalyab@gmail.com"
          >
            rivalyab@gmail.com
          </a>
          .
        </p>
      </Section>
    </div>
  );
}

function TermsContent() {
  return (
    <div>
      <Section title="Introduction">
        <p>
          By accessing or using Rivaly, you agree to these Terms and Conditions.
        </p>
        <p className="mt-2 text-sm opacity-70">Last updated: March 25, 2026</p>
      </Section>

      <Section title="Overview">
        <p>
          Rivaly is a platform for sports predictions and social competition.
          The platform is intended for entertainment purposes only and does not involve real-money betting.
        </p>
      </Section>

      <Section title="No Gambling">
        <ul className="list-disc pl-5 space-y-2">
          <li>No real-money wagering is offered</li>
          <li>Predictions are for fun, competition, and rankings only</li>
          <li>Points and rankings have no monetary value</li>
        </ul>
      </Section>

      <Section title="User Accounts">
        <ul className="list-disc pl-5 space-y-2">
          <li>You are responsible for maintaining the security of your account</li>
          <li>You must provide accurate information</li>
          <li>You are responsible for all activity under your account</li>
        </ul>
      </Section>

      <Section title="Acceptable Use">
        <ul className="list-disc pl-5 space-y-2">
          <li>No cheating, manipulation, or exploitation of the platform</li>
          <li>No abusive, harmful, or illegal behavior</li>
          <li>No attempts to bypass system rules or restrictions</li>
        </ul>
      </Section>

      <Section title="Payments and Subscriptions">
        <p>
          Rivaly may offer optional paid features such as additional groups,
          increased limits, or an ad-free experience.
        </p>
        <ul className="list-disc pl-5 space-y-2">
          <li>Payments are optional and do not affect core gameplay</li>
          <li>No payments provide monetary rewards or winnings</li>
          <li>Payments are non-refundable unless required by law</li>
        </ul>
      </Section>

      <Section title="User Content">
        <p>
          Users retain ownership of their content but grant Rivaly a non-exclusive right
          to display and use it within the platform.
        </p>
      </Section>

      <Section title="Disclaimer">
        <p>
          Rivaly does not guarantee the accuracy of predictions, data, or outcomes.
          All features are provided for entertainment purposes only.
        </p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          Rivaly is not liable for any losses, damages, or decisions made based on
          platform content or usage.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms.
        </p>
      </Section>

      <Section title="Changes to Terms">
        <p>
          We may update these Terms from time to time. Continued use of Rivaly
          constitutes acceptance of updated terms.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For questions regarding these Terms, contact us at{" "}
          <a
            className="text-lime-200/80 hover:text-lime-200 underline underline-offset-4"
            href="mailto:rivalyab@gmail.com"
          >
            rivalyab@gmail.com
          </a>
          .
        </p>
      </Section>
    </div>
  );
}