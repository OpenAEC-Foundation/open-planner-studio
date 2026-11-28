import hbSubsetWasmUrl from './vendor/hb-subset.wasm?url';

const HB_SUBSET_FLAGS_RETAIN_GIDS = 0x00000002;
const HB_MEMORY_MODE_WRITABLE = 2;

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

export async function subsetFont(ttf: Uint8Array, codepoints: Iterable<number>): Promise<Uint8Array> {
  const hb = await loadHarfbuzz();
  const heap = () => new Uint8Array(hb.memory.buffer);

  let inputPtr = 0;
  let srcPtr = 0;
  let blob = 0;
  let face = 0;
  let subFace = 0;
  let subBlob = 0;
  try {
    srcPtr = hb.malloc(ttf.length);
    heap().set(ttf, srcPtr);
    blob = hb.hb_blob_create(srcPtr, ttf.length, HB_MEMORY_MODE_WRITABLE, 0, 0);
    face = hb.hb_face_create(blob, 0);

    inputPtr = hb.hb_subset_input_create_or_fail();
    if (!inputPtr) throw new Error('hbSubset: hb_subset_input_create_or_fail gaf null');
    const unicodeSet = hb.hb_subset_input_unicode_set(inputPtr);
    for (const cp of codepoints) hb.hb_set_add(unicodeSet, cp >>> 0);

    const flags = hb.hb_subset_input_get_flags(inputPtr);
    hb.hb_subset_input_set_flags(inputPtr, flags | HB_SUBSET_FLAGS_RETAIN_GIDS);

    subFace = hb.hb_subset_or_fail(face, inputPtr);
    if (!subFace) throw new Error('hbSubset: hb_subset_or_fail gaf null (onparsebaar/leeg font?)');
    subBlob = hb.hb_face_reference_blob(subFace);
    const len = hb.hb_blob_get_length(subBlob);
    const dataPtr = hb.hb_blob_get_data(subBlob, 0);
    return heap().slice(dataPtr, dataPtr + len);
  } finally {
    if (subBlob) hb.hb_blob_destroy(subBlob);
    if (subFace) hb.hb_face_destroy(subFace);
    if (inputPtr) hb.hb_subset_input_destroy(inputPtr);
    if (face) hb.hb_face_destroy(face);
    if (blob) hb.hb_blob_destroy(blob);
    if (srcPtr) hb.free(srcPtr);
  }
}
