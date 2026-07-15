"use client";

import { Suspense, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ModalRoot } from "@/features/modal";
import { UpdateChecker } from "@/features/updater/UpdateChecker";
import { CardMenuOverlay } from "@/features/card-menu/CardMenuOverlay";
import { TabBar } from "@/features/tabs/TabBar";
import { makeQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={300}>
        <Suspense fallback={<div className="h-9 shrink-0 bg-tab-strip" />}>
          <TabBar />
        </Suspense>
        <div className="flex min-h-0 flex-1 flex-col shadow-[0_-3px_8px_-1px_rgba(0,0,0,0.6)]">
          {children}
        </div>
        <ModalRoot />
        <UpdateChecker />
        <CardMenuOverlay />
        <Toaster
          position="bottom-right"
          richColors
          offset={{ bottom: 56, right: 8 }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
