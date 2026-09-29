# Een pad traceren

Doel: de keten van taken vóór of na een taak zichtbaar maken, zodat je ziet waardoor een taak op zijn datum staat en wat er meeschuift als hij uitloopt.

## Wanneer je dit nodig hebt

Het dakwerk begint pas over drie weken en je wilt weten welke taak dat bepaalt. Of de metselaar loopt een week uit en je wilt zien welke taken erna meeschuiven. In een planning met tientallen relaties zie je dat niet aan de lijnen. Met **pad traceren** kleurt de app alle **voorgangers** (taken die vóór de gekozen taak komen, direct of via andere taken) en **opvolgers** (taken die erna komen) en dimt de rest.

## Stappen

1. Selecteer de taak waarvan je het pad wilt zien, in de takenlijst of op de balk in de Gantt. Selecteer je meer taken, dan traceert de app vanaf de taak die je als eerste hebt geselecteerd.
2. Kies *Planning › Pad traceren › Voorgangers* voor alles wat vóór de taak komt, of *Planning › Pad traceren › Opvolgers* voor alles wat erna komt. Beide knoppen mogen tegelijk aan. Dezelfde twee knoppen staan op het tabblad *Tabel*, in de groep *Pad traceren*.
3. Wil je beide richtingen in één keer, klik dan met de rechtermuisknop op de taak, in de Gantt of in de takenlijst, en kies *Pad traceren*.
4. Bekijk het resultaat in de Gantt en in de takenlijst. Hoe je het leest, staat hieronder.
5. Stoppen doe je door de actieve knop nog eens aan te klikken, door met de rechtermuisknop op een taak *Traceren stoppen* te kiezen, of met Esc. Esc heft ook de selectie op.

Selecteer je tijdens het traceren een andere taak, dan volgt het pad de nieuwe selectie.

## Het resultaat lezen

- Voorgangers staan in goud, opvolgers in paars. In de Gantt kleuren de balken, in de takenlijst staat links van de rij een streep: effen voor voorgangers, gestreept voor opvolgers. De gekozen taak heeft een omlijning.
- Een donkerdere kleur, in de takenlijst een dikkere streep met vetgedrukte tekst, markeert de keten van **bepalende** relaties: de relaties die de datums werkelijk bepalen. Wat dat betekent, staat in [Relaties en lag](docs://uitleg-relaties).
- Alle taken buiten het pad zijn gedimd. Relatielijnen die niet bij het pad horen, zijn vager en gestippeld.

## Valkuilen en wat de app dan doet

**Geen taak geselecteerd.** Zonder geselecteerde taak is er niets om te traceren: de knop staat wel aan, maar er verandert niets in beeld. Selecteer eerst een taak.

**Geen nadruk op de bepalende keten.** De nadruk komt uit de laatste berekening. Is de planning nog niet berekend, of geeft de berekening een fout, dan tint de app alle voorgangers en opvolgers even sterk. Druk op **Bereken** (F5), bijvoorbeeld via *Start › Planning › Bereken*, en bekijk het pad opnieuw. Na een wijziging blijft de nadruk bij de vorige berekening staan zolang de statusbalk *Verouderd — herbereken (F5)* meldt.

**Een relatie op een fase.** Het traceren volgt de relaties zoals je ze hebt gelegd. Een relatie van of naar een fase (samenvattingstaak) verbindt de fase zelf. Voor de berekening geldt hij voor elke taak in die fase, maar het pad loopt niet door naar de taken erin. Traceer je een taak in een fase die met een relatie op de fase zelf aan een andere taak vastzit, dan zie je die relatie dus niet. Selecteer in dat geval de fase zelf.

**Alleen de gekozen richting.** Staat alleen *Voorgangers* aan, dan zie je niet wat er na de taak komt, en andersom.

## Zie ook

- [Relaties en lag](docs://uitleg-relaties): waarom een relatie bepalend is en hoe de app de startdatum van een taak berekent.
- [Kritiek pad en speling](docs://uitleg-kritiek-pad): welke keten het einde van het project bepaalt.
- [Relaties leggen](docs://howto-relaties-leggen): een relatie toevoegen als je in het pad een verbinding mist.
