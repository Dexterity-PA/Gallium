import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/chrome/AppShell";
import { DemoStateProvider } from "@/lib/hooks/useDemoState";
import { ScenarioProvider } from "@/lib/hooks/useScenario";
import { FocusProvider } from "@/lib/focus";

export const metadata: Metadata = {
  title: "GALLIUM · Chip Supply Chain Shock Platform",
  description: "Prototype running on representative data.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full">
      <head>
        {/* Ioskeley Mono is self-hosted and declared font-display: block in
            globals.css, so nothing paints text until it lands. Preload the
            two weights the chrome actually uses (400 body, 500 labels) to
            keep that hold short; 600/700 fetch on demand. */}
        <link
          rel="preload"
          href="/fonts/IoskeleyMono-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/IoskeleyMono-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="h-full">
        <DemoStateProvider>
          <ScenarioProvider>
            <FocusProvider>
              <AppShell>{children}</AppShell>
            </FocusProvider>
          </ScenarioProvider>
        </DemoStateProvider>
      </body>
    </html>
  );
}
