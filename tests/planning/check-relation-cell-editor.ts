import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8');
const diffs: string[] = [];
let checks = 0;
function ok(label: string, value: boolean): void {
  checks++;
  if (!value) diffs.push(label);
}

const editor = read('src/components/task-grid/RelationCellEditor.tsx');
const fullGrid = read('src/components/task-grid/FullTaskGrid.tsx');
const dialog = read('src/components/dialogs/ExternalLinkDialog.tsx');
const taskSlice = read('src/state/slices/taskSlice.ts');
const registry = read('src/engine/taskGrid/taskColumnRegistry.ts');

ok('lokale referentie gebruikt exact issue-65 HoverTooltip plus TaskTooltipContent',
  /<HoverTooltip/.test(editor) && /<TaskTooltipContent task=\{hover\.item\.otherTask\}/.test(editor));
ok('lokale klik routeert via de bestaande focusOnTask-actie',
  /onFocusTask\(item\.otherTaskId\)/.test(editor)
    && /onFocusTask=\{focusOnTask\}/.test(fullGrid));
ok('relatietype en lag zijn buiten editmodus gewone tekst',
  /task-grid-relation-detail/.test(editor)
    && !/className="task-grid-relation-detail"[^>]*onClick/.test(editor));
ok('externe hover toont bevroren anker en maakt geen lokale taak na',
  /ExternalRelationTooltipContent/.test(editor)
    && /Bevroren anker:/.test(editor)
    && /sourceMissing/.test(editor));
ok('rechtsklik op de externe token biedt uitsluitend buiten-de-celacties',
  /onExternalContextMenu/.test(editor)
    && /Bron vernieuwen/.test(fullGrid)
    && /Relatie verwijderen/.test(fullGrid)
    && /task-grid-relation-context/.test(fullGrid));
ok('autocomplete toont WBS plus naam en draagt taak-idmetadata',
  /relationTaskOptions/.test(editor)
    && /taskId:\s*option\.taskId/.test(editor)
    && /<strong>\{option\.wbsCode\}<\/strong> \{option\.name\}/.test(editor));
ok('chipedit normaliseert posities zonder metadata tot tekst te reduceren',
  /normalizeRelationTokenSources/.test(editor)
    && /directValue:\s*relationTokens/.test(read('src/components/task-grid/TaskCellEditor.tsx')));
ok('volledige tekstvervanging blijft een aparte strikte parserroute',
  /relations-raw/.test(editor)
    && /initialText === undefined[\s\S]*directValue: relationTokens/.test(read('src/components/task-grid/TaskCellEditor.tsx')));
ok('externe typekeuze in de cel is beperkt tot dezelfde bevroren bronzijde',
  /externalAnchorSideIsCompatible/.test(editor)
    && /compatibleTypes\.map/.test(editor));
ok('extern add/editdialoog ontvangt taskId plus optionele linkId en behoudt id via update',
  /taskId: string; linkId\?: string/.test(dialog)
    && /updateExternalLink\(taskId, linkId, link\)/.test(dialog)
    && /sameExternalLink/.test(taskSlice));
ok('dialoog gebruikt dag- of datumtijdinput volgens uurmodus',
  /type=\{hourMode \? 'datetime-local' : 'date'\}/.test(dialog));
ok('handmatige bronzijdewisseling vereist een expliciet aangeraakt nieuw anker',
  /sideChanged/.test(dialog)
    && /manualAnchorTouched/.test(dialog)
    && /externalSourceSide\(direction, relType\)/.test(dialog));
ok('invalid externe lag blokkeert submit voordat de store wordt aangeraakt',
  /const parsedLag = parseExternalLagInput\(lag\)/.test(dialog)
    && /parsedLag !== null/.test(dialog)
    && /if \(!canAdd\) return/.test(dialog));
ok('predecessor en successor lezen, tonen, kopieren en schrijven via dezelfde relationIndex-set',
  /buildRelationCellItems/.test(registry)
    && /taskRelations\(ctx\.relationIndex/.test(registry)
    && /relationCellClipboardText/.test(registry)
    && /planWrite: \(value, task\) => success\(\[\{ kind: 'relation-set'/.test(registry));

if (diffs.length) {
  console.error(`XX relation-cell-editor: ${diffs.length}/${checks} checks rood`);
  for (const diff of diffs) console.error(` - ${diff}`);
  process.exit(1);
}
console.log(`OK relation-cell-editor: ${checks}/${checks} checks groen`);
