import type { KnockoutRound } from "@prisma/client";

export type KnockoutSlot =
  | { kind: "group"; groupKey: string; rank: 1 | 2 | 3 }
  | { kind: "bestThird"; label: string };

export type VirtualKnockoutMatch = {
  id: string;
  round: KnockoutRound;
  home: KnockoutSlot;
  away: KnockoutSlot;
};

// World Cup 2026 (48 teams) baseline bracket skeleton.
//
// NOTE:
// - Exact placement of the 8 best 3rd-place teams depends on which groups those teams come from
//   (FIFA publishes a mapping table / Annex C with 495 combinations).
// - Until group stage is finished, we show deterministic placeholders (no randomness).
// - Once we implement Annex C resolution, we can replace `bestThird` slots with concrete group keys.
//
// For now we keep it minimal: we can show that there *are* R32 matches and which ones are
// winner/runner-up anchored vs best-third anchored.

export function worldCup2026VirtualR32(): VirtualKnockoutMatch[] {
  const mk = (n: number, home: KnockoutSlot, away: KnockoutSlot): VirtualKnockoutMatch => ({
    id: `wc2026-r32-${n}`,
    round: "R32",
    home,
    away,
  });

  // We don't encode the exact FIFA mapping yet; we just reserve 8 best-third slots.
  // This is enough to make the Knockout tab visible from day 1 with real placeholders.
  return [
    mk(1, { kind: "group", groupKey: "A", rank: 1 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(2, { kind: "group", groupKey: "B", rank: 2 }, { kind: "group", groupKey: "C", rank: 1 }),
    mk(3, { kind: "group", groupKey: "D", rank: 2 }, { kind: "group", groupKey: "E", rank: 1 }),
    mk(4, { kind: "group", groupKey: "F", rank: 2 }, { kind: "group", groupKey: "G", rank: 1 }),

    mk(5, { kind: "group", groupKey: "H", rank: 2 }, { kind: "group", groupKey: "I", rank: 1 }),
    mk(6, { kind: "group", groupKey: "J", rank: 2 }, { kind: "group", groupKey: "K", rank: 1 }),
    mk(7, { kind: "group", groupKey: "L", rank: 2 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(8, { kind: "group", groupKey: "A", rank: 2 }, { kind: "group", groupKey: "B", rank: 1 }),

    mk(9, { kind: "group", groupKey: "C", rank: 2 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(10, { kind: "group", groupKey: "E", rank: 2 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(11, { kind: "group", groupKey: "G", rank: 2 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(12, { kind: "group", groupKey: "I", rank: 2 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),

    mk(13, { kind: "group", groupKey: "K", rank: 2 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(14, { kind: "group", groupKey: "D", rank: 1 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(15, { kind: "group", groupKey: "F", rank: 1 }, { kind: "bestThird", label: "Best 3rd (TBD)" }),
    mk(16, { kind: "group", groupKey: "H", rank: 1 }, { kind: "group", groupKey: "J", rank: 1 }),
  ];
}

export function formatSlot(slot: KnockoutSlot): string {
  if (slot.kind === "bestThird") return slot.label;
  const rankLabel = slot.rank === 1 ? "Winner" : slot.rank === 2 ? "Runner-up" : "3rd";
  return `${rankLabel} Group ${slot.groupKey}`;
}
