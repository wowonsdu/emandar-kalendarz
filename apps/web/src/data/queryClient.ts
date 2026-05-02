import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
      retry: 1,
      staleTime: 30_000,
    },
  },
});

export const queryKeys = {
  authSession: ["auth", "session"] as const,
  currentUser: ["auth", "me"] as const,
  publicCatalog: ["public", "catalog"] as const,
  panelNavigation: ["panel", "navigation"] as const,
  panelStore: ["panel", "read-models"] as const,
};

export async function invalidateAppData() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.publicCatalog }),
    queryClient.invalidateQueries({ queryKey: queryKeys.panelNavigation }),
    queryClient.invalidateQueries({ queryKey: queryKeys.panelStore }),
    queryClient.invalidateQueries({ queryKey: queryKeys.currentUser }),
  ]);
}

export function invalidateForSseEvent(event: { type?: string; resource?: string }) {
  if (event.type?.startsWith("notification.")) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.panelNavigation });
    void queryClient.invalidateQueries({ queryKey: queryKeys.panelStore });
    return;
  }

  if (event.type === "entity.changed") {
    if (event.resource === "public-event" || event.resource === "trainer") {
      void queryClient.invalidateQueries({ queryKey: queryKeys.publicCatalog });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.panelNavigation });
    void queryClient.invalidateQueries({ queryKey: queryKeys.panelStore });
  }
}
