// Saniteren van extensie-geleverde iconen.
//
// WAAROM DIT BESTAAT. Drie plekken renderden een icoon uit extensiedata als rauwe HTML met
// `dangerouslySetInnerHTML`: de extensiekaart in Backstage → Extensies, de importer-kaart in
// Backstage → Importeren en de extensie-ribbonknop. De laatste twee zijn hygiëne — die iconen
// worden geregistreerd door DRAAIENDE extensiecode, die toch al in dezelfde realm zit. De eerste
// is een echte kwetsbaarheid: `manifest.icon` komt ongefilterd uit de ZIP (JSON.parse → IndexedDB
// → store) en `loadAllExtensions` registreert het manifest óók met status `disabled`, dus vóór
// elke poort. Een extensie die de gebruiker nooit heeft aangezet, voerde zo alsnog een
// `<img src=x onerror=...>` uit zodra het extensiescherm openging.
//
// WAAROM SANITEREN EN NIET WEGSTREPEN. Het icoon-contract is gepubliceerd: docs/extensions.md
// noemt een inline-SVG-string in `manifest.json`, en `src/extensions/types.ts` documenteert
// "inline SVG-string of emoji". Als platte tekst renderen breekt dat contract voor elke bestaande
// extensie; een `<img src="data:image/svg+xml,...">` breekt `currentColor`-theming (het icoon zou
// niet meer met het thema meekleuren). Dus: een echte sanitizer die inline SVG behoudt.
//
// VERHOUDING TOT src/utils/miniMarkdown.tsx. Daar geldt de huisregel dat het ONTBREKEN van
// `dangerouslySetInnerHTML` de veiligheidsgarantie IS. Hier kan die regel niet gelden — inline SVG
// zonder innerHTML betekent een SVG-element-boom in React opbouwen, wat neerkomt op dezelfde
// allowlist plus een React-renderer eromheen. De garantie verschuift daarom naar de herkomst van
// de string: alles wat hieronder de deur uitgaat is door deze module OPNIEUW OPGEBOUWD uit een
// allowlist — het is nooit de door de extensie aangeleverde tekst. Roep `dangerouslySetInnerHTML`
// dus uitsluitend aan met de `markup` uit een `SanitizedIcon`, nooit met ruwe extensiedata.
//
// AANPAK: allowlist, nooit blocklist. Alles wat niet expliciet is toegestaan valt weg. De
// beslissingslogica (welk element/attribuut/waarde mag, wat telt als tekst-icoon, het schoonmaken
// en serialiseren van de boom) is puur en DOM-vrij, zodat hij headless te testen is
// (tests/planning/check-svg-sanitizer.ts). Alleen het parsen leunt op `DOMParser`.

/** Resultaat van `sanitizeSvgIcon`: óf een tekst-icoon (emoji), óf herbouwde, veilige SVG-markup. */
export type SanitizedIcon =
  | { kind: 'text'; text: string }
  | { kind: 'svg'; markup: string };

/** DOM-vrije weergave van een geparste icoon-boom. `tag === TEXT_NODE_TAG` markeert een tekstknoop. */
export interface IconNode {
  tag: string;
  attrs: Array<[string, string]>;
  children: IconNode[];
  text?: string;
}

export const TEXT_NODE_TAG = '#text';

/** Toegestane elementen: sleutel = kleine letters (vergelijking), waarde = canonieke spelling
 *  (uitvoer). SVG is hoofdlettergevoelig — `linearGradient` moet exact zo terug de DOM in, dus
 *  we schrijven altijd de canonieke naam weg in plaats van wat de extensie aanleverde.
 *  Bewust conservatief: alleen geometrie, groepering, tekst en verlopen. */
export const ALLOWED_ELEMENTS: ReadonlyMap<string, string> = new Map([
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'text', 'tspan', 'defs', 'title', 'desc', 'linearGradient', 'radialGradient',
  'stop', 'clipPath',
].map(name => [name.toLowerCase(), name] as [string, string]));

