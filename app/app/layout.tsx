import type { Metadata } from "next";
import { AppShell } from "@/components/chrome/AppShell";
import { DemoStateProvider } from "@/lib/hooks/useDemoState";
import { ScenarioProvider } from "@/lib/hooks/useScenario";
import { FocusProvider } from "@/lib/focus";

// The product tree. Everything under /app gets the three shared providers and
// the instrument chrome; nothing above it does. This is the only place the
// providers are mounted, so cross-screen state (demo state, scenario control,
// focused part) is still one instance shared by all six screens plus the
// entry flow at /app.
export const metadata: Metadata = {
  title: "GALLIUM · Chip Supply Chain Shock Platform",
  description: "Prototype running on representative data.",
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <DemoStateProvider>
      <ScenarioProvider>
        <FocusProvider>
          <AppShell>{children}</AppShell>
        </FocusProvider>
      </ScenarioProvider>
    </DemoStateProvider>
  );
}
