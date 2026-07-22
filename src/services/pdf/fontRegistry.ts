/**
 * `fontRegistry` — een minimale, **richting-agnostische** registry van CJK-font-providers voor de
 * vector-PDF-export (§4.5 ontwerpdoc). De kern levert alléén de haak: providers registreren rauwe
 * glyf-TTF-bytes + een dekkings-predicaat; de vector-pagineerder subset per export het providerfont met
 * HarfBuzz ({@link file://./hbSubset.ts}) en bedt het conditioneel in (F4/F5-resources). Zonder enige
 * geregistreerde provider die de CJK-codepoints dekt, valt de export terug op raster — CJK is opt-in.
 *
 * Deze module kent GEEN extensie-API en GEEN concreet font: de provider-vuller (de officiële
 * CJK-extensie via `api.pdfFonts.register`) is een latere fase (4b). Nu wordt hij door een test-provider
 * gevuld om het rendermechanisme te bewijzen. Bewust richting-agnostisch (alleen bytes + coverage, geen
 * shaping/richting) zodat een latere RTL-laag er bovenop kan zitten zonder deze registry te herzien.
 *
 * Puur data/plumbing — geen Tauri-, pdf-lib- of DOM-imports; headless bundelbaar.
 */

/**
 * Een CJK-font-provider: levert rauwe glyf-TTF-bytes per gewicht plus een codepoint-dekkings-predicaat.
 * Bewust minimaal en richting-agnostisch. De bytes worden lazy opgehaald (de provider mag ze uit
 * IndexedDB/een extensie-asset trekken) en door de pagineerder gesubset + ingebed.
 */
export interface CjkFontProvider {
  /** Stabiele identiteit (diagnose/dedup). Twee providers met dezelfde `id` → de laatste wint. */
  id: string;
  /**
   * True als dit font een echte glyph heeft voor `codepoint`. Snelle voorfilter; de pagineerder
   * verifieert de daadwerkelijke glyph-aanwezigheid nog tegen de fontkit-`hasGlyphForCodePoint`.
   */
  covers(codepoint: number): boolean;
  /** Rauwe glyf-TTF-bytes van het Regular-gewicht (lazy; mag cachen). */
  getRegularBytes(): Promise<Uint8Array>;
  /** Optioneel: rauwe glyf-TTF-bytes van het Bold-gewicht. Ontbreekt hij → Regular wordt hergebruikt. */
  getBoldBytes?(): Promise<Uint8Array>;
}

/** Insertie-geordende provider-registry (id → provider), zodat coverage deterministisch de eerste kiest. */
const providers = new Map<string, CjkFontProvider>();

/**
 * Registreer (of vervang op `id`) een CJK-font-provider. Geeft een uitschrijf-functie terug — de latere
 * extensie-API hangt die aan `cleanupFns` zodat een uitgeschakelde extensie z'n provider automatisch
 * kwijtraakt (niet leunen op een auteur-`onUnload()`).
 */
export function registerCjkFontProvider(provider: CjkFontProvider): () => void {
  providers.set(provider.id, provider);
  return () => {
    // Alleen verwijderen als het nog exact deze provider is (een her-registratie op dezelfde id niet slopen).
    if (providers.get(provider.id) === provider) providers.delete(provider.id);
  };
}

/** Alle geregistreerde providers in registratievolgorde (een kopie — muteren raakt de registry niet). */
export function getCjkFontProviders(): CjkFontProvider[] {
  return [...providers.values()];
}

/** Leeg de registry (test-opruiming; ook handig als een host alle providers ineens wil resetten). */
export function clearCjkFontProviders(): void {
  providers.clear();
}
