# Markera, ta bort och ångra uppgifter

Mål: markera uppgifter, ta bort dem och ångra ett misstag.

## När du behöver det

Nästan alla åtgärder i tidsplanen gäller de uppgifter som du har markerat: att ta bort, att kopiera, att använda indrag och att slå på eller av en milstolpe. Du tar bort uppgifter när de inte behövs längre eller när tidsplanen ändras. Eftersom appen inte frågar om bekräftelse när du tar bort är *Ångra* ditt säkerhetsnät.

## Steg

### Markera uppgifter

- **En uppgift.** Klicka på raden i uppgiftstabellen eller på balken i Gantt-diagrammet.
- **Fler uppgifter.** Ctrl+klicka (⌘+klicka på en Mac) lägger till en uppgift i markeringen eller tar bort den. I uppgiftstabellen markerar Skift+klicka alla uppgifter från den aktiva uppgiften till den du klickade på.
- **Alla synliga uppgifter.** Ctrl+A, med fokus i uppgiftstabellen eller i Gantt-diagrammet. Uppgifter som ett filter döljer ligger utanför markeringen, och detsamma gäller för underuppgifter i en ihopfälld fas.
- **En markeringsruta i Gantt-diagrammet.** Håll Ctrl nedtryckt och dra över den tomma bakgrunden: alla uppgifter i raderna som rutan berör markeras, även om deras balk ligger bredvid den. Bara rutans höjd räknas, inte tidsaxeln. Släpper du Ctrl först efter musknappen, läggs de till i den befintliga markeringen. Annars ersätter de den. Utan Ctrl scrollar dragningen tidslinjen i standardinställningen.
- **Inget.** Esc, eller klicka på den tomma bakgrunden i Gantt-diagrammet.

Om du markerar en sammanfattningsuppgift markeras inte dess underuppgifter med. Men när du tar bort eller kopierar tas de med.

### Ta bort uppgifter

Markera uppgifterna och välj ett av dessa sätt:

- *Start › Redigera › Ta bort*. Samma knapp finns på fliken *Tabell*.
- Delete eller Backspace, om fokus inte ligger i uppgiftstabellen. Klicka då först på en balk i Gantt-diagrammet.
- *Ta bort* i snabbmenyn (högerklick). Ingår uppgiften du klickade på i markeringen, gäller det hela markeringen. Annars gäller det bara den uppgiften.
- Den lilla papperskorgen högst upp i panelen *Egenskaper* (verktygstips *Ta bort uppgift*). Den tar bort uppgiften som panelen visar.

Appen frågar inte om bekräftelse. Tar du bort flera uppgifter samtidigt är det ett enda steg för *Ångra*.

Dessa saker försvinner tillsammans med uppgifterna: alla underuppgifter till en borttagen sammanfattningsuppgift, alla samband från och till de borttagna uppgifterna samt deras tilldelningar. Tar du bort den sista underuppgiften i en sammanfattningsuppgift, blir sammanfattningsuppgiften kvar som en vanlig uppgift. Om *WBS auto* är på numrerar appen trädet om. Tidsplanen är efteråt inte längre aktuell: tryck på **Beräkna** (F5), om inte *Beräkna automatiskt* är på.

### Fäll ihop och fäll ut

En sammanfattningsuppgift har en triangel framför sitt namn i uppgiftstabellen. Klicka på den för att dölja eller visa dess underuppgifter. Med *Visa › Översikt › Fäll ihop* och *Fäll ut* gör du det för de markerade sammanfattningsuppgifterna, eller för alla om inget är markerat. Snabbmenyn för en sammanfattningsuppgift har också *Fäll ihop* och *Fäll ut*. I en grupperad vy gäller knapparna grupperna.

Appen håller ihopfällning och utfällning per öppet dokument. Det ingår inte i *Ångra* och inte i projektfilen.

### Ångra och gör om

- *Start › Redigera › Ångra* och *Gör om* (även på fliken *Tabell*), pilarna i namnlisten eller Ctrl+Z för att ångra och Ctrl+Y eller Ctrl+Skift+Z för att göra om.
- Gör du något nytt efter en *Ångra* är *Gör om* borta.

*Ångra* omfattar ändringar i projektdata (uppgifter, samband, resurser, kalendrar och liknande) och att du tillämpar en layout. Ändringar i kolumnerna i uppgiftstabellen är också steg: att lägga till, ta bort, flytta, ändra storlek på, anpassa automatiskt, fästa och återställa kolumnlayouten till standard. Stegen för kolumner hör till uppgiftstabellen självt och gäller för hela appen, inte för ett enskilt dokument. Appen sparar de senaste hundra stegen per dokument, färre för ett mycket stort projekt.

## Fallgropar och vad appen gör

**Delete i uppgiftstabellen tar inte bort en uppgift.** Om fokus ligger i uppgiftstabellen rensar Delete (eller Backspace) innehållet i de markerade cellerna. För en obligatorisk eller beräknad cell, till exempel namnet eller varaktigheten, vägrar appen och visar ett meddelande under uppgiftstabellen. För namnet visas till exempel *Det här värdet krävs och kan inte lämnas tomt.* Då rensas inget, inte ens i andra markerade celler. Klicka på en balk i Gantt-diagrammet eller använd *Ta bort* (på fliken *Tabell*, där det inte finns något Gantt-diagram: *Tabell › Redigera › Ta bort* eller snabbmenyn).

**En hel fas försvinner på en gång.** Tar du bort en sammanfattningsuppgift försvinner dess underuppgifter, deras samband och tilldelningar med den. *Ångra* (Ctrl+Z) hämtar tillbaka allt, även sambanden och tilldelningarna.

**Det som inte kommer tillbaka.** Markeringen, ihopfällning och utfällning samt knappen *Rensa* i remsan *Inte tillgänglig vid filtrering/gruppering/sortering* ingår inte i *Ångra*. Trycker du på Ctrl+Z efter *Rensa* ångrar du alltså ditt föregående steg, inte rensningen.

**Att ta bort en uppgift som andra uppgifter hänger på.** Sambanden från och till den uppgiften försvinner också. Uppgifter som bara var kopplade till den lossnar och startar på sin egen planerade start igen efter **Beräkna**. Lägg till nya samband vid behov, se [Lägga till samband](docs://howto-relaties-leggen).

## Se även

- [Lägga till uppgifter och milstolpar](docs://howto-taken-en-mijlpalen-toevoegen): det omvända, och att kopiera uppgifter.
- [Justera strukturen](docs://howto-structuur-aanpassen): hänga en uppgift under en annan fas i stället för att ta bort den.
- [Dra, panorera och zooma i Gantt-diagrammet](docs://howto-gantt-bedienen): markeringsrutan och scrolllägena.
- [Snabbmenyer](docs://ref-contextmenus): vad *Ta bort* och de andra posterna gör med en markering.
