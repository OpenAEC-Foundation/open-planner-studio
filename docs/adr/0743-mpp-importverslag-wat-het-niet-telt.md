# MPP lezen: wat het importverslag bewust niet telt

`scanMppImportLoss` (`mppImportLoss.ts`, issue #391) telt per soort wat `readMPP` niet overneemt, met dezelfde
recordselectie als de lezer (`mppRecords.ts`). Een fout in een deel laat dat deel op 0: het verslag mag het openen
nooit breken. Een paar dingen die op verlies lijken, telt het bewust niet, omdat ze wel meekomen of al elders tellen.

## Gevolgen

- Terugkerende taken tellen niet: de keren staan als gewone subtaken in het bestand. Kostenresources ook niet: ze
  komen mee als resource (ADR 0742). Vlaggen (ja/nee-velden) evenmin: volgens het weggehaalde commentaar zijn het
  bitvelden in de metadata en geen var-data, dus de scan ziet ze niet.
- Van een resource tellen alleen baseline 1 tot en met 10; baseline 0 is de optelling van de toewijzingen, en die
  tellen al.
- Tarieven tellen uit de tarieftabel én uit de vaste velden: volgens het weggehaalde commentaar slaat MS Project tabel A
  soms niet op en staan de tarieven dan alleen in de vaste velden.
- Een aantekening telt alleen met zichtbare tekst, een afbeelding of een ingesloten object; een RTF-aantekening met
  alleen opmaak niet (`noteHasContent`).
