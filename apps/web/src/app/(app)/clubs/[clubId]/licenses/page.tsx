import { redirect } from "next/navigation";

/** Old address of Mensen en teams. */
export default async function ClubLicensesPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  redirect(`/clubs/${clubId}/people`);
}
