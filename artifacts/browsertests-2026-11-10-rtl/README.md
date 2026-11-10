# RTL-balksleep na ongedaan maken

De bestaande test in `tests/browser/gantt-drag-undo.spec.ts` sleept de eerste
taak na de derde taak, draait dat met Ctrl+Z terug en herhaalt dezelfde
verplaatsing via de balk. De eindcontrole vergelijkt beide taakvolgorden.

## De fout uit CI

In [run 42698399619, poging 2](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/42698399619/attempts/2)
bleef na de balksleep de oorspronkelijke taakvolgorde staan. De trace maakt
de oorzaak zichtbaar:

- De eerste taakrij ligt op client-y **272**.
- De rijsleep naar y **350** slaagt en wordt met Ctrl+Z teruggedraaid.
- De store heeft dan weer de oorspronkelijke taakvolgorde.
- De eerstvolgende meting van het balkpunt van de eerste taak geeft nog
  **y=336**, de oude derde rij.
- De test klikt op dat inmiddels verouderde punt. Het is dan de derde taak
  die onder de muis ligt. De bedoelde eerste taak wordt niet verplaatst.

`useCanvasLayer` plant de schermtekening met `requestAnimationFrame`.
`useGanttRendererHost` vervangt daarbij de renderer. De store kan dus al
hersteld zijn terwijl `taskBarPoint` nog een geldig punt uit de vorige
renderer teruggeeft. Alleen op een niet-null balkpunt wachten is onvoldoende.

Dezelfde fout treedt ook op de actuele basis
`14f979755b9addc93c6cb2470ea89cdda8c080b6` op, in
[run 42774384298, poging 1, browser 3-4](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/42774384298/job/129689366194).
Ook daar blijft de eerste taak na de balksleep bovenaan staan.

## De correctie

Vóór de tweede sleep controleert dezelfde test nu dat zowel de DOM-rij als
het gemeten balkpunt terug op de oorspronkelijke beginrij liggen. Daarna
meet hij het bronpunt opnieuw en voert hij de bestaande muisacties uit.
De eindcontrole van de taakvolgorde blijft ongewijzigd.

Er is geen vaste wachttijd, extra retry of nieuwe test toegevoegd. De
productcode verandert niet. De twee dubbele meldingen 224 en 264 zijn uit
`knownbugs.md` verwijderd.

## Gerichte foutproef

Basis: `14f979755b9addc93c6cb2470ea89cdda8c080b6`. Uitgevoerd op
aia09-mp50, Node **v24.22.0**, Playwright **1.62.1**, Chromium, één worker
en nul retries. Elke lokale browserproef draaide afzonderlijk onder
`flock /tmp/ops-zwaar.lock`.

De selectie was steeds:

```bash
node scripts/run-browser-tests.mjs tests/browser/gantt-drag-undo.spec.ts \
  --grep 'Gantt-balk vertical slepen landt in RTL'
```

Voor de gewone herhalingen kwam daar `--repeat-each=5` bij.

Om de timing uit de CI-trace gericht na te spelen is uitsluitend tijdens
de foutproef, vlak vóór Ctrl+Z, deze tijdelijke vertraging geplaatst:

```ts
await page.evaluate(() => {
  const original = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = callback => original(time => {
    window.setTimeout(() => callback(time), 200);
  });
  window.setTimeout(() => { window.requestAnimationFrame = original; }, 250);
});
```

Direct na het lezen van `barSource` kwam in beide proeven tijdelijk
`await page.waitForTimeout(300)`. Zo is het canvas vóór de muisklik weer
bijgewerkt, terwijl de oude test het eerder gelezen verkeerde punt bewaart.
Met de correctie wacht de meting eerst op de herstelde rij en balk.
De twee proefbestanden verschillen alleen in de nieuwe wachtconditie.

| Proef | Uitkomst |
|---|---|
| Ongewijzigde test, gewone timing | 5 passed, 39,6 s, exit 0 |
| Ongewijzigde test, uitgestelde schermtekening | 1 failed, dezelfde verkeerde taakvolgorde als in CI, exit 1 |
| Gecorrigeerde test, identieke uitgestelde schermtekening | 1 passed, 11,9 s, exit 0 |
| Gecorrigeerde test, gewone timing | 5 passed, 35,1 s, exit 0 |

De tijdelijke proeven zijn met kopieën uitgevoerd. Na elke proef is het
testbestand met `cp` teruggezet en is de SHA-256 opnieuw vergeleken:

```text
Zonder correctie, vóór en na de foutproef:
cb787b6ad719c195e20f8670fd0eb5098b94c3f09222e42a60f3e25fc0fc0e8a

Met correctie, vóór en na de groene foutproef:
569bf79166719904993763b20dc0ca0e53675df2c3c32f841fa3961f82e25042
```

De tijdelijke framevertraging en de vaste wachttijd staan niet in de
uiteindelijke test. De gecontroleerde rode proef verklaart waarom gewone
groene herhalingen vóór de correctie de wisselvalligheid niet uitsloten.
