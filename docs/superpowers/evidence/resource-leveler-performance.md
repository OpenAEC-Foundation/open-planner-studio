# Resource-nivellering: hergebruik van de voorwaartse CPM-pass

Basis: `522589202727a4a519b25b94aed196d844dc6ab8`. De wijziging zit uitsluitend in de
nivelleerkern (`src/engine/scheduler/ResourceLeveler.ts` op deze commit) en de direct benodigde
CPM-helper/wachtrij. Knownbug 121, de dialoog en het toepassen in de store vallen buiten scope.

## Oorzaak en ingreep

Een CPU-profiel van 5.000 taken op de basiscommit wees circa 9,2 van 10,7 seconden in
`levelResources` toe aan `pfFor` (inclusieve steekproeftijd; GC niet meegerekend). Een wijziging
stroomopwaarts maakte de PF-cache ongeldig, waarna de motor alle taken opnieuw construeerde,
valideerde, sorteerde en voorwaarts doorrekende. In lange netwerken herhaalt dat zich per plaatsing.

Na de eerste gewijzigde plaatsing houdt de nivelleerder één eigen solver met de voorwaartse datums vast. Zonder capaciteitsdruk volstaat de bestaande baseline, zonder extra forward-pass. Een gewijzigde delay of
onderbreking gaat in een min-heap op topologische rang; de bestaande CPM-forward-pass verwerkt de
getroffen taken tot aan de gevraagde taak en laat latere opvolgers wachten. Dubbele markeringen
worden samengevoegd. Voorganger-vensters voor voortgang blijven onderdeel van diezelfde berekening.
De vroege projectstartvloer wordt één keer bepaald: die hangt van vaste wortelankers af, niet van
delays of splits. ALAP/hammock en voltooid gemelde taken zonder `actualFinish` behouden hun volledige solve; baseline en definitieve proef-solve
blijven volledige berekeningen.

Dit voorkomt volledige netwerkpasses per plaatsing. Het is geen algemene garantie dat de hele
nivellering lineair wordt: capaciteitszoekwerk en herhaald geraakte vertakkingen kunnen blijven groeien.

## Reproductie

```bash
npm ci --no-audit --no-fund
node docs/superpowers/evidence/resource-leveler-performance.mjs --out /tmp/leveler.json
```

De runner bouwt twee Node/esbuild-bundels met dezelfde actuele meetkern. Voor de oude bundel haalt
hij uitsluitend `CPMSolver.ts` en `ResourceLeveler.ts` uit de basiscommit via `git show`; overige
geïmporteerde productbronnen zijn op deze branch gelijk. Er is geen checkoutwissel nodig. Beide
bundels draaien in hetzelfde Node-proces, steeds **vóór → ná**, drie keer per grootte. Er worden geen
warmups weggegooid. Dataset: `generateBenchmarkProject(size, { seed: 0x5eed })`, acht resources,
dezelfde generator/seed als de historische nulmeting grote planningen. Vóór het meten krijgen beide
fixtures een volledige CPM-berekening en de normale writeback naar de meetdata.

De timer omvat alleen `levelResources`, inclusief zijn baseline/PF/proef-solves. Hashen, toepassen van
de gevonden delays en de extra CPM-controle vallen buiten de timer. Dit is een **kernmeting in Node**;
de historische browsercijfers (0,56 / 8,4 / 37,6 s) omvatten ook de route naar het zichtbare voorstel
en zijn daarom niet de vergelijkingsbasis voor deze winst.

De machine was gedeeld en aanvankelijk zwaar belast. Er liep bij de afwisselende meting maximaal één
zwaar proces in deze worktree. De eerder gestarte losse nulmeting is gestopt en niet gebruikt voor
de winstclaim. De ruwe JSON legt runtime, CPU, tijdzone, startbelasting per run en alle hashes vast.
De tijden gelden voor deze machine/belasting; de pariteitscontroles en kostentoets hangen daar niet van af.

## Resultaten

Gemeten productcode: `c9d5e5138436cfffdf9790b485ceaaae5a03eee7` (de latere bewijscommit wijzigt alleen dit document en de ruwe JSON).

