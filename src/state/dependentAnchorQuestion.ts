/**
 * De vraag vóór opslaan bij de bron (stap 1.11 van "relaties tussen projecten", keuze 3 zonder cloud,
 * `docs/relaties-tussen-projecten.md` §6.5 eerste punt en §7.4): worden ankers van afhankelijke
 * projecten te krap, dan ziet de planner de lijst vóór het opslaan, met *Toch opslaan* en *Annuleren*.
 *
 * Zelfde opzet als de schemavraag (`services/ifc/ifcSchemaQuestion.ts`): de opslaanroute in de store
 * STELT de vraag via een injecteerbare vrager, de UI BEANTWOORDT hem
 * (`state/dependentAnchorQuestionBridge.ts`). Zo importeert `fileSlice` geen componenten.
 *
 * Alleen *Opslaan* en *Opslaan als* door de planner vragen dit; automatisch opslaan, crashherstel en
 * MCP komen hier niet langs. Zonder vrager (headless, tests) slaat de app op: een waarschuwing is
 * geen blokkade.
 */
import type { TightAnchor } from '@/engine/dependentProjects';

/** `true` ⇒ toch opslaan; `false` ⇒ annuleren (niets opslaan). */
export type DependentAnchorAsker = (anchors: TightAnchor[]) => Promise<boolean>;

const saveAnyway: DependentAnchorAsker = () => Promise.resolve(true);

let asker: DependentAnchorAsker = saveAnyway;

export function setDependentAnchorAsker(fn: DependentAnchorAsker): void {
  asker = fn;
}

/** Terug naar de terugval (opslaan). Voor tests. */
export function resetDependentAnchorAsker(): void {
  asker = saveAnyway;
}

export function askDependentAnchors(anchors: TightAnchor[]): Promise<boolean> {
  return asker(anchors);
}
