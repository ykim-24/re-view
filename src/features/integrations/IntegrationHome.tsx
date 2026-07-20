"use client";

/**
 * One integration's home: a Flows tab (its capabilities — create/open/rename/
 * delete) and a Config tab (its secrets vault, scoped to this integration or
 * global). Deletes are confirmed first.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Workflow, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { openModal } from "@/features/modal";
import { useIntegration, useFlows, useFlowActions } from "@/hooks/useIntegrationApps";
import { EntityRow } from "./EntityRow";
import { SecretsPanel } from "./SecretsPanel";

type HomeTabId = "flows" | "config";

interface IntegrationHomeProps {
  integrationId: string;
}

export function IntegrationHome({ integrationId }: IntegrationHomeProps) {
  const router = useRouter();
  const { data: integrationData } = useIntegration(integrationId);
  const { data: flowsData } = useFlows(integrationId);
  const { saveFlow, removeFlow } = useFlowActions(integrationId);
  const [tab, setTab] = useState<HomeTabId>("flows");

  const integration = integrationData?.integration ?? null;
  const flows = flowsData?.flows ?? [];

  const openFlow = (flowId: string) =>
    router.push(`/integrations/${integrationId}/flows/${flowId}`);
  const showFlows = () => setTab("flows");
  const showConfig = () => setTab("config");
  const handleCreate = () => {
    saveFlow.mutate({ name: "Untitled flow" }, { onSuccess: (res) => openFlow(res.id) });
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
        <div className="ml-2 flex items-center gap-1">
          <HomeTab label="Flows" active={tab === "flows"} onSelect={showFlows} />
          <HomeTab label="Config" active={tab === "config"} onSelect={showConfig} />
        </div>
        {tab === "flows" && (
          <Button size="sm" onClick={handleCreate} className="ml-auto gap-1.5">
            <Plus className="h-4 w-4" />
            Create a flow
          </Button>
        )}
      </header>

      {tab === "flows" && (
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
      )}

      {tab === "config" && (
        <div className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto p-6">
          <SecretsPanel integrationId={integrationId} />
        </div>
      )}
    </div>
  );
}

interface HomeTabProps {
  label: string;
  active: boolean;
  onSelect(): void;
}

function HomeTab({ label, active, onSelect }: HomeTabProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "rounded-md px-2.5 py-1 text-sm transition-colors",
        active && "bg-muted text-foreground",
        !active && "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}
