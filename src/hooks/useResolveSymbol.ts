import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  ResolveSymbolInput,
  ResolveSymbolResult,
} from "@/application/resolve-symbol";

/** Go-to-definition. Mutation rather than query — it's triggered by a click. */
export function useResolveSymbol() {
  return useMutation<ResolveSymbolResult, Error, ResolveSymbolInput>({
    mutationFn: (input) =>
      api.post<ResolveSymbolResult>("/api/resolve", input),
  });
}
