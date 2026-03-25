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
          Rivaly ("we", "our", "us") provides a platform for sports predictions and social competition.
          This Privacy Policy explains how we collect, use, and protect your information.
        </p>
      </Section>

      <Section title="Information We Collect">
        <ul className="list-disc pl-5 space-y-2">
          <li>Account information (email, username)</li>
          <li>User-generated content (predictions, group activity)</li>
          <li>Usage data (interactions, pages visited, device/browser info)</li>
        </ul>
      </Section>

      <Section title="Cookies and Tracking">
        <p>
          We use cookies and similar technologies to improve user experience and analyze usage.
        </p>
      </Section>

      <Section title="Google AdSense">
        <p>
          We use Google AdSense to display advertisements. Google may use cookies (including the
          DoubleClick cookie) to serve personalized ads based on users’ visits to this and other websites.
          Users may opt out of personalized advertising by visiting Google Ads Settings.
        </p>
      </Section>

      <Section title="How We Use Data">
        <ul className="list-disc pl-5 space-y-2">
          <li>Provide and improve the service</li>
          <li>Personalize user experience</li>
          <li>Display relevant ads</li>
          <li>Ensure platform integrity</li>
        </ul>
      </Section>

      <Section title="Data Sharing">
        <p>
          We do not sell personal data. Data may be shared with trusted third-party services required to
          operate the platform (e.g., hosting, analytics, advertising).
        </p>
      </Section>

      <Section title="User Rights">
        <p>
          Users may request access, correction, or deletion of their data by contacting us.
        </p>
      </Section>

      <Section title="Data Security">
        <p>We take reasonable measures to protect user data.</p>
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
        <p>By using Rivaly, you agree to these Terms.</p>
      </Section>

      <Section title="Use of Service">
        <ul className="list-disc pl-5 space-y-2">
          <li>The platform is for entertainment purposes only</li>
          <li>No real-money betting or gambling is conducted</li>
        </ul>
      </Section>

      <Section title="User Responsibilities">
        <ul className="list-disc pl-5 space-y-2">
          <li>Users must provide accurate information</li>
          <li>Users are responsible for their account activity</li>
        </ul>
      </Section>

      <Section title="Prohibited Behavior">
        <ul className="list-disc pl-5 space-y-2">
          <li>Cheating or manipulation</li>
          <li>Abuse, harassment, or exploitation of the platform</li>
        </ul>
      </Section>

      <Section title="Content">
        <p>
          Users retain ownership of their content but grant Rivaly the right to display it within the
          platform.
        </p>
      </Section>

      <Section title="Disclaimer">
        <p>We do not guarantee accuracy of predictions or outcomes.</p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          Rivaly is not liable for losses, damages, or decisions made based on platform content.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          We reserve the right to suspend or terminate accounts that violate these terms.
        </p>
      </Section>
    </div>
  );
}
