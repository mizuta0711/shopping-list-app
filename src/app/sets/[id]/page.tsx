import { SetEditView } from "@/features/shopping/components/SetEditView";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SetEditView mode="edit" setId={id} />;
}
