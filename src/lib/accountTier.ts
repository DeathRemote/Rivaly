export type AccountTier = "FREE" | "BASIC" | "PRO" | "ELITE" | "FRIENDS_AND_FAMILY";

export function accountTierLabel(tier: AccountTier | null | undefined) {
  switch (tier ?? "FREE") {
    case "FRIENDS_AND_FAMILY":
      return "Friends & Family";
    case "ELITE":
      return "Elite";
    case "PRO":
      return "Pro";
    case "BASIC":
      return "Basic";
    case "FREE":
    default:
      return "Free";
  }
}
