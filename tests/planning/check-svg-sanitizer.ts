import {
  sanitizeSvgIcon,
  sanitizeIconTree,
  sanitizeIconNode,
  serializeIconNode,
  asTextIcon,
  isAllowedElement,
  isAllowedAttribute,
  isSafeAttributeValue,
  TEXT_NODE_TAG,
  type IconNode,
} from '@/utils/sanitizeSvgIcon';

let failures = 0;
function check(name: string, cond: boolean): void {
  if (!cond) {
    failures++;
    console.error(`XX ${name}`);
  } else {
    console.log(`ok ${name}`);
  }
}

const el = (tag: string, attrs: Array<[string, string]> = [], children: IconNode[] = []): IconNode =>
  ({ tag, attrs, children });
const txt = (text: string): IconNode => ({ tag: TEXT_NODE_TAG, attrs: [], children: [], text });

const run = (root: IconNode): string | null => {
  const clean = sanitizeIconTree(root);
  return clean === null ? null : serializeIconNode(clean);
};

const onloadTree = el('svg', [['viewBox', '0 0 24 24'], ['onload', 'alert(1)']], [el('path', [['d', 'M0 0h24']])]);
check(
  'onload: handler weg, geometrie blijft',
  run(onloadTree) === '<svg viewBox="0 0 24 24"><path d="M0 0h24"></path></svg>',
);

check('script: element weg en niets over → null', run(el('svg', [], [el('script', [], [txt('alert(1)')])])) === null);
check('script: staat niet in de allowlist', isAllowedElement('script') === false);

check('img-wortel: geen <svg> → null', run(el('img', [['src', 'x'], ['onerror', 'alert(1)']])) === null);

check('use: element weg → null', run(el('svg', [], [el('use', [['href', '#icon']])])) === null);
check('use: staat niet in de allowlist', isAllowedElement('use') === false);

check(
  'foreignObject: weg, rest blijft',
  run(el('svg', [], [el('foreignObject', [], [el('script')]), el('circle', [['r', '4']])])) ===
    '<svg><circle r="4"></circle></svg>',
);

check(
  'style-attribuut: weg, element blijft',
  run(el('svg', [], [el('rect', [['style', 'background:url(https://evil)'], ['width', '10']])])) ===
    '<svg><rect width="10"></rect></svg>',
);

check(
  'animate/set: SMIL-omweg weg',
  run(el('svg', [], [el('animate', [['attributeName', 'onload']]), el('set'), el('path', [['d', 'M0 0']])])) ===
    '<svg><path d="M0 0"></path></svg>',
);

check('a-element: weg inclusief kinderen → null', run(el('svg', [], [el('a', [['href', 'javascript:alert(1)']], [el('path', [['d', 'M0 0']])])])) === null);

check('ONLOAD in hoofdletters: geweigerd', isAllowedAttribute('ONLOAD') === false);
check('onclick: geweigerd', isAllowedAttribute('onclick') === false);
check('href: geweigerd', isAllowedAttribute('href') === false);
check('xlink:href: geweigerd', isAllowedAttribute('xlink:href') === false);
check('XLINK:HREF: geweigerd', isAllowedAttribute('XLINK:HREF') === false);
check('style: geweigerd', isAllowedAttribute('style') === false);
check('xml:base (prefix): geweigerd', isAllowedAttribute('xml:base') === false);
check('class (niet op de allowlist): geweigerd', isAllowedAttribute('class') === false);
check('viewBox: toegestaan', isAllowedAttribute('viewBox') === true);
check('stroke-width: toegestaan', isAllowedAttribute('stroke-width') === true);
check('xmlns: toegestaan', isAllowedAttribute('xmlns') === true);

check('waarde: javascript: geweigerd', isSafeAttributeValue('javascript:alert(1)') === false);
check('waarde: javascript: met witruimte ertussen geweigerd', isSafeAttributeValue('java script :alert(1)') === false);
check('waarde: url(#verloop) toegestaan', isSafeAttributeValue('url(#verloop)') === true);
check('waarde: url(https://evil) geweigerd', isSafeAttributeValue('url(https://evil/x.svg)') === false);
check('waarde: url(data:...) geweigerd', isSafeAttributeValue('url(data:image/svg+xml;base64,AA)') === false);
check('waarde: gewone geometrie toegestaan', isSafeAttributeValue('M12 2 L2 22 h20 Z') === true);
check(
  'waarde: fill met externe url wordt gestript, element blijft',
  run(el('svg', [], [el('path', [['fill', 'url(https://evil/x)'], ['d', 'M0 0']])])) ===
    '<svg><path d="M0 0"></path></svg>',
);

