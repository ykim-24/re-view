/** Route for the flow creator, at /integrations/[id]/flows/[flowId]. */

import { FlowCreator } from "@/features/integrations/FlowCreator";

interface PageProps {
  params: Promise<{ id: string; flowId: string }>;
}

export default async function FlowPage({ params }: PageProps) {
  const { id, flowId } = await params;
  return <FlowCreator integrationId={id} flowId={flowId} />;
}
