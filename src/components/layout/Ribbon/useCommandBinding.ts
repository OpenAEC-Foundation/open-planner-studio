// De lint-kant van het commandoregister (K-item 34).
//
// Zet een `Command` om in de `RibbonButtonBinding` die een lintknop verwacht. Dit is de enige plek
// waar de imperatieve kant van een commando de reactieve kant van het lint raakt:
//
//   - `isEnabled` gaat door een Zustand-SELECTOR, dus de knop grijst vanzelf aan en uit zodra de
//     onderliggende state verandert. Geen aparte reactieve variant van het commando nodig;
//   - `onClick` haalt de store VERS op (`getState()`) in plaats van hem uit de closure te lenen.
//     Dat is niet alleen netter maar noodzakelijk: een knop die tijdens dezelfde render meerdere
//     keren wordt aangeklikt zou anders op een verouderde snapshot werken.
//
// Knoppen die méér nodig hebben dan aan/uit — een `active`-stand, een tooltip bij een uitgeschakelde
// knop — spreiden dit resultaat en vullen aan. Zo blijft de gedeelde weg smal en houdt elke knop
// zijn eigenaardigheden lokaal.
import { useAppStore } from '@/state/appStore';
import { isCommandEnabled, type Command } from '@/state/commands';
import type { RibbonButtonBinding } from './ribbonConfig';

export function useCommandBinding(cmd: Command): RibbonButtonBinding {
  const enabled = useAppStore(s => isCommandEnabled(cmd, s));
  return {
    onClick: () => cmd.run(useAppStore.getState()),
    disabled: !enabled,
  };
}
