// Eigen OPS-iconen, tijdelijk, voor plekken waar de B2-set van de Blueprint (nog) geen goed icoon heeft.
// Besluit eigenaar 2026-10-29: past er geen B2-icoon, dan het icoon van main plus een issue in de Blueprint.
// Zodra de Blueprint een passend icoon levert, gaat de plek terug naar B2 en verdwijnt het id hier.
//
// Geometrie: lucide (https://lucide.dev), het 24-raster van de iconen die main gebruikte, omgezet naar paden
// (cirkel en lijn als pad). Lijndikte zoals de B2-masters: 1,25 px op 16 px en 1,75 px op 24 px, zodat de
// iconen naast B2 even zwaar ogen.
//
// ISC License — Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT).
// All other copyright (c) for Lucide are held by Lucide Contributors 2022. Permission to use, copy, modify,
// and/or distribute this software for any purpose with or without fee is hereby granted, provided that the
// above copyright notice and this permission notice appear in all copies. THE SOFTWARE IS PROVIDED "AS IS".

import type { IconDef, IconPart } from '../b2/icons.generated';

/** Een OPS-icoon tekent in het 24-raster van lucide, ook op 16 px (de `viewBox` schaalt). */
export interface OpsIconDef extends IconDef { readonly box: 24 }

export type OpsIconId =
  | 'ops.calculate'
  | 'ops.move-date'
  | 'ops.zoom-in'
  | 'ops.zoom-out'
  | 'ops.codes-fields'
  | 'ops.add';

/** Lijndikte in 24-eenheden: 1,25 px op 16 px is 1,875; 1,75 px op 24 px is 1,75. */
const W16 = 1.875;
const W24 = 1.75;

function lucide(paths: readonly string[], accent: readonly number[] = []): OpsIconDef {
  const parts = paths.map((d, i): IconPart => [0, accent.includes(i) ? 1 : 0, d]);
  return { box: 24, s16: { w: W16, parts }, s24: { w: W24, parts } };
}

export const OPS_ICONS: Readonly<Record<OpsIconId, OpsIconDef>> = {
  // Bereken (▶ van main); B2 `planning.calculate` is een rekenmachine. https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/55
  'ops.calculate': lucide([
    "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
  ]),
  // Project verplaatsen (kalender met klok van main). https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/55
  'ops.move-date': lucide([
    "M16 14v2.2l1.6 1",
    "M16 2v4",
    "M21 7.5V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3.5",
    "M3 10h5",
    "M8 2v4",
    "M10 16A6 6 0 1 0 22 16A6 6 0 1 0 10 16Z",
  ]),
  // Inzoomen: vergrootglas van main met de plus in het accent. https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/52
  'ops.zoom-in': lucide([
    "M3 11A8 8 0 1 0 19 11A8 8 0 1 0 3 11Z",
    "M21 21L16.65 16.65",
    "M11 8L11 14",
    "M8 11L14 11",
  ], [2, 3]),
  // Uitzoomen: vergrootglas van main met de min in het accent. https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/52
  'ops.zoom-out': lucide([
    "M3 11A8 8 0 1 0 19 11A8 8 0 1 0 3 11Z",
    "M21 21L16.65 16.65",
    "M8 11L14 11",
  ], [2]),
  // Codes & velden (etiketten van main). https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/53
  'ops.codes-fields': lucide([
    "M13.172 2a2 2 0 0 1 1.414.586l6.71 6.71a2.4 2.4 0 0 1 0 3.408l-4.592 4.592a2.4 2.4 0 0 1-3.408 0l-6.71-6.71A2 2 0 0 1 6 9.172V3a1 1 0 0 1 1-1z",
    "M2 7v6.172a2 2 0 0 0 .586 1.414l6.71 6.71a2.4 2.4 0 0 0 3.191.193",
    "M10 6.5A0.5 0.5 0 1 0 11 6.5A0.5 0.5 0 1 0 10 6.5Z",
  ]),
  // Nieuwe layout (plus van main). https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/issues/54
  'ops.add': lucide([
    "M5 12h14",
    "M12 5v14",
  ]),
};
