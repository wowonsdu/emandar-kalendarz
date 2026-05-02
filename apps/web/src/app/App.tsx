import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { Toaster } from "sonner";
import { queryClient } from "@/data/queryClient";
import { router } from "./routes";
import { AppProviders } from "./providers/AppProviders";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppProviders>
        <RouterProvider router={router} />
        <Toaster richColors position="top-right" />
      </AppProviders>
    </QueryClientProvider>
  );
}