/** Elementen die er ALTIJD uit gaan, ongeacht de allowlist. Ze staan hier niet omdat de allowlist
 *  ze anders zou doorlaten (dat doet hij niet — dit is een dubbele poort), maar omdat dit de
 *  bekende aanvalsvectoren zijn en de reden van uitsluiting vastgelegd hoort te zijn:
 *   - `script`        — voert code uit, punt.
 *   - `foreignObject` — smokkelt willekeurige HTML (inclusief `<script>`) een SVG binnen.
 *   - `use` / `image` — laden externe of same-document referenties; `use` kan bovendien via
 *                       shadow-cloning gedrag uit elders in het document trekken.
 *   - `animate`/`set` — kunnen via `attributeName` alsnog een attribuut zetten dat we juist
 *                       gestript hebben (de klassieke SMIL-omweg).
 *   - `a`             — navigatie vanuit een icoon; nooit gewenst, en `href` mag toch al niet. */
export const FORBIDDEN_ELEMENTS: ReadonlySet<string> = new Set([
  'script', 'foreignobject', 'use', 'image', 'animate', 'set', 'a',
]);

/** Toegestane attributen: sleutel = kleine letters, waarde = canonieke spelling (`viewBox`!).
 *  Precies de geometrie-/stijl-set die de toegestane elementen nodig hebben. */
export const ALLOWED_ATTRIBUTES: ReadonlyMap<string, string> = new Map([
  'viewBox', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'stroke-linecap',
  'stroke-linejoin', 'stroke-dasharray', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'points', 'transform', 'opacity', 'fill-rule',
  'clip-rule', 'fill-opacity', 'stroke-opacity', 'id', 'offset', 'stop-color',
  'stop-opacity', 'gradientUnits', 'gradientTransform', 'text-anchor', 'font-size',
  'font-family', 'xmlns',
].map(name => [name.toLowerCase(), name] as [string, string]));

/** Elementen waarin tekst betekenis heeft. Overal elders is tekst hooguit witruimte tussen
 *  elementen, dus die gooien we weg in plaats van hem mee te serialiseren. */
const TEXT_HOLDING_ELEMENTS: ReadonlySet<string> = new Set(['text', 'tspan', 'title', 'desc']);

/** Een tekst-icoon is een emoji of een enkel teken. Ruim genomen (8 code points) omdat samengestelde
 *  emoji uit meerdere code points bestaan (ZWJ-sequenties, huidskleur-modifiers, vlaggen). */
const TEXT_ICON_MAX_CODEPOINTS = 8;

/**
 * Is dit ruwe icoon een tekst-icoon (emoji/kort teken)? Zo ja: de te renderen tekst, anders `null`.
 * Puur. Een `<` maakt het per definitie geen tekst-icoon — dan gaat het door de SVG-route, die
 * strenger is. Renderen doet de aanroeper als gewone React-tekstknoop, dus zonder innerHTML.
 */
export function asTextIcon(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes('<')) return null;
  if ([...trimmed].length > TEXT_ICON_MAX_CODEPOINTS) return null;
  return trimmed;
}

/** Puur: mag dit element blijven staan? */
export function isAllowedElement(tag: string): boolean {
  const key = tag.toLowerCase();
  if (FORBIDDEN_ELEMENTS.has(key)) return false;
  return ALLOWED_ELEMENTS.has(key);
}

/**
 * Puur: mag dit attribuut blijven staan? De harde verwijderingen gaan vóór de allowlist:
 *  - alles wat met `on` begint — event-handlers (`onload`, `onerror`, ...); dit is de vector die
 *    een script écht laat vuren, en hij mag nooit van een allowlist-uitbreiding afhangen.
 *  - `href` en `xlink:href` — verwijzingen naar buiten (`javascript:`-URL's, externe resources);
 *    een icoon heeft ze niet nodig.
 *  - `style` — voert `url()`-verwijzingen en andere externe referenties aan de CSS-parser, en is
 *    bovendien een lek in de themering; kleur hoort via `currentColor`/`fill` te lopen.
 *  - alles met een namespace-prefix (`xlink:...`, `xml:...`) behalve de kale `xmlns` — prefix-trucs
 *    zijn een klassieke manier om een filter te omzeilen.
 */
