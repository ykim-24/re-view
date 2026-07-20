"use client";

/**
 * One integration's home: its flows (an integration's capabilities). Create a
 * flow (routes into the flow creator), open a saved one, or rename/delete via
 * the row's inline edit / right-click menu (deletes are confirmed first).
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Workflow, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { openModal } from "@/features/modal";
import { useIntegration, useFlows, useFlowActions } from "@/hooks/useIntegrationApps";
import { EntityRow } from "./EntityRow";

interface IntegrationHomeProps {
  integrationId: string;
}

export function IntegrationHome({ integrationId }: IntegrationHomeProps) {
  const router = useRouter();
  const { data: integrationData } = useIntegration(integrationId);
  const { data: flowsData } = useFlows(integrationId);
  const { saveFlow, removeFlow } = useFlowActions(integrationId);

  const integration = integrationData?.integration ?? null;
  const flows = flowsData?.flows ?? [];

  const openFlow = (flowId: string) =>
    router.push(`/integrations/${integrationId}/flows/${flowId}`);
  const handleCreate = () => {
    saveFlow.mutate(
      { name: "Untitled flow" },
      { onSuccess: (res) => openFlow(res.id) },
    );
  };
  const handleRename = (id: string, name: string) => {
    saveFlow.mutate({ id, name });
  };
  const handleRequestDelete = (id: string) => {
    const flow = flows.find((f) => f.id === id);
    openModal({
      type: "confirm",
      title: "Delete flow",
      message: `Delete "${flow?.name ?? "this flow"}"? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => removeFlow.mutate(id),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Integrations">
          <Link
            href="/integrations"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <div className="font-medium">{integration?.name ?? "Integration"}</div>
        <Button size="sm" onClick={handleCreate} className="ml-auto gap-1.5">
          <Plus className="h-4 w-4" />
          Create a flow
        </Button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-2 overflow-y-auto p-6">
        <div className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Flows
        </div>
        {flows.map((flow) => (
          <EntityRow
            key={flow.id}
            id={flow.id}
            name={flow.name}
            subtitle={flow.description || undefined}
            icon={Workflow}
            onOpen={openFlow}
            onRename={handleRename}
            onDelete={handleRequestDelete}
          />
        ))}
        {flows.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No flows yet. Create one to start composing components.
          </div>
        )}
      </div>
    </div>
  );
}