| Taken | Vóór, mediaan | Ná, mediaan | Versnelling |
|---:|---:|---:|---:|
| 1,000 | 0.413 s | 0.226 s | 1.83× |
| 5,000 | 8.688 s | 1.769 s | 4.91× |
| 10,000 | 51.354 s | 7.705 s | 6.67× |

Drie afwisselende paren per grootte in één Node v24.22.0-proces; AMD Ryzen 7 3700U with Radeon Vega Mobile Gfx. Alle 18 runs hadden identieke invoer-, voorstel- en CPM-hashes per grootte. Nul onopgeloste taken; 756 / 4.311 / 8.920 verschoven taken. Tijden en startbelasting per afzonderlijke run staan in de [ruwe metingen](resource-leveler-performance.json).

Alle vóór/ná-paren moeten identieke SHA-256 hebben voor de invoer, het gehele `LevelingResult` en het
gehele CPM-resultaat na toepassing van de delays (inclusief alle taakvelden en relatie-analyses).
De runner faalt bij ieder verschil of bij een afwijkende projecteinddatum tussen voorstel en CPM.

## Regressiedekking en grenzen

- `check-leveler-differential.ts`: 300 deterministische projecten verdeeld over OPS/MS Project/P6;
  286 geldige voorstellen vergeleken (288 checks inclusief dekkingscontroles). Het gehele voorstel bytegelijk aan het bestaande volledige-solve-pad, inclusief relaties/lags,
  ALAP/hammock, kalenders, elapsed, scope, splitsen en plafonds.
- `check-leveler-forward.ts`: 251 controles op herhaalde wijzigingen, teruggenomen delays/gaten,
  samengevoegde markeringen, vertakkingen/samenkomst, dubbele relaties, voortgang, statusdatum,
  dag-/uurkalenders en de drie profielen. Een keten van 100/200 taken vereist 298/598
  `addWorkDaysChecked`-aanroepen: kalenderwerk groeit op die route lineair, zonder wandklokbudget.
- Review P2: voltooidvenster bij `completion: 1` zonder werkelijk einde. Zowel het volledige
  voorstel als alle poolboekingen worden vergeleken met het oude volledige-solve-pad, met/zonder
  werkelijke start en met/zonder eerdere verschuiving die de sessie activeert. De tweetaakscasus
  pint `delays: { b: 2 }` en de eerste boeking op 10 juni. De uitgebreidere casus faalt op
  `79deaed88` (exit 1) en slaagt na de conservatieve terugval (exit 0).
- Bestaande gerichte batterijen voor resource-leveling (25 cases), splits, plafond, scope,
  splits-modus en poolgrootboek: exit 0.

`npm run measure:profiles`: exit 0, regel A gehouden. P6: geen nieuwe/verslechterde/grotere of
andere celmutaties; 221 bestaande inexacte cellen ongewijzigd. De P6-subcheck zelf heeft exit 1
vanwege het bestaande nuldoel (76 zesassige afwijkingen), door de meetpoort expliciet geclassificeerd
als `NULDOEL (regel A gehouden)`. MS Project: exit 0, 2.196 checks over 661 bestanden; corpusloze
vangrails exit 0. Geen herpin uitgevoerd.

Bij de review werd daarnaast een mogelijke B3/dagkalender-TypeError op de basiscommit gemeld.
Die is niet zelfstandig bevestigd en uitsluitend als S-item 186 in `knownbugs.md` vastgelegd.

De volledige planning-/tijdzonematrix en CI worden volgens de laatste werkverdeling door de parent
bewaakt. Geen prestatiebudget, profielbaseline of semantische uitzondering is verruimd.

De definitieve code is gecontroleerd met onderstaande opdrachten, elk exit 0:

```bash
npm run typecheck
npx eslint src/engine/scheduler/CPMSolver.ts src/engine/scheduler/ResourceLeveler.ts src/engine/scheduler/levelingQueue.ts
npm run verify:conventions
npm run measure:profiles
bash tests/planning/run.sh check-leveler-forward.ts check-leveler-differential.ts cases-resource-leveling.json check-leveler-splits.ts check-leveler-ceiling.ts check-leveler-scope.ts check-leveler-splitmode.ts check-leveler-pool-ledger.ts
```


