// Kleine browseropstelling voor de echte gedeelde componenten. Geen server, store of vervangende
// implementatie: dezelfde JSX bundelt zowel in de gewone browsersuite als in de gerichte proef.
import { useState, type KeyboardEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { Popover } from '@/components/common/Popover';
import { GridEditorHost } from '@/components/task-grid/GridEditorHost';
import { taskColumnId } from '@/engine/taskGrid/fieldIds';

function Menu() {
  const [open, setOpen] = useState(false);
  return <>
    <div data-ribbon-scroll style={{ overflowX: 'auto', width: 320, marginTop: 100 }}
      onScroll={event => { event.currentTarget.dataset.scrollDelivered = 'yes'; }}>
      <div style={{ width: 1000, padding: 8 }}>
        <Popover open={open} onClose={() => setOpen(false)} fitViewport
          containerStyle={{ width: 'max-content', marginLeft: document.body.dataset.fixture === 'menu-scroll' ? 600 : 0 }}
          panelStyle={{ marginTop: 2, padding: 6, display: 'flex', flexDirection: 'column', minWidth: 200 }}
          trigger={<>
            <button>Andere helft</button>
            <button aria-expanded={open} onClick={event => {
              if (document.body.dataset.fixture === 'menu-scroll-click') {
                // Een host kan bij het bedienen ook de knop in beeld schuiven. De verplaatsing
                // gebeurt vóór openen; het native scrollevent volgt in een volgend frame.
                event.currentTarget.closest<HTMLElement>('[data-ribbon-scroll]')!.scrollLeft = 20;
              }
              setOpen(value => !value);
            }}>Menu openen</button>
          </>}>
          <div role="menu" aria-label="Keuzes" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: 'none', padding: 4 }}>Beschikbare keuzes</div>
            <div data-menu-list style={{ overflowY: 'auto', minHeight: 0 }}>
              {Array.from({ length: 30 }, (_, i) => <button key={i} role="menuitem"
                style={{ display: 'block', height: 24 }}>Keuze {i + 1}</button>)}
            </div>
            <div data-menu-footer style={{ flex: 'none', padding: 4 }}>Voetregel</div>
          </div>
        </Popover>
      </div>
    </div>
    <div data-other-scroll style={{ position: 'absolute', right: 8, top: 8, width: 120, height: 60, overflow: 'auto' }}>
      <div style={{ height: 400 }}>Andere inhoud</div>
    </div>
    <button style={{ position: 'absolute', right: 8, top: 80 }}>Buiten het menu</button>
  </>;
}

function Editor() {
  const [commits, setCommits] = useState(0);
  const [cancels, setCancels] = useState(0);
  const [focusRequests, setFocusRequests] = useState(0);
  const [lastKey, setLastKey] = useState('');
  return <>
    <GridEditorHost cell={{ rowKey: 'taak', columnId: taskColumnId('task.name') }}
      onCommit={() => { setCommits(value => value + 1); return { ok: true }; }}
      onCancel={() => setCancels(value => value + 1)}
      onFocusCell={() => setFocusRequests(value => value + 1)}>
      {props => <>
        <input aria-label="Taaknaam" {...props} onKeyDownCapture={event => {
          const native = event.nativeEvent;
          setLastKey(JSON.stringify({ key: native.key, composing: native.isComposing, code: native.keyCode, trusted: native.isTrusted }));
        }} />
        {/* De bestaande keuzelijst-editor roept de host zo aan na een klik of herselectie. */}
        <button onClick={() => props.onKeyDown({
          key: 'Enter', shiftKey: false, preventDefault() {}, stopPropagation() {},
        } as KeyboardEvent<HTMLElement>)}>Keuze vastleggen</button>
      </>}
    </GridEditorHost>
    <output data-commits>{commits}</output><output data-cancels>{cancels}</output>
    <output data-focus-requests>{focusRequests}</output><output data-last-key>{lastKey}</output>
  </>;
}

createRoot(document.getElementById('root')!).render(document.body.dataset.fixture === 'editor' ? <Editor /> : <Menu />);
