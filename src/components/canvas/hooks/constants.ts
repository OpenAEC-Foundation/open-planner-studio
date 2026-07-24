// Gedeelde interactie-drempels voor de canvas-gebaar-hooks (pakket Q / audit P20).
//
// Fase 2.10 golf 4 (box-selection): drempel in pixels vóórdat een sleep vanaf lege achtergrond
// promoveert tot een selectie-kader — onder de drempel blijft het een gewone klik. Dezelfde
// drempel bepaalt in de pan-hook of er echt gepand is (click-onderdrukking).
export const BOX_SELECT_THRESHOLD = 4;

// Issue #21 punt 1 (fase 2): verticale drempel in pixels vóórdat een mousedown op een taakrij in
// de takentabel promoveert van "kandidaat" naar echte rijsleep. Onder de drempel valt de klik
// door naar de gewone selectie-afhandeling (handleClick) — zelfde kandidaat→promoot-patroon als
// BOX_SELECT_THRESHOLD hierboven.
export const ROW_DRAG_THRESHOLD = 4;
