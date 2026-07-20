"use client";

/**
 * The integrations index: a list of integrations (apps). Create one, open it to
 * reach its home, or rename/delete via the row's inline edit / right-click menu
 * (deletes are confirmed first). Opening an integration routes to its home.
 */

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plug, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { openModal } from "@/features/modal";
import { useIntegrations, useIntegrationActions } from "@/hooks/useIntegrationApps";
import { EntityRow } from "./EntityRow";

export function IntegrationsHome() {
  const router = useRouter();
  const { data } = useIntegrations();
  const { saveIntegration, removeIntegration } = useIntegrationActions();

  const integrations = data?.integrations ?? [];

  const handleOpen = (id: string) => router.push(`/integrations/${id}`);
  const handleCreate = () => {
    saveIntegration.mutate(
      { name: "Untitled integration" },
      { onSuccess: (res) => router.push(`/integrations/${res.id}`) },
    );
  };
  const handleRename = (id: string, name: string) => {
    saveIntegration.mutate({ id, name });
  };
  const handleRequestDelete = (id: string) => {
    const integration = integrations.find((i) => i.id === id);
    openModal({
      type: "confirm",
      title: "Delete integration",
      message: `Delete "${integration?.name ?? "this integration"}" and all its flows? This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
      onConfirm: () => removeIntegration.mutate(id),
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Home">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <Plug className="h-4 w-4 text-blue-400" />
        <div className="font-medium">Integrations</div>
        <Button size="sm" onClick={handleCreate} className="ml-auto gap-1.5">
          <Plus className="h-4 w-4" />
          New integration
        </Button>
      </header>

      <div className="mx-auto w-full max-w-2xl flex-1 space-y-2 overflow-y-auto p-6">
        {integrations.map((integration) => (
          <EntityRow
            key={integration.id}
            id={integration.id}
            name={integration.name}
            subtitle={integration.description || undefined}
            icon={Plug}
            onOpen={handleOpen}
            onRename={handleRename}
            onDelete={handleRequestDelete}
          />
        ))}
        {integrations.length === 0 && (
          <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
            No integrations yet. Create one to start building flows.
          </div>
        )}
      </div>
    </div>
  );
}
