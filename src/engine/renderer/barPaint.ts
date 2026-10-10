// Eén tekenregel voor een taakbalk met voortgang, gedeeld door het scherm (`GanttRenderer`) en de
// afdruk/PDF (`printPreview`): het voltooide deel is bleek en grijs (`doneBarTones`), de rest houdt
// zijn basiskleur. Bij 100% is de hele balk grijs.
//
// Hoeken per kant: een stuk tegen de voortgangsgrens is daar recht, zodat grijs en kleur zonder
// naad of inkeping aansluiten. Werkt op het canvas én op de afdruk-tekenlaag (`Draw2D.roundRect`
// met `CornerRadii`).
//
// Grijs over een VOLLE gekleurde vulling leggen laat op de afgeronde randen (halve dekking) een
// gekleurd randje doorschemeren. Daarom ligt de kleur alleen op de rechte grens 1 px onder het grijs.

import { doneBarTones } from './themePalette';

/** Het deel van een 2D-context dat de balk nodig heeft (canvas én `Draw2D`). */
export interface BarPainter {
  fillStyle: string | CanvasGradient | CanvasPattern;
  beginPath(): void;
  roundRect(x: number, y: number, w: number, h: number, r: readonly [number, number, number, number]): void;
  fill(): void;
}

/** Hoe ver (px) de kleur onder het grijs doorloopt, tegen een naad op de voortgangsgrens. */
const SEAM_OVERLAP = 1;

/** Vult een rechthoek met alleen aan de gekozen zijkanten afgeronde hoeken. */
function fillSided(d: BarPainter, x1: number, x2: number, y: number, h: number, r: number, roundLeft: boolean, roundRight: boolean): void {
  if (x2 <= x1 || h <= 0) return;
  const rl = roundLeft ? r : 0;
  const rr = roundRight ? r : 0;
  d.beginPath();
  d.roundRect(x1, y, x2 - x1, h, [rl, rr, rr, rl]);
  d.fill();
}

/**
 * Eén balkvlak van `x1` tot `x2` in `base`, met het deel links van `progressX` grijs.
 * `progressX = Infinity` ⇒ helemaal grijs (voltooid), `-Infinity` ⇒ geen voortgang.
 * `roundLeft`/`roundRight`: of dit vlak aan die kant een balkeinde is (in resource-modus liggen
 * kleurstukken tegen elkaar en zijn de binnenkanten recht).
 */
export function paintProgressBarPiece(
  d: BarPainter,
  x1: number, x2: number, y: number, h: number, r: number,
  base: string, progressX: number, dark: boolean,
  roundLeft = true, roundRight = true,
): void {
  if (x2 <= x1) return;
  // De grens blijft fractioneel: afronden op een hele pixel liet het grijze deel bij schuiven met
  // een pixel verspringen terwijl de balkranden vloeiend meebewogen (wiebelen). Tegen een naad op die
  // fractionele grens loopt de kleur 1 px onder het grijs door; het grijs komt er daarna overheen.
  // Die overlap ligt alleen op de rechte grens, nooit onder de ronde buitenhoeken van het grijs.
  const doneTo = Math.max(x1, Math.min(x2, progressX));
  if (x2 > doneTo) {
    const from = doneTo > x1 ? Math.max(x1, doneTo - SEAM_OVERLAP) : x1;
    d.fillStyle = base;
    fillSided(d, from, x2, y, h, r, doneTo <= x1 && roundLeft, roundRight);
  }
  if (doneTo > x1) {
    d.fillStyle = doneBarTones(base, dark).fill;
    fillSided(d, x1, doneTo, y, h, r, roundLeft, doneTo >= x2 && roundRight);
  }
}
