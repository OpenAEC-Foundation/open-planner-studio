# Lettertypestapels van de interface

De keuze Lettertype interface (`ui.uiFontFamily`) werkt op twee plekken: de DOM via de CSS-variabelen in
`App.tsx`, en de Canvas-2D-renderers via `ctx.font`. Een canvas leest geen CSS-variabelen, dus beide halen hun
stapel uit één tabel in `src/utils/uiFont.ts` (`UI_FONT_STACKS`; de Gantt via `resolveUIFontStack`). Bij de keuze Standaard valt de DOM terug op
`--font-body` in `src/styles/globals.css`; het canvas krijgt `DEFAULT_UI_FONT_STACK`, die daarom letterlijk
dezelfde waarde heeft. Wie `--font-body` wijzigt, wijzigt die constante mee, anders toont de Gantt een ander
lettertype dan de rest van de app.

Op Linux begint de systeemstapel met `-webkit-system-font` en pas daarna `system-ui`
(`resolveSystemFontStack`). Uit het weggehaalde commentaar, niet nagegaan: WebKitGTK, de webview van de
desktopapp, lost `system-ui` op naar een vast lettertype, en alleen `-webkit-system-font` volgt daar het
interfacelettertype van de desktop. Chromium en Firefox kennen de eerste naam niet en nemen `system-ui`.
Omdraaien zou op de Linux-desktop het ingestelde lettertype negeren.
