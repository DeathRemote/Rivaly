import Image from "next/image";

export function UserBadge({
  name,
  rankLabel,
  image,
}: {
  name: string;
  rankLabel: string;
  image: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/5 p-4">
      <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white/10">
        {image ? (
          <Image src={image} alt={name} fill className="object-cover" />
        ) : null}
      </div>
      <div>
        <p className="font-display text-sm font-black text-lime-100">{name}</p>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/60">
          Rank: {rankLabel}
        </p>
      </div>
    </div>
  );
}