## Integratie met actuele main op 22 oktober 2026

Main `3a2f597f33c4da4b8948ccc922cea18664ae82eb` is met normale mergecommits opgenomen,
inclusief #481 (IFC-lezen), #482 (F5-schrijfpad), #483 (recovery-worker) en #503 (MPP-importverslag).
Het enige tekstconflict was `knownbugs.md`: de op main opgeloste bug 121 blijft verwijderd; alle
andere main-mutaties blijven staan. De onbevestigde B3-bijvangst heet uiteindelijk 186; de aanvankelijk gekozen nummers
176 en 184 waren inmiddels ook op main gebruikt. De documentverwijzing is mee aangepast.

De automatisch samengevoegde `CPMSolver.ts` behoudt de nieuwe externe-lag-omrekening en de
A22-uitleg van main; `ResourceLeveler.ts` behoudt de intrinsieke piekdetails uit #419. De geteste
P2-terugval voor voltooid zonder werkelijk einde en de luie opbouw van de PF-sessie zijn intact.
De locale-resolutie is na beide merges uitgevoerd; de locale-inhoud blijft gelijk aan main.

De prestatiegetallen hierboven blijven bewijs van productcode `c9d5e5138`, niet van een nieuwe
meting na deze integratie. De integratie is opnieuw op gedrag en profielpariteit gecontroleerd.

Integratiechecks: de veertien gerichte planningbatterijen (nivelleerder incl. P2/forward,
differential, splits, scope, pool, piekdetails, plafond, delay-eenheden, invoer, toepassen,
externe lag, F5-schrijfpad en recovery-worker) plus 25 resource-leveling-cases eindigen op exit 0.
`npm run typecheck` eindigt eveneens op exit 0.

`npm run measure:profiles` eindigt bij deze integratie op **exit 1**: MS Project heeft voor het
publieke `timephased-cost-rollup.mpp` drie einddatumafwijkingen van de pin (`finishExact` 9 → 6,
`finishDiff` 0 → 3). Een controlebundel met `CPMSolver.ts` én `ResourceLeveler.ts` rechtstreeks
uit main `3a2f597f3`, en alle overige ingeladen productbronnen gelijk aan main, heeft exact dezelfde
fidelity-uitkomst (exit 1). Er zijn geen baselines herpind. Bijvangst: knownbug 187.
P6 houdt alle 221 bestaande inexacte cellen zonder enige celmutatie; zijn bestaande nuldoel
geeft subcheck-exit 1, geclassificeerd als `NULDOEL (regel A gehouden)`.
De corpusloze profielvangrails zijn groen (exit 0).

De laatste opgenomen main is `86024504cf422d489b36f2a19775a9b72329a553`: #478 voegt alleen
voorstel-UI, browserdekking en bewijs toe; #507 ontsnapt de MSPDI-projectstart en heeft eigen
XML-adapterdekking. Geen van beide wijzigt de geteste enginebestanden of de F5/recovery-kern.
Daarom zijn de engine-/profielruns niet herhaald, volgens de aanvullende opdracht. De bestaande
main-bijvangstnummers 184 (APT) en 185 (MSPDI) blijven behouden; onze notities zijn 186 (B3) en
187 (MPP-fidelity). Er zijn geen main-mutaties teruggedraaid.

De nieuwe XML-adapterregressie uit #507 is op de uiteindelijke integratie uitgevoerd:
`bash tests/planning/run.sh check-xml-adapter-fidelity.ts` — 120 checks, exit 0.
Gerichte ESLint op de drie motorbestanden, `verify:conventions` en `verify:i18n` hebben exit 0.
Na de laatste UI/XML-merge zijn engine-, F5- en recovery-bronnen bytegelijk aan de reeds geteste
combinatie; typecheck en de engine-/profielbatterijen zijn daarom niet opnieuw gestart.
