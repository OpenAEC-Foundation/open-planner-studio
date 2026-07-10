# Externe koppelingen

Het venster **Externe (cross-project) koppeling** legt een afhankelijkheid vast tussen een taak in dit project en een taak in een ánder projectbestand — bijvoorbeeld een terreinproject dat klaar moet zijn vóór jouw start.

## Openen

**Relaties**-tab → knop **Externe koppeling…**. Er moet precies één taak geselecteerd zijn; anders verschijnt "Selecteer eerst één taak om een externe koppeling toe te voegen."

## Het bevroren anker

Een externe koppeling rekent niet live mee met het bronproject. Bij het toevoegen wordt de relevante datum van de brontaak (start of einde, afhankelijk van richting en relatietype) als vaste **ankerdatum** opgeslagen; de berekening gebruikt die datum als grens. Wijzigt het bronproject daarna, dan schuift er niets mee totdat je de koppeling **ververst**.

## Twee routes

- **Bronbestand** — kies een bestand onder **Kies een recent bestand**; het wordt alleen-lezen ingelezen ("Het bronbestand wordt alleen-lezen ingelezen — het wordt niet als document geopend."). Kies daarna de **Brontaak** uit de lijst; de ankerdatum wordt automatisch uit die taak gelezen en onderin getoond. Deze route vereist de desktop-app en minstens één recent bestand.
- **Handmatig (fallback)** — geen bestand bij de hand (of de browser-versie): plak de **Project-id** en **Taak-id** van de externe taak, optioneel een **Taaknaam**, en vul zelf de **Ankerdatum** in. Een handmatige koppeling staat als "verouderd" gemarkeerd totdat een verversing de bron daadwerkelijk vindt.

## Gedeelde velden

- **Richting** — **Voorganger (extern → mij)**: de externe taak stuurt mijn taak; of **Opvolger (ik → extern)**: mijn taak stuurt de externe.
- **Relatietype** — FS, SS, FF of SF.
- **Lag (werkdagen)** — wachttijd (of negatief: overlap) bovenop het anker.

**Koppeling toevoegen** slaat de koppeling op (uitgeschakeld tot de verplichte velden zijn ingevuld); **Annuleren** sluit zonder toe te voegen.

## Beheer, verversen en bron-ontbreekt

Bestaande koppelingen staan in het Relaties-paneel onder **Externe koppelingen**:

- Per koppeling: de brontaak, het type, het anker, en een **verouderd**-badge zodra de bron niet (meer) geladen kon worden — met de toelichting "bron niet geladen — her-importeer om te verversen".
- **Ververs deze koppeling** — herleest het bronbestand van deze ene koppeling en werkt het anker bij.
- **Ververs externe ankers** — herleest élk gerefereerd bronbestand en werkt alle ankers plus de verouderd-status bij. Na afloop meldt een statusregel hoeveel ankers ververst zijn en hoeveel verouderd bleven.
- **Verwijderen** — haalt de koppeling weg.
- Verversen leest bestanden en kan dus alleen in de desktop-app; de browser-versie meldt "Bronbestanden lezen kan alleen in de desktop-app; gebruik de handmatige fallback."

## Verder lezen

- [Kritiek pad & geavanceerde analyse](docs://gids-kritiek-pad-analyse) — hoe externe koppelingen doorwerken in het kritieke pad.