export function isAllowedAttribute(name: string): boolean {
  const key = name.toLowerCase();
  if (key.startsWith('on')) return false;
  if (key === 'href' || key.endsWith(':href')) return false;
  if (key === 'style') return false;
  if (key.includes(':')) return false;
  return ALLOWED_ATTRIBUTES.has(key);
}

/**
 * Puur: is deze attribuutwaarde veilig? De waarde komt uit een geparste DOM en is dus al
 * entity-gedecodeerd (een numerieke entity voor de "j" van `javascript:` is hier gewoon tekst),
 * zodat een tekstuele check volstaat. Geweigerd worden een `javascript:`-schema in welke vorm dan
 * ook en elke `url(...)` die niet naar een fragment in hetzelfde document wijst —
 * `fill="url(#verloop)"` mag, een externe URL of data-URL niet.
 */
export function isSafeAttributeValue(value: string): boolean {
  // Witruimte en controletekens weghalen: een regelinvoer of tab middenin `javascript:` is
  // dezelfde vector en mag het filter niet omzeilen.
  const collapsed = Array.from(value).filter(ch => ch.charCodeAt(0) > 32).join('').toLowerCase();
  if (collapsed.includes('javascript:')) return false;
  // Elke `url(` die niet direct (eventueel na een quote) op `#` uitkomt, wijst naar buiten.
  if (/url\((?!['"]?#)/.test(collapsed)) return false;
  return true;
}

/**
 * Puur: maak één knoop schoon en geef een NIEUWE knoop terug, of `null` als hij weg moet.
 * Alles wat niet expliciet toegestaan is, valt hier weg.
 */
export function sanitizeIconNode(node: IconNode): IconNode | null {
  if (node.tag === TEXT_NODE_TAG) {
    const text = node.text ?? '';
    return text.length === 0 ? null : { tag: TEXT_NODE_TAG, attrs: [], children: [], text };
  }

  if (!isAllowedElement(node.tag)) return null;
  const canonicalTag = ALLOWED_ELEMENTS.get(node.tag.toLowerCase())!;

  const attrs: Array<[string, string]> = [];
  for (const [name, value] of node.attrs) {
    if (!isAllowedAttribute(name)) continue;
    if (!isSafeAttributeValue(value)) continue;
    attrs.push([ALLOWED_ATTRIBUTES.get(name.toLowerCase())!, value]);
  }

  const keepsText = TEXT_HOLDING_ELEMENTS.has(canonicalTag.toLowerCase());
  const children: IconNode[] = [];
  for (const child of node.children) {
    if (child.tag === TEXT_NODE_TAG && !keepsText) continue;
    const clean = sanitizeIconNode(child);
    if (clean) children.push(clean);
  }

  return { tag: canonicalTag, attrs, children };
}

/**
 * Puur: maak een complete icoon-boom schoon. De wortel MOET één `<svg>` zijn — een `<img>`,
 * `<script>` of losse tekst op wortelniveau is geen icoon en levert `null`. Levert ook `null` als
 * er na het schoonmaken niets zichtbaars overblijft (bijvoorbeeld een `<svg>` waarvan alleen een
 * event-handler is gestript), zodat de aanroeper op zijn eigen fallback-icoon kan terugvallen in
 * plaats van een leeg vlak te tonen.
 */
export function sanitizeIconTree(root: IconNode): IconNode | null {
  if (root.tag.toLowerCase() !== 'svg') return null;
  const clean = sanitizeIconNode(root);
  if (!clean) return null;
  if (!hasVisibleContent(clean)) return null;
  return clean;
}

function hasVisibleContent(node: IconNode): boolean {
  for (const child of node.children) {
    if (child.tag === TEXT_NODE_TAG) {
      if ((child.text ?? '').trim().length > 0) return true;
    } else {
      return true;
    }
  }
  return false;
}

const escapeText = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s: string): string => escapeText(s).replace(/"/g, '&quot;');

/**
 * Puur: bouw markup uit een SCHOONGEMAAKTE boom. Dit is het punt waarop de veiligheidsgarantie
 * hard wordt: de uitvoer is volledig opnieuw opgebouwd uit canonieke namen plus geëscapete
 * waarden — geen enkel fragment van de oorspronkelijke string wordt letterlijk doorgegeven.
 * Roep dit nooit aan met een boom die niet door `sanitizeIconTree` is gegaan.
 */
export function serializeIconNode(node: IconNode): string {
  if (node.tag === TEXT_NODE_TAG) return escapeText(node.text ?? '');
  const attrs = node.attrs.map(([name, value]) => ` ${name}="${escapeAttr(value)}"`).join('');
  const inner = node.children.map(serializeIconNode).join('');
  return `<${node.tag}${attrs}>${inner}</${node.tag}>`;
}

// ── DOM-afhankelijke laag ────────────────────────────────────────────────────────────────────

function domToIconNode(el: Element): IconNode {
  const attrs: Array<[string, string]> = [];
  for (const attr of Array.from(el.attributes)) attrs.push([attr.name, attr.value]);

  const children: IconNode[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 1) children.push(domToIconNode(child as Element));
    else if (child.nodeType === 3) children.push({ tag: TEXT_NODE_TAG, attrs: [], children: [], text: child.nodeValue ?? '' });
  }

  return { tag: el.localName || el.tagName, attrs, children };
}

// Iconen zijn een handvol korte strings die bij elke render van de ribbon/backstage opnieuw
// langskomen; parsen is duurder dan onthouden. Begrensd, zodat een extensie die per render een
// andere string aanlevert het geheugen niet kan laten groeien.
const CACHE_LIMIT = 256;
const cache = new Map<string, SanitizedIcon | null>();

function computeSanitizedIcon(raw: string): SanitizedIcon | null {
  const text = asTextIcon(raw);
  if (text !== null) return { kind: 'text', text };

  // Headless (tests, eventuele SSR): geen parser → geen icoon. Bewust `null` in plaats van een
  // exceptie, zodat een import van deze module buiten de browser niet klapt.
  if (typeof DOMParser === 'undefined') return null;

  let doc: Document;
  try {
    // Bewust `image/svg+xml` en niet `text/html`: XML-parsing is strikt (één wortel, alles
    // gesloten) en kent de HTML-parser-eigenaardigheden niet waarmee mXSS-trucs werken. Slordige
    // "HTML-achtige" SVG valt daardoor terug op het standaardicoon — veiliger dan gokken.
    doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  } catch {
    return null;
  }

  const root = doc.documentElement;
  if (!root) return null;
  if (doc.getElementsByTagName('parsererror').length > 0) return null;

  const clean = sanitizeIconTree(domToIconNode(root));
  if (!clean) return null;
  return { kind: 'svg', markup: serializeIconNode(clean) };
}

/**
 * Maak een extensie-geleverd icoon veilig renderbaar. Geeft `null` als er niets veiligs
 * overblijft; de aanroeper toont dan zijn eigen fallback-icoon.
 */
export function sanitizeSvgIcon(raw: string | null | undefined): SanitizedIcon | null {
  if (!raw) return null;
  const cached = cache.get(raw);
  if (cached !== undefined) return cached;
  const result = computeSanitizedIcon(raw);
  if (cache.size < CACHE_LIMIT) cache.set(raw, result);
  return result;
}
