/**
 * CRC-32 (IEEE 802.3), de checksum die elke ZIP-entry in zijn local header én in de central
 * directory draagt. Er stond nog geen CRC-32 in `src/`.
 *
 * Puur en zonder state: de tabel hieronder is een eenmalig afgeleide lookup-tabel (een constante,
 * geen cache — er wordt nooit iets in bijgewerkt), zodat `crc32` zelf een gewone functie blijft.
 *
 * Waarom dit ertoe doet: een fout CRC is precies het soort bug dat pas bij de gebruiker opduikt,
 * en dan als "Excel wil het bestand herstellen". De test pint daarom drie bekende vectoren van
 * buiten in plaats van onze eigen uitkomst.
 */

const TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** De CRC-32 over `data`, als unsigned 32-bits getal. */
export function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
