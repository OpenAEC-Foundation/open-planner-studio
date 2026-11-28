import { fetchTextAsset, looksLikeSpaFallback } from '@/utils/textAsset';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.error(`XX ${name}`);
  } else {
    console.log(`ok ${name}`);
  }
}

function stubFetch(body: string, contentType: string, ok = true, status = 200) {
  return async (_url: string) => ({
    ok,
    status,
    headers: { get: (n: string) => (n.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
  });
}

async function accepted(body: string, contentType: string): Promise<string | null> {
  try {
    return await fetchTextAsset('docs/nl/x.md', stubFetch(body, contentType));
  } catch {
    return null;
  }
}

const MD = '# Aan de slag\n\nWelkom bij Open Planner Studio.\n';
const INDEX_HTML = '<!doctype html>\n<html lang="nl">\n<head><title>OPS</title></head>\n<body><div id="root"></div></body>\n</html>\n';

async function main(): Promise<void> {
  check('tauri: markdown met content-type text/html wordt geaccepteerd', (await accepted(MD, 'text/html')) === MD);
  check('tauri: markdown met text/html; charset=utf-8 wordt geaccepteerd', (await accepted(MD, 'text/html; charset=utf-8')) === MD);
  check('web: markdown met text/markdown wordt geaccepteerd', (await accepted(MD, 'text/markdown')) === MD);
  check('markdown zonder content-type-header wordt geaccepteerd', (await accepted(MD, '')) === MD);

  check('spa: index.html met doctype wordt geweigerd', (await accepted(INDEX_HTML, 'text/html')) === null);
  check('spa: <html> zonder doctype wordt geweigerd', (await accepted('<html><body>x</body></html>', 'text/html')) === null);
  check('spa: hoofdletter-DOCTYPE wordt geweigerd', (await accepted('<!DOCTYPE HTML><html></html>', 'text/html')) === null);
  check('spa: voorloop-witruimte/newline vóór doctype wordt geweigerd', (await accepted('\n\n  <!doctype html><html></html>', 'text/html')) === null);
  check('spa: BOM + doctype wordt geweigerd', (await accepted('﻿<!doctype html><html></html>', 'text/html')) === null);
  check('spa: doctype met niet-HTML content-type wordt óók geweigerd', (await accepted(INDEX_HTML, 'text/plain')) === null);

  check('BOM + markdown wordt geaccepteerd (BOM blijft behouden)', (await accepted('﻿' + MD, 'text/html')) === '﻿' + MD);
  check('lege body wordt geweigerd', (await accepted('', 'text/html')) === null);
  check('witruimte-only body wordt geweigerd', (await accepted('   \n\t\n', 'text/html')) === null);
  check('404 wordt geweigerd ook al is de body geldige markdown', (
    await (async () => {
      try { return await fetchTextAsset('x', stubFetch(MD, 'text/markdown', false, 404)); } catch { return null; }
    })()
  ) === null);

  check('markdown met <html> verderop wordt geaccepteerd', (await accepted('# Titel\n\n```html\n<!doctype html>\n```\n', 'text/html')) !== null);
  check('markdown die begint met een ander tag-achtig teken wordt geaccepteerd', (await accepted('<!-- commentaar -->\n# Titel\n', 'text/html')) !== null);

  check('looksLikeSpaFallback: doctype', looksLikeSpaFallback(INDEX_HTML) === true);
  check('looksLikeSpaFallback: markdown', looksLikeSpaFallback(MD) === false);
  check('looksLikeSpaFallback: leeg', looksLikeSpaFallback('') === false);
  check('looksLikeSpaFallback: IFC-voorbeeld', looksLikeSpaFallback('ISO-10303-21;\nHEADER;\n') === false);

  if (failures > 0) {
    console.error(`\nTOTAAL: ${failures} afwijking(en)`);
    process.exitCode = 1;
  } else {
    console.log('\nTOTAAL: alles groen');
  }
}

await main();
