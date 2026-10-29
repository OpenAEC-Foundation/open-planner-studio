# Flytning af et projekt

Mål: forskyd hele tidsplanen til en ny startdato, og se på forhånd, hvad det betyder for slutdatoen.

## Hvornår har du brug for dette

Startdatoen for arbejdet forskyder sig: tilladelsen kommer senere, eller du genbruger tidsplanen fra et tidligere hus til det næste. Det er meget arbejde at forskyde hver opgave for sig. Med **Flyt projekt** indtaster du én ny startdato, og appen forskyder alt med.

Projektslutdatoen forskyder sig ikke altid lige meget som startdatoen. **Kalenderen** følger ikke med: helligdage, byggeferien og vinterstoppet ligger på faste datoer. Et eksempel: med *Start › Fil › Ny* opretter du et projekt med *Startdato* 29-09-2026, *Land* på *Nederlandene* og *Byggeferie* på *Ingen*. Du lægger en tidsplan med 30 arbejdsdage i, som slutter 9. november 2026. Forskyder du den til 14. december 2026, altså 76 kalenderdage senere, slutter den 26. januar 2027. Det er 78 dage senere, fordi 25. december og 1. januar nu er fridage i din tidsplan. Varigheden er stadig 30 arbejdsdage. Forhåndsvisningen i vinduet viser dette, før du ændrer noget.

## Trin

1. Vælg *Tidsplan › Tidsplan › Flyt projekt…*. Knappen er deaktiveret, så længe projektet ikke har en startdato.
2. Under *Aktuel projektstartdato* ser du, hvor projektet starter nu, og under *Ny projektstartdato* vælger du den nye dato.
3. Har projektet oprindelige planer, vises afkrydsningsfeltet *Flyt også oprindelige planer*. Lad det være fra, hvis du vil blive ved med at se forskydningen som afvigelse (se faldgruberne).
4. Klik på *Beregn forhåndsvisning*. Appen beregner den forskudte tidsplan helt, uden at ændre noget i dit projekt.
5. Se på forhåndsvisningen (se nedenfor). Er den rigtig, så klik på *Flyt*.

I forhåndsvisningen ser du:

- forskydningen i kalenderdage (*Forskydning: 76 kalenderdage frem*);
- *Projektstartdato* og *Projektslutdato*, fra før til efter;
- en rød advarsel, hvis kalenderen spiller ind, eller meddelelsen om, at projektets varighed er den samme;
- antallet af forskudte opgaver og hvad der ellers forskydes med;
- advarsler, som du skal læse (se faldgruberne).

Appen beregner den nye tidsplan med det samme, så du behøver ikke bruge **Beregn** (F5), og den tilpasser visningen til hele projektet. Det hele kan fortrydes i ét trin med *Fortryd* (Ctrl+Z).

Knappen *Flyt* virker kun efter en forhåndsvisning uden fejl, og hvis den nye dato er anderledes end den aktuelle. Ændrer du datoen eller feltet, forsvinder forhåndsvisningen, og du beregner igen.

### Hvad der forskydes, og hvad der ikke gør

Disse ting forskydes: start- og slutdatoen for hver opgave, den faktiske startdato og den faktiske slutdato, datoerne for begrænsninger (også af en hård fastlåsning (Mandatory), se [Begrænsninger og deadlines](docs://uitleg-constraints)), deadlines, statusdatoen, ankerpunkterne for de eksterne afhængigheder og tilgængelighedstrinnene for ressourcer. Projektstartdatoen og, hvis du har udfyldt den, projektslutdatoen forskydes også.

Disse ting forskydes ikke:

- kalenderne, så helligdage, byggeferien og vinterstoppet;
- oprindelige planer, medmindre du slår *Flyt også oprindelige planer* til;
- et udfyldt brugerdefineret felt af typen *Dato*.

## Faldgruber, og hvad appen gør

**Slutdatoen forskyder sig et andet antal dage.** Hvis forhåndsvisningen viser, at slutdatoen forskyder sig med flere eller færre kalenderdage end startdatoen, eller at projektets varighed i arbejdsdage ændrer sig, viser den en rød advarsel med tallene. Du kan så stadig annullere.

**Oprindelige planer bliver liggende.** En oprindelig plan findes for at måle afvigelse. Forskyder du projektet, mens feltet er fra, ser du forskydningen som afvigelse fra den oprindelige plan. Slår du feltet til, forskyder de oprindelige planer sig med tidsplanen. Kun deres datoer forskydes. Datoen, hvor den oprindelige plan blev gemt, forskydes ikke.

**Et igangværende projekt.** Faktiske datoer følger med. I et projekt, hvor du allerede har indtastet fremdrift, er det ikke altid det, du vil. Appen advarer: *Kontroller, om det er korrekt for et igangværende projekt.*

**Eksterne afhængigheder.** Ankerpunktet i dit eget projekt følger med, men kildeprojektet gør ikke. Opdater de eksterne afhængigheder efter flytningen med *Start › Opgaver › Sammenkæd ▾ › Opdater alle eksterne afhængigheder*. Se [Eksterne afhængigheder til et andet projekt](docs://howto-externe-relaties).

**Helligdage, der ikke rækker langt nok.** En kalender med genererede helligdage dækker en række år. Løber den forskudte tidsplan ud over det, beregner appen det år uden helligdage. Forhåndsvisningen advarer om det, for eksempel: *De genererede helligdage i kalenderen “Bouwkalender NL” dækker 2025–2029. Den forskudte tidsplan løber til 2030. Generér helligdagene igen.* Flyt projektet først. Åbn derefter *Tidsplan › Kalender › Kalender*: ved siden af helligdagene står der nu *Generér igen*. Bekræft med *Anvend*, og appen genberegner. Området for de nye helligdage følger projektdatoerne, så det hjælper ikke at generere dem igen før flytningen.

**Datoen ligger i fortiden.** Det er tilladt, men forhåndsvisningen nævner det: *Den nye startdato ligger i fortiden*.

**Ændring af projektstartdato i Projektindstillinger er noget andet.** Ændrer du startdatoen i *Indstillinger › Projekt › Projektindstillinger* og vælger *Anvend*, forskyder tidsplanen sig ikke. Kun opgaver uden foregående opgave eller begrænsning, som så ville ligge før den nye start, forskydes til den dato, og appen fortæller dig, hvor mange. Vil du forskyde alt, bruger du *Flyt projekt…*.

## Se også

- [Kritisk vej og slæk](docs://uitleg-kritiek-pad): hvordan tidsplanen beregnes, og hvorfor slutdatoen forskyder sig.
- [Tilføj afhængigheder](docs://howto-relaties-leggen): afhængigheder bliver bare liggende, når du forskyder.
- [Nyt projekt og Projektindstillinger](docs://ref-projectinfo): hvad startdatoen i Projektindstillinger gør.
