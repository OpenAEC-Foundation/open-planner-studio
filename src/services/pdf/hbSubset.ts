/**
 * `hbSubset` — een dunne, eigen wrapper om HarfBuzz' `hb-subset.wasm` (uit de `harfbuzzjs`-dep), die een
 * glyf-TTF pre-subset op een set Unicode-codepoints. Bedoeld als pre-subsetter vóór pdf-lib's
 * `embedFont(bytes, { subset:false })`: pdf-lib's eigen `subset:true` (via `@pdf-lib/fontkit`) schrijft
 * corrupte glyf-coördinaten waardoor glyphs in pdfium/Chrome onzichtbaar worden (spike 2026-07-22); de
 * HarfBuzz-subset is bewezen correct in pdfium/MuPDF/Chrome. Zo kunnen grote CJK-fonts (5–16 MB) tot
 * enkele tientallen KB per export teruggebracht worden zonder het render-defect.
 *
 * **Waarom niet `subset-font`/`harfbuzzjs`-JS?** Die sleuren Node-`fs`/`Buffer`/emscripten-glue mee. De
 * `hb-subset.wasm` zélf heeft **0 imports** (geverifieerd tegen de meegeleverde binary) → we instantiëren
 * 'm met kale `WebAssembly.instantiate(bytes, {})` en praten rechtstreeks tegen de HarfBuzz-C-API-exports.
 * Puur browser (fetch + WebAssembly) — geen Tauri-imports; lazy geladen in de export-chunk.
 *
 * **`HB_SUBSET_FLAGS_RETAIN_GIDS`** (0x2) staat aan: de glyph-id's in de subset blijven identiek aan het
 * bronfont. Zo blijft CID == GID == fontkit-`glyph.id` kloppen bij `subset:false`-embedding (net als bij
 * Inter/Noto-Arabic), veilig voor zowel `encodeText`-herafleiding als eventuele rauwe glyph-emissie.
 */
// De wasm als los asset laden (?url) — Vite kopieert 'm als gehashte asset in de lazy export-chunk, niet
// in de hoofdbundle. Bewust gevendord (`vendor/hb-subset.wasm`, uit npm `harfbuzzjs`): het pakket beperkt
// z'n `exports` tot de JS-glue (die Node-`fs`/`Buffer`/emscripten meesleept), dus we nemen enkel het kale
// wasm-bestand op en praten er rechtstreeks tegen. Zie `vendor/README.md` voor bron/licentie/hash.
import hbSubsetWasmUrl from './vendor/hb-subset.wasm?url';

/** `hb_subset_flags_t::HB_SUBSET_FLAGS_RETAIN_GIDS` — houd originele glyph-id's aan in de subset. */
const HB_SUBSET_FLAGS_RETAIN_GIDS = 0x00000002;
/** `hb_memory_mode_t::HB_MEMORY_MODE_WRITABLE` — HarfBuzz mag de (door ons ge-malloc'te) buffer bewerken. */
const HB_MEMORY_MODE_WRITABLE = 2;

/** De HarfBuzz-C-API-exports die we uit `hb-subset.wasm` gebruiken (allen `i32`-pointers/lengtes). */
interface HbExports {
  memory: WebAssembly.Memory;
  malloc(size: number): number;
  free(ptr: number): void;
  hb_blob_create(data: number, length: number, mode: number, userData: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_length(blob: number): number;
  hb_blob_get_data(blob: number, lengthOut: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_add(set: number, codepoint: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_input_get_flags(input: number): number;
  hb_subset_input_set_flags(input: number, value: number): void;
  hb_subset_or_fail(face: number, input: number): number;
}

let instancePromise: Promise<HbExports> | null = null;

/** Instantiëer `hb-subset.wasm` één keer (lazy) met een lege import-object (0 imports). Gecachet. */
async function loadHarfbuzz(): Promise<HbExports> {
  if (instancePromise) return instancePromise;
  instancePromise = (async () => {
    const res = await fetch(hbSubsetWasmUrl);
    const bytes = await res.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes, {});
    return instance.exports as unknown as HbExports;
  })();
  return instancePromise;
}

/**
 * Subset een glyf-TTF tot de glyphs die `codepoints` dekken, met behoud van originele glyph-id's
 * (`RETAIN_GIDS`). Geeft een nieuwe, zelfstandige `Uint8Array` (gekopieerd uit het wasm-geheugen vóór
 * cleanup) terug — klaar voor `PDFDocument.embedFont(bytes, { subset:false })`.
 *
 * @throws als HarfBuzz de subset-input of de subset zelf niet kan aanmaken (bv. onparsebaar bronfont).
 */
export async function subsetFont(ttf: Uint8Array, codepoints: Iterable<number>): Promise<Uint8Array> {
  const hb = await loadHarfbuzz();
  // Geheugen kan tijdens malloc groeien; haal de view telkens vers op.
  const heap = () => new Uint8Array(hb.memory.buffer);

  let inputPtr = 0;
  let srcPtr = 0;
  let blob = 0;
  let face = 0;
  let subFace = 0;
  let subBlob = 0;
  try {
    // 1) Bron-bytes naar wasm-heap + blob (mode WRITABLE, geen destroy-callback → wij beheren `srcPtr`).
    srcPtr = hb.malloc(ttf.length);
    heap().set(ttf, srcPtr);
    blob = hb.hb_blob_create(srcPtr, ttf.length, HB_MEMORY_MODE_WRITABLE, 0, 0);
    face = hb.hb_face_create(blob, 0);

    // 2) Subset-input: verzamel de Unicode-codepoints in de unicode-set.
    inputPtr = hb.hb_subset_input_create_or_fail();
    if (!inputPtr) throw new Error('hbSubset: hb_subset_input_create_or_fail gaf null');
    const unicodeSet = hb.hb_subset_input_unicode_set(inputPtr);
    for (const cp of codepoints) hb.hb_set_add(unicodeSet, cp >>> 0);

    // 3) RETAIN_GIDS aanzetten (glyph-id-stabiliteit).
    const flags = hb.hb_subset_input_get_flags(inputPtr);
    hb.hb_subset_input_set_flags(inputPtr, flags | HB_SUBSET_FLAGS_RETAIN_GIDS);

    // 4) Subset uitvoeren en de resulterende face-blob teruglezen.
    subFace = hb.hb_subset_or_fail(face, inputPtr);
    if (!subFace) throw new Error('hbSubset: hb_subset_or_fail gaf null (onparsebaar/leeg font?)');
    subBlob = hb.hb_face_reference_blob(subFace);
    const len = hb.hb_blob_get_length(subBlob);
    const dataPtr = hb.hb_blob_get_data(subBlob, 0);
    // Kopie NAAR een eigen buffer vóór cleanup (en vóór een eventuele latere memory-grow die de view invalideert).
    return heap().slice(dataPtr, dataPtr + len);
  } finally {
    // Alles vrijgeven in omgekeerde volgorde (nul-checks: HarfBuzz-destroy op 0 is een no-op, maar
    // onze eigen malloc niet — vandaar de guards).
    if (subBlob) hb.hb_blob_destroy(subBlob);
    if (subFace) hb.hb_face_destroy(subFace);
    if (inputPtr) hb.hb_subset_input_destroy(inputPtr);
    if (face) hb.hb_face_destroy(face);
    if (blob) hb.hb_blob_destroy(blob);
    if (srcPtr) hb.free(srcPtr);
  }
}
