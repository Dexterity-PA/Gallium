"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  type ScenarioControlState,
  DEFAULT_SCENARIO_CONTROL,
  isDefaultScenarioControl,
} from "@/lib/data/scenario";

// The scenario control (affected node / severity / duration) used to be
// useState local to the RADAR Impact panel, which is why nothing else in the
// product could respond to it. It is now app-level state: every screen reads
// the same control and derives through the same model (lib/derive/scenario.ts),
// so RADAR, RESOLVE, GRAPH and PORTFOLIO cannot tell different stories about
// one simulated disruption.
//
// Deliberately NOT persisted: a fresh load always starts at the default
// (scripted Kaohsiung) scenario, which is the state the demo recording was
// made from. Client-side navigation keeps the provider mounted, so a
// simulated scenario survives moving between screens within a session.

interface ScenarioValue {
  control: ScenarioControlState;
  setControl: (next: ScenarioControlState) => void;
  reset: () => void;
  isDefault: boolean;
}

const ScenarioContext = createContext<ScenarioValue>({
  control: DEFAULT_SCENARIO_CONTROL,
  setControl: () => {},
  reset: () => {},
  isDefault: true,
});

export function ScenarioProvider({ children }: { children: React.ReactNode }) {
  const [control, setControl] = useState<ScenarioControlState>(DEFAULT_SCENARIO_CONTROL);
  const value = useMemo<ScenarioValue>(
    () => ({
      control,
      setControl,
      reset: () => setControl(DEFAULT_SCENARIO_CONTROL),
      isDefault: isDefaultScenarioControl(control),
    }),
    [control]
  );
  return <ScenarioContext.Provider value={value}>{children}</ScenarioContext.Provider>;
}

export function useScenario(): ScenarioValue {
  return useContext(ScenarioContext);
}
