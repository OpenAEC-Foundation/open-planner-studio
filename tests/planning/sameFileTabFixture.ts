// #804, knownbug 1957: met de featureflag `ifcForeignContent` opent Openen (ook Recent, slepen, de site) geen tweede
// tabblad op een bestand dat al open staat; de app gaat naar dat tabblad. Een tweede tabblad op hetzelfde bestand kan er
// met de flag aan nog wel zijn: uit crashherstel van een eerdere sessie, als de flag pas later aanging, of na twee
// openacties die elkaar kruisen (knownbug 2041). De proeven van de opslagbewaking zetten die toestand daarom zo neer:
// `openCopy` opent een ander bestand (een kopie, dus een nieuw tabblad), daarna wijst dat tabblad, net als zijn
// bronkenmerk, naar `target`. Zo blijft de bewaking getoetst zonder de openroute om te buigen.
import { castDraft } from 'immer';
import type { createAppStoreContext } from '@/state/appStoreFactory';

type Store = ReturnType<typeof createAppStoreContext>['store'];
type Target = { kind: 'path'; path: string } | { kind: 'handle'; handle: FileSystemFileHandle; name: string };

/** Opent via `openCopy` een tabblad (nieuw, of het lege actieve) en zet het op `target`; geeft de id van dat tabblad. */
export async function openSecondTabOn(store: Store, target: Target, openCopy: () => Promise<unknown>): Promise<string> {
  await openCopy();
  const id = store.getState().activeDocumentId;
  store.setState(s => {
    const mark = s.foreignSourceMark;
    if (target.kind === 'path') {
      s.filePath = target.path;
      if (mark) s.foreignSourceMark = castDraft({ ...mark, filePath: target.path });
    } else {
      s.filePath = target.name;
      s.fileHandle = castDraft(target.handle);
      if (mark) s.foreignSourceMark = castDraft({ ...mark, handle: target.handle, filePath: target.name });
    }
  });
  return id;
}
