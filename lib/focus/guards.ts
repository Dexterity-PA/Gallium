import { BOM } from "@/lib/data/bom";
import {
  ORIGIN_OPTIONS,
  SEVERITY_OPTIONS,
  DURATION_OPTIONS_DAYS,
  DEFAULT_SCENARIO_CONTROL,
} from "@/lib/data/scenario";
import {
  flowViewFor,
  tallyForScope,
  FOREGROUND_TALLY,
  FULL_TALLY,
} from "@/components/graph/flowModel";
import { resolveFocusValue } from "./resolve";

/* ============================================================
   FOCUS INVARIANT GUARDS. Module-load, like lib/derive/guards.ts:
   drift fails the build, not the demo.

   Focus is a VIEW state. It narrows what a screen emphasizes; it must
   never alter a derived figure. The scenario derivations
   (deriveScenarioImpact, scenarioPlan, computePortfolioFor) cannot take
   focus by construction: none of them accepts a focus parameter, and any
   future signature change that adds one should be treated as the bug
   these guards exist to catch. The one derivation focus does flow
   through is tallyForScope, so that is where the invariant is enforced,
   across the same 9 x 3 x 5 scenario cross product the scenario guards
   walk, for every BOM line.

   What must hold:

     1. TALLY UNCHANGED UNDER FOCUS. For all 135 scenario cells, both
        map scopes, and all 31 BOM lines: the scope label and the tally
        OBJECT IDENTITY with a part focused equal the unfocused ones.
        Identity, not deep-equal, so a "recomputed but equal" regression
        also fails.
     2. DEFAULT FRAME PINNED. Unfocused tallies at the default scenario
        are the exact FOREGROUND_TALLY / FULL_TALLY module constants.
     3. EXACT RESOLUTION ONLY. Every BOM MPN round-trips to its own
        line; every BOM id round-trips (legacy palette links); an MPN
        one character off resolves to null. The five deliberately
        near-miss CSV rows must keep missing here exactly like they
        miss in the upload flow.
   ============================================================ */

function fail(msg: string): never {
  throw new Error(`FOCUS GUARD: ${msg}`);
}

export const FOCUS_GUARDS_OK = (() => {
  // 1. focus never alters scope or tally, at every scenario cell
  for (const origin of ORIGIN_OPTIONS) {
    for (const severity of SEVERITY_OPTIONS.map((s) => s.value)) {
      for (const durationDays of DURATION_OPTIONS_DAYS) {
        const view = flowViewFor({ originId: origin.id, severity, durationDays });
        for (const fullNetwork of [false, true]) {
          const bare = tallyForScope(view, fullNetwork, null);
          for (const line of BOM) {
            const focused = tallyForScope(view, fullNetwork, line);
            if (focused.tally !== bare.tally) {
              fail(
                `${origin.id}/${severity}/${durationDays}D full=${fullNetwork} ` +
                  `focus=${line.mpn}: tally object changed under focus`
              );
            }
            if (focused.scope !== bare.scope) {
              fail(
                `${origin.id}/${severity}/${durationDays}D full=${fullNetwork} ` +
                  `focus=${line.mpn}: scope label changed under focus`
              );
            }
          }
        }
      }
    }
  }

  // 2. unfocused default frame is the pinned module constants, by identity
  const dv = flowViewFor(DEFAULT_SCENARIO_CONTROL);
  if (tallyForScope(dv, false, null).tally !== FOREGROUND_TALLY) {
    fail("default foreground tally is not the FOREGROUND_TALLY constant");
  }
  if (tallyForScope(dv, true, null).tally !== FULL_TALLY) {
    fail("default full-network tally is not the FULL_TALLY constant");
  }

  // 3. exact-match resolution, no fuzz
  for (const line of BOM) {
    if (resolveFocusValue(line.mpn) !== line) {
      fail(`MPN ${line.mpn} does not round-trip to its own BOM line`);
    }
    if (resolveFocusValue(line.id) !== line) {
      fail(`id ${line.id} does not round-trip (legacy palette links)`);
    }
    // resolveMpn is case-insensitive by design, so the near-miss mutation
    // must change the character, not just its case. No MPN ends in Q.
    const near = line.mpn.slice(0, -1) + "Q";
    if (resolveFocusValue(near) !== null) {
      fail(`near-miss ${near} resolved; focus must be exact-match only`);
    }
  }
  if (resolveFocusValue(null) !== null || resolveFocusValue("") !== null) {
    fail("empty focus value must resolve to null");
  }

  return true;
})();
