import { redirect } from "next/navigation";

/** Mijn staf is now the Staff Room. */
export default async function StaffPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  redirect(`/teams/${teamId}/staff-room`);
}
