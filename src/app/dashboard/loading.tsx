export default function DashboardLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
        <div className="text-sm font-semibold">Loading dashboard…</div>
      </div>
    </div>
  );
}
