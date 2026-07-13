"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ModalRoot } from "@/features/modal";
import { UpdateChecker } from "@/features/updater/UpdateChecker";
import { makeQueryClient } from "@/lib/queryClient";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delay={300}>
        {children}
        <ModalRoot />
        <UpdateChecker />
        <Toaster
          position="bottom-right"
          richColors
          offset={{ bottom: 56, right: 8 }}
        />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
