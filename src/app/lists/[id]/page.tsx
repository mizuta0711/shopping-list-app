import { ListEditView } from "@/features/shopping/components/ListEditView";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ListEditView mode="edit" listId={id} />;
}
