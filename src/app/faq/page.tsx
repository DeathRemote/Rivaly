import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "FAQ — Rivaly",
  description: "Frequently asked questions about Rivaly — predictions, groups, scoring, and more.",
};

const sections = [
  {
    heading: "Getting Started",
    items: [
      {
        q: "What is Rivaly?",
        a: "Rivaly is a sports prediction game where you compete against your friends. You predict the scores of real matches, earn points based on how accurate your predictions are, and climb the leaderboard inside your private group.",
      },
      {
        q: "Is Rivaly free to use?",
        a: "Yes — Rivaly is free to join and play. Create an account, make predictions, and compete with friends at no cost.",
      },
      {
        q: "Which sports and competitions are supported?",
        a: "Rivaly currently supports football (soccer) tournaments including major international competitions like the FIFA World Cup and continental championships. More sports and leagues are being added over time.",
      },
    ],
  },
  {
    heading: "Predictions",
    items: [
      {
        q: "How do I make a prediction?",
        a: "Head to the Swipe page from your dashboard. You'll be shown upcoming matches one at a time — swipe or tap to enter your predicted score for each game. You can predict as many or as few matches as you like.",
      },
      {
        q: "Can I change a prediction after I've submitted it?",
        a: "Yes, you can update your predictions at any time before the match kicks off. Once a match has started, your prediction is locked in.",
      },
      {
        q: "Is there a deadline for submitting predictions?",
        a: "Predictions must be submitted before the match kicks off. The exact kick-off time is shown on each match card. We recommend predicting in advance so you don't miss the window.",
      },
    ],
  },
  {
    heading: "Scoring & Points",
    items: [
      {
        q: "How are points calculated?",
        a: "You earn points based on how close your predicted score is to the actual result. An exact score prediction earns the most points. Getting the correct result (win/draw/loss) but the wrong score earns fewer points. A completely wrong result earns none.",
      },
      {
        q: "What's the difference between an exact score and a correct result?",
        a: "An exact score means you predicted both the home and away goals correctly (e.g. you said 2–1 and it ended 2–1). A correct result means you got the outcome right (home win, away win, or draw) but the scoreline was different (e.g. you said 2–1 but it ended 3–1).",
      },
      {
        q: "What is the accuracy percentage?",
        a: "Your accuracy percentage reflects how often your predictions have been correct — either an exact score or the right result — out of all the matches you've predicted. It's shown on the leaderboard alongside your points to give a fuller picture of your form.",
      },
    ],
  },
  {
    heading: "Groups",
    items: [
      {
        q: "How do I create a group?",
        a: "Go to the Groups page from your dashboard and tap \"Create group\". Give it a name, link it to a competition, and you're done. You'll receive an invite code to share with friends.",
      },
      {
        q: "How do I invite friends to my group?",
        a: "From inside your group, tap \"Copy invite link\" or \"Show invite code\". Share the link or code with anyone — they can join directly from the link or by entering the code on the Join page.",
      },
      {
        q: "How many people can be in a group?",
        a: "There's no strict cap on group size — the more the merrier. Larger groups just mean a more competitive leaderboard.",
      },
      {
        q: "How does the group leaderboard work?",
        a: "The leaderboard ranks every member of the group by their total points earned from predictions within the linked competition. It updates automatically after each match result is confirmed. You can also see each person's accuracy percentage to compare consistency.",
      },
    ],
  },
  {
    heading: "World Cup Features",
    items: [
      {
        q: "What is the Predicted Table?",
        a: "The Predicted Table simulates the group-stage standings based entirely on your score predictions. It's a fun way to see how the groups would look if your predictions all came true. Matches you haven't predicted are ignored.",
      },
      {
        q: "What is the Knockout Stage tab?",
        a: "The Knockout Stage tab shows the bracket for the elimination rounds. You can view predicted outcomes or actual results as the tournament progresses.",
      },
      {
        q: "What is the Table tab?",
        a: "The Table tab shows the real, official group-stage standings from the competition — updated as results come in. It's the live version to compare against your Predicted Table.",
      },
    ],
  },
  {
    heading: "Account & Profile",
    items: [
      {
        q: "How do I change my username or profile picture?",
        a: "Go to your Profile page and tap the edit button. You can update your display name and profile photo from there.",
      },
      {
        q: "I forgot my password. How do I reset it?",
        a: "On the login page, tap \"Forgot password\" and enter your email address. You'll receive a link to set a new password.",
      },
      {
        q: "How do I leave or delete a group?",
        a: "Open the group and tap \"Leave group\" from the hero section. If you're the group owner, you'll see a \"Delete group\" option instead, which removes the group and all its members. Your personal predictions are never deleted — they're stored globally.",
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-16">
      {/* Back link */}
      <Link
        href="/"
        className="mb-10 inline-flex items-center gap-1.5 text-sm font-bold text-white/40 transition hover:text-white"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to Rivaly
      </Link>

      {/* Header */}
      <h1 className="font-display text-5xl font-black italic tracking-tight text-white">
        FAQ
      </h1>
      <p className="mt-4 text-lg font-medium text-white/50">
        Everything you need to know about Rivaly.
      </p>

      {/* Sections */}
      <div className="mt-14 space-y-12">
        {sections.map((section) => (
          <div key={section.heading}>
            <h2 className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-lime-400/70">
              {section.heading}
            </h2>

            <div className="divide-y divide-white/8 rounded-2xl border border-white/10 bg-white/[0.03]">
              {section.items.map((item) => (
                <details key={item.q} className="group px-6 py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-display text-base font-black tracking-tight text-white/85 transition hover:text-white [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <svg
                      className="h-4 w-4 shrink-0 text-white/30 transition-transform duration-200 group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      viewBox="0 0 24 24"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <p className="pb-5 text-sm font-medium leading-relaxed text-white/55">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-16 rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <p className="font-display text-lg font-black tracking-tight text-white">
          Still have a question?
        </p>
        <p className="mt-2 text-sm font-medium text-white/50">
          Reach out and we'll get back to you as soon as possible.
        </p>
        <a
          href="mailto:support@rivaly.gg"
          className="mt-5 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-[#f3ffca] to-[#beee00] px-6 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-[#3a4a00] shadow-[0_0_20px_rgba(202,253,0,0.2)] transition hover:shadow-[0_0_30px_rgba(202,253,0,0.35)]"
        >
          Contact support
        </a>
      </div>
    </div>
  );
}
