# Laden en rekenen op de achtergrond — besluiten van de eigenaar (brainstorm, 2026-10-08)

Aanleiding (eigenaar, bij de check van #109): "ik wil dat er ergens een loading indicator komt waardoor er feedback
is voor de gebruiker wanneer een bestand wordt ingeladen of een nieuwe calculate plaatsvind. ondertussen moet de UI
volledig bruikbaar blijven". Verkenning: `2026-10-08-verkenning-laden-rekenen-achtergrond.md`.

1. **Wat mag tijdens rekenen?** "A": alles, ook wijzigen. Een berekening op oude invoer wordt weggegooid; de app
   rekent opnieuw met de wijziging erin.
2. **Tekst:** "Berekenen" met drie bewegende puntjes ("'berekenen. . .' en de puntjes bewegen").
3. **Openen:** geen tijdelijk tabblad ("een tabblad is echt bizar dom"); eerder onderin of een aparte dialoog.
   Orkestrator: met een kruisje om het openen af te breken.
4. **Na het laden:** "A": de app springt naar het nieuwe document, zoals nu.
5. **Plek van de indicator:** niet onderin, maar per project op drie plekken: het documenttabblad, het item in de
   projectrail (links, bv. "NS") en de projectwisselaar (pill) in de titelbalk — "dan heb je meer overzicht als je
   met verschillende projecten werkt".
6. **Workers:** "elk project moet een eigen worker krijgen bij het berekenen zodat wanneer je bijvoorbeeld bezig
   bent met de library dat het dan niet bizar lang duurt". Orkestrator: het aantal gelijktijdige workers krijgt een
   bovengrens (aantal processorkernen); de rest wacht in een rij.
7. **Openen = meteen een gewoon tabblad** (eigenaar: "je kunt toch gewoon al een nieuw tabblad openen?";
   bevestigd "ja"): tabblad, rail-item en wisselaar verschijnen direct met de indicator; in het werkvlak
   "<bestand> openen. . ."; tabblad direct actief; na laden springt de app ernaar; sluiten breekt af.
   Orkestrator: tijdens laden niets te wijzigen; telt niet mee voor opslaan/crashherstel.
8. Eigenaar: "ik heb echter het idee dat je jezelf nog niet hebt ingelezen in de omliggende code en dat je een
   beetje gokt over alles. gebruik haiku 5.5 hiervoor" ⇒ vier Haiku-leesagents (UI, documenten/openen,
   rekenen/workers, MCP/extensies), uitvoer in /tmp/ops-lezen/.

## Wat het codelezen opleverde (Haiku 5.5, nagelezen; `laden-rekenen-lezen/*.md`)

- De app toont één navigatiestijl tegelijk (tabs standaard / rail / wisselaar, `documentChromeStyle`); de indicator
  komt in de zichtbare stijl + het projectoverzicht.
- Een laadtabblad vraagt vier aanpassingen: niet herbruikbaar als "leeg tabblad" (`isActivePristine`), resultaat naar
  het eigen document i.p.v. het actieve (`applyLoadedProject` gebruikt `get()`), niet in crashherstel, en sluiten
  breekt af (er bestaat nog geen annuleren).
- Een bibliotheekwijziging rekent nu alleen het actieve document; slapende documenten krijgen alleen "verouderd".
  Automatisch rekenen staat standaard uit.
- MCP en de extensie-API verwachten synchroon rekenen (transacties weigeren een Promise). Orkestrator: zij houden de
  synchrone route; alleen de gebruikersroute gaat via de worker — zoals nivelleren nu al werkt.
9. **Bibliotheekwijziging:** "doe inderdaad maar B" — alle open projecten herrekenen alleen als automatisch rekenen
   aan staat (dan parallel, elk in een eigen worker); anders blijft "verouderd tot F5".
   Correctie eigenaar: zijn opmerking over de bibliotheek "ging erover wanneer je resources gaat nivelleren over
   meerdere projecten" ⇒ dat pad (bezetting/verdelen/nivelleren over projecten) moet de worker-per-project krijgen.
10. **Rail (verticale projectwisselaar):** "een statusbolletje, geen spinner". Orkestrator: zacht pulserend tijdens
    bezig, stil bij prefers-reduced-motion; aanpasbaar bij het prototype.
11. **Bouwvolgorde:** "b" — stap 1: indicator + rekenen op de achtergrond met een worker per project (F5, automatisch
    rekenen, bezettingsoverzicht); stap 2: openen op de achtergrond met laadtabblad. Prototype na elke stap.

## Stand (2026-10-08): GEPARKEERD door de eigenaar ("maar niet nu")

Laatst voorgelegd, nog niet beantwoord: **ontwerp stap 1, deel 1 — wat je ziet tijdens het rekenen**: tabblad = naam +
drie bewegende puntjes (tooltip "Berekenen. . ."); rail = zacht pulserend statusbolletje; wisselaar = "Berekenen. . ."
na de naam; projectoverzichtkaart = "Berekenen. . ."; werkvlak toont de oude planning tot de nieuwe klaar is;
indicator pas na 250 ms en minstens 500 ms zichtbaar; per rekenend project een eigen indicator; reduced-motion = stil;
fouten via de bestaande melding. Daarna volgen: deel 2 (architectuur: workerpool per project, generatieteller,
synchrone route voor MCP/extensies), spec, plan.

## Besluit 12 (2026-10-10): overal een bolletje

Eigenaar, op het voorstel van deel 1 (tabblad-puntjes, rail-bolletje, wisselaar-tekst): "doe overal maar een
bolletje". Dus: tabblad, rail, wisselaar in de titelbalk en de kaart in het projectoverzicht tonen tijdens het rekenen
alleen een statusbolletje (zacht pulserend; stil bij prefers-reduced-motion). Geen bewegende puntjes en geen zichtbare
tekst "Berekenen. . .". Orkestrator-aanname, nog te bevestigen bij het prototype: de tooltip/aria-label
"Berekenen…" blijft, voor uitleg bij hover en voor schermlezers. De rest van deel 1 (oude planning blijft staan,
250 ms / 500 ms, per project, fouten via de melding) is niet tegengesproken. Stand blijft: geparkeerd; deel 2
(architectuur) is nog niet voorgelegd.
