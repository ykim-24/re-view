/** Route for one integration's home (its flows), at /integrations/[id]. */

import { IntegrationHome } from "@/features/integrations/IntegrationHome";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IntegrationPage({ params }: PageProps) {
  const { id } = await params;
  return <IntegrationHome integrationId={id} />;
}