const lucide = el(
  'svg',
  [['xmlns', 'http://www.w3.org/2000/svg'], ['viewBox', '0 0 24 24'], ['fill', 'none'], ['stroke', 'currentColor'], ['stroke-width', '2'], ['stroke-linecap', 'round']],
  [el('path', [['d', 'M12 2 L2 22 h20 Z']]), el('circle', [['cx', '12'], ['cy', '14'], ['r', '3']])],
);
check(
  'lucide-achtig icoon blijft byte-voor-byte overeind',
  run(lucide) ===
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<path d="M12 2 L2 22 h20 Z"></path><circle cx="12" cy="14" r="3"></circle></svg>',
);
check('currentColor overleeft (themering blijft werken)', (run(lucide) as string).includes('stroke="currentColor"'));

check(
  'canonieke spelling: LINEARGRADIENT/VIEWBOX → linearGradient/viewBox',
  run(el('SVG', [['VIEWBOX', '0 0 8 8']], [
    el('defs', [], [el('LINEARGRADIENT', [['id', 'g'], ['gradientUnits', 'userSpaceOnUse']], [el('STOP', [['offset', '0'], ['stop-color', 'red']])])]),
    el('rect', [['width', '8'], ['height', '8'], ['fill', 'url(#g)']]),
  ])) ===
    '<svg viewBox="0 0 8 8"><defs><linearGradient id="g" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="red"></stop></linearGradient></defs>' +
      '<rect width="8" height="8" fill="url(#g)"></rect></svg>',
);

check('tekst wordt geëscaped in <title>', run(el('svg', [], [el('title', [], [txt('<script>alert(1)</script>')]), el('path', [['d', 'M0 0']])])) ===
  '<svg><title>&lt;script&gt;alert(1)&lt;/script&gt;</title><path d="M0 0"></path></svg>');
check('quote in attribuutwaarde wordt geëscaped',
  run(el('svg', [], [el('path', [['d', 'M0 0" onload="alert(1)']])])) ===
    '<svg><path d="M0 0&quot; onload=&quot;alert(1)"></path></svg>');
check('losse tekst buiten een tekstelement verdwijnt',
  run(el('svg', [], [txt('   '), el('path', [['d', 'M0 0']]), txt('rommel')])) === '<svg><path d="M0 0"></path></svg>');
check('alleen witruimte in de svg → niets zichtbaars → null', run(el('svg', [], [txt('   ')])) === null);

check('emoji is een tekst-icoon', asTextIcon('🧩') === '🧩');
check('emoji met witruimte wordt getrimd', asTextIcon('  ⚙  ') === '⚙');
check('samengestelde emoji (ZWJ) blijft tekst', asTextIcon('👨‍👩‍👧') === '👨‍👩‍👧');
check('markup is geen tekst-icoon', asTextIcon('<svg></svg>') === null);
check('lange tekst is geen tekst-icoon', asTextIcon('dit is gewoon een zin') === null);
check('lege string is geen tekst-icoon', asTextIcon('   ') === null);

const emoji = sanitizeSvgIcon('🧩');
check('sanitizeSvgIcon: emoji → tekst-variant', emoji !== null && emoji.kind === 'text' && emoji.text === '🧩');
check('sanitizeSvgIcon: leeg/undefined → null', sanitizeSvgIcon(undefined) === null && sanitizeSvgIcon('') === null);

const hasDomParser = typeof (globalThis as { DOMParser?: unknown }).DOMParser !== 'undefined';
check('deze omgeving heeft geen DOMParser (parse-stap dus niet gedekt)', hasDomParser === false);
check('sanitizeSvgIcon zonder DOMParser: markup → null i.p.v. crash',
  sanitizeSvgIcon('<svg viewBox="0 0 24 24"><path d="M0 0"/></svg>') === null);
check('sanitizeSvgIcon zonder DOMParser: kwaadaardige markup → null',
  sanitizeSvgIcon('<svg onload="alert(1)"><img src=x onerror=alert(1)></svg>') === null);

for (const tag of ['svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'defs', 'title', 'desc', 'linearGradient', 'radialGradient', 'stop', 'clipPath']) {
  check(`allowlist bevat <${tag}>`, isAllowedElement(tag) === true);
}
for (const tag of ['script', 'foreignObject', 'use', 'image', 'animate', 'set', 'a', 'iframe', 'style', 'div']) {
  check(`allowlist bevat <${tag}> NIET`, isAllowedElement(tag) === false);
}
check('losse tekstknoop blijft behouden door sanitizeIconNode', sanitizeIconNode(txt('hoi'))?.text === 'hoi');
check('lege tekstknoop verdwijnt', sanitizeIconNode(txt('')) === null);

if (failures > 0) {
  console.error(`TOTAAL: ${failures} afwijking(en)`);
  process.exitCode = 1;
} else {
  console.log('TOTAAL: alles groen');
}
