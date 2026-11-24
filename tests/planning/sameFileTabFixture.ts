import { castDraft } from 'immer';
import type { createAppStoreContext } from '@/state/appStoreFactory';

type Store = ReturnType<typeof createAppStoreContext>['store'];
type Target = { kind: 'path'; path: string } | { kind: 'handle'; handle: FileSystemFileHandle; name: string };

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
