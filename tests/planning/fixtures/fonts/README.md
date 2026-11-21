# Testlettertypen

Lettertypen die alleen de proeven gebruiken; de app levert ze niet mee.

| bestand | bron | waarvoor |
|---|---|---|
| `NotoSansCoptic-Regular.ttf` | Noto Sans Coptic 2.000, uit het Debian/Ubuntu-pakket `fonts-noto-core` 20201225-2; sha256 `9681bb92c70f4ff74a6a004a139719b6778dfabfcad17cec978a9601d9c69d29` | `check-custom-report-font.ts` deel G (issue #1050): een echte GSUB-regel van type 8 (reverse chaining). Die liet `@pdf-lib/fontkit` 1.1.1 stuklopen; de bovenstreep in `Ⲁ̅ⲁ̅` gebruikt glyph 196 en 199. |

Licentie: SIL Open Font License 1.1, zie `NotoSansCoptic-OFL.txt`.
