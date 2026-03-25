import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Crown,
  Gem,
  Globe,
  Layers,
  Lock,
  Radar,
  Shield,
  Sparkles,
  ArrowUpDown,
  Trophy,
  Users,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
};

export type Step = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export type Feature = {
  title: string;
  description: string;
  icon: LucideIcon;
  tone?: "neutral" | "lime" | "orange" | "cyan";
  layout: string;
};

export type PricingTier = {
  id: string;
  name: string;
  price: string;
  badge?: string;
  highlighted?: boolean;
  features: string[];
  cta: { label: string; href: string };
  icon: LucideIcon;
};

export type FooterGroup = {
  title: string;
  links: Array<{ label: string; href: string }>;
};

export const navItems: NavItem[] = [
  { label: "Home", href: "#top" },
  { label: "How it works", href: "#how" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

export const hero = {
  kicker: "Live & kinetic",
  title: {
    lead: "Compete with friends.",
    highlight: "Predict.",
    tail: "Win.",
  },
  description:
    "Predict match results, earn points, and climb the leaderboard. High-stakes energy — without the clutter.",
  primaryCta: { label: "Get started", href: "/signup", icon: ArrowRight },
};

export const steps: Step[] = [
  {
    title: "Create or join",
    description:
      "Spin up private groups for friends, or jump into public arenas in seconds.",
    icon: Users,
  },
  {
    title: "Swipe & predict",
    description:
      "Lock in your call with a fast, kinetic UI — before kickoff.",
    icon: ArrowUpDown,
  },
  {
    title: "Earn & compete",
    description:
      "Climb real‑time leaderboards and unlock status tiers as accuracy grows.",
    icon: Trophy,
  },
];

export const bento: Feature[] = [
  {
    title: "Swipe-based picks",
    description: "No forms. No friction. Just instinct — at speed.",
    icon: ArrowUpDown,
    tone: "lime",
    layout: "md:col-span-3",
  },
  {
    title: "Real-time leaderboards",
    description:
      "Watch ranks update as games end. Competition you can feel.",
    icon: Radar,
    tone: "neutral",
    layout: "md:col-span-3",
  },
  {
    title: "Private circles",
    description: "Invite-only groups with clean moderation controls.",
    icon: Lock,
    tone: "neutral",
    layout: "md:col-span-2",
  },
  {
    title: "Multi-sport mastery",
    description:
      "Premier League to NBA. One platform. Total dominance.",
    icon: Globe,
    tone: "lime",
    layout: "md:col-span-4",
  },
  {
    title: "Secure by default",
    description: "Modern auth patterns and privacy-first defaults.",
    icon: Shield,
    tone: "cyan",
    layout: "md:col-span-2",
  },
  {
    title: "Seasonal drops",
    description: "Limited badges and cosmetics to flex your run.",
    icon: Sparkles,
    tone: "orange",
    layout: "md:col-span-2",
  },
];

export const pricingTiers: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    features: ["3 active groups", "Standard swipes"],
    cta: { label: "Select", href: "#" },
    icon: Layers,
  },
  {
    id: "basic",
    name: "Basic",
    price: "$9",
    features: ["10 active groups", "Ad-free"],
    cta: { label: "Select", href: "#" },
    icon: Gem,
  },
  {
    id: "standard",
    name: "Standard",
    price: "$29",
    badge: "Best value",
    highlighted: true,
    features: ["Unlimited groups", "Custom badges", "Pro analytics"],
    cta: { label: "Select", href: "#" },
    icon: Crown,
  },
  {
    id: "premium",
    name: "Premium",
    price: "$49",
    features: ["Everything in Standard", "API access"],
    cta: { label: "Select", href: "#" },
    icon: Sparkles,
  },
  {
    id: "elite",
    name: "Elite",
    price: "$99",
    features: ["Concierge support", "Early beta"],
    cta: { label: "Select", href: "#" },
    icon: Trophy,
  },
];

export const footerGroups: FooterGroup[] = [
  {
    title: "Legal",
    links: [
      { label: "Terms", href: "#" },
      { label: "Privacy", href: "#" },
      { label: "Responsible gaming", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "Help center", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];
