import { redirect } from "next/navigation";

export default async function GroupSwipePage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  redirect(`/swipe?fromGroup=${encodeURIComponent(groupId)}`);
}
