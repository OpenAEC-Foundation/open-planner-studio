# Windows-1252 met een eigen tabel

`decodeWindows1252` (`src/utils/windows1252.ts`, gebruikt door de XER-lezer) decodeert met een eigen tabel voor
0x80 tot en met 0x9F en niet met `TextDecoder('windows-1252')`. Die encoding hangt in `TextDecoder` af van
de ICU-build van Node (de Node-documentatie, *Internationalization support*: met `small-icu` of zonder ICU is `util.TextDecoder` niet
volledig, met `system-icu` hangt het af van de geïnstalleerde ICU); de eigen tabel maakt de uitkomst daarvan los. De tabel volgt de WHATWG Encoding Standard (<https://encoding.spec.whatwg.org/index-windows-1252.txt>,
gedateerd 2024-09-18); de vijf posities zonder teken blijven hun C1-stuurteken.
