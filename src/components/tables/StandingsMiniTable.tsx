import type { ReactNode } from "react";

export type StandingsMiniRow = {
  teamId: string;
  teamName: string;
  position: number;
  played: number;
  goalDifference: number;
  points: number;
  rightSlot?: ReactNode;
};

export function StandingsMiniTable({ rows }: { rows: StandingsMiniRow[] }) {
  return (
    <div className="mt-5">
      <table className="w-full table-fixed text-left">
        <thead>
          <tr className="text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
            <th className="w-7 py-2 pr-2">#</th>
            <th className="py-2 pr-2">Team</th>
            <th className="w-8 py-2 pr-2">P</th>
            <th className="w-9 py-2 pr-2">GD</th>
            <th className="w-9 py-2">Pts</th>
          </tr>
        </thead>
        <tbody className="text-sm text-white/70">
          {rows.map((r) => (
            <tr key={r.teamId} className="border-t border-white/10">
              <td className="py-2 pr-2 tabular-nums text-white/45">{r.position}</td>
              <td className="truncate py-2 pr-2 font-semibold text-white/80">{r.teamName}</td>
              <td className="py-2 pr-2 tabular-nums text-white/55">{r.played}</td>
              <td className="py-2 pr-2 tabular-nums text-white/55">{r.goalDifference}</td>
              <td className="py-2 tabular-nums font-bold text-lime-100">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
