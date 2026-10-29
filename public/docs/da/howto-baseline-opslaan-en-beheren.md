# Gem og administrer en oprindelig plan

Mål: gem tidsplanen som en aftale (en oprindelig plan), så du senere kan se, hvor langt udførelsen afviger. Behold, omdøb, vælg og slet flere oprindelige planer.

## Hvornår du har brug for dette

Du gemmer en oprindelig plan, når tidsplanen er godkendt, og arbejdet endnu ikke er gået i gang. Hvis tidsplanen senere revideres formelt, for eksempel efter en ændringsordre, gemmer du en anden oprindelig plan og beholder den første. Så måler du udførelsen mod både den første aftale og den reviderede. Hvad en oprindelig plan præcis registrerer, og hvordan appen beregner afvigelsen, forklares i [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang).

## Trin

### Gem en oprindelig plan

1. Tryk på **Beregn** (F5), for eksempel via *Tidsplan › Tidsplan › Beregn*. Den oprindelige plan gemmer de datoer, som er beregnet på det tidspunkt.
2. Vælg *Tidsplan › Oprindelige planer & fremdrift › Administrer oprindelige planer…*. Vinduet *Oprindelige planer* åbnes.
3. Under *Gem ny oprindelig plan* står et forslag til et navn, for eksempel *Oprindelig plan 1 — (dagens dato)*. Skriv et eget navn, som du senere kan genkende, for eksempel *Oprindelig plan*.
4. Klik på *Gem*. Den oprindelige plan står nu på listen og er straks den aktive.
5. Klik på *Luk*.

Under hver opgavebjælke i Gantt-diagrammet ligger nu en tynd bjælke med datoerne for den oprindelige plan. En milepæl får en lille diamant. Du slår dette overlay til eller fra med *Visning › Oprindelige planer & fremdrift › Overlay for oprindelig plan*.

### Vælg den aktive oprindelige plan

Åbn *Administrer oprindelige planer…* og vælg i kolonnen *Aktiv* den oprindelige plan, du vil sammenligne med. Så længe der er oprindelige planer, er præcis én aktiv. Gantt-overlayet, rapporttypen *Afvigelse* og *Fremdriftsrapport* bruger den.

### Omdøb en oprindelig plan

Ændr navnet på listen. Ændringen træder straks i kraft. Du behøver ikke at klikke på *Gem*.

### Slet en oprindelig plan

Klik på den lille papirkurv ved siden af den oprindelige plan på listen. Hvis du sletter den aktive oprindelige plan, spørger appen *Vil du slette den aktive oprindelige plan?*. Bagefter bliver den nyeste resterende oprindelige plan den aktive. Er der ingen anden, er der ikke længere en aktiv oprindelig plan, og overlayet forsvinder. Med Ctrl+Z henter du en slettet oprindelig plan tilbage. Luk vinduet først; Ctrl+Z virker ikke inde i et vindue.

### Afvigelser i opgavetabellen

Hver oprindelig plan har seks kolonner i opgavetabellen. Klik på **+** til højre i overskriften for opgavetabellen (*Tilføj kolonne*), og åbn kategorien *Oprindelig plan*. Per oprindelig plan er der *Planlagt startdato*, *Planlagt slutdato*, *Varighed*, *Startafvigelse*, *Slutafvigelse* og *Varighedsafvigelse*, med navnet på den oprindelige plan foran, for eksempel *Oprindelig plan — Slutafvigelse*. Afvigelserne er i arbejdsdage: et plus betyder senere, et minus betyder tidligere. En opgave, der ikke er med i den oprindelige plan, viser en tankestreg (—) i disse kolonner.

## Faldgruber og hvad appen gør

**En forældet tidsplan.** Hvis tidsplanen er forældet, viser vinduet *Tidsplanen er forældet. Beregn først igen (F5)*. Det er en advarsel. Du kan stadig gemme. Men så gemmer du de gamle datoer. Luk vinduet, tryk på **Beregn**, og gem først derefter.

**En oprindelig plan med fremdrift.** Gemmer du en oprindelig plan, efter at du har indtastet fremdrift, registrerer den tilstanden med de faktiske datoer. Afvigelsen er så nul, og den siger ikke længere noget om udførelsen. Gem den oprindelige plan, før arbejdet går i gang.

**En oprindelig plan kan ikke opdateres.** Vil du revidere aftalen, gem en ny oprindelig plan, og slet den gamle, hvis det er nødvendigt.

**En ⚠ ved Varighed eller Varighedsafvigelse.** For en opgave i timer er en dag den arbejdstid, som kalenderen har. Har kalenderen sine egne timer pr. dag (for eksempel 8 med tidsbånd på 10 timer, fra Primavera P6), talte en ældre version af appen dagene anderledes. En oprindelig plan fra den version beholder det gamle tal: en opgave på 1870 timer er 233,75 dage i den oprindelige plan og 187 dage nu. Appen konverterer ikke en sådan oprindelig plan. Kolonnerne *Varighed* og *Varighedsafvigelse* for den oprindelige plan viser så en ⚠; hold markøren over den for at se forklaringen. Datoerne i den oprindelige plan er korrekte. Gem en ny oprindelig plan, og slet den gamle, hvis det er nødvendigt.

**Kun opgaver uden underopgaver.** En fase er ikke med i den oprindelige plan. Den har ingen bjælke for den oprindelige plan og ingen afvigelse. Fasen følger af de opgaver under den.

**Nye og slettede opgaver.** En opgave, du tilføjer efter at have gemt, har ingen bjælke for den oprindelige plan. I afvigelsesrapporten vises den som *Ny*. En opgave, du sletter, vises som *Udgået*.

**Flyt projekt.** Når der findes oprindelige planer, står der et afkrydsningsfelt *Flyt også oprindelige planer* i vinduet *Flyt projekt…*. Det er som standard fra. De oprindelige planer bliver stående, så forskydningen vises som afvigelse. Se [Flyt et projekt](docs://howto-project-verplaatsen).

**Gemt i projektfilen.** De oprindelige planer og valget af den aktive gemmes sammen med projektet. De er der igen, når du åbner filen.

## Se også

- [Fremdrift, statusdato og oprindelig plan](docs://uitleg-voortgang): hvad en oprindelig plan registrerer, og hvordan afvigelsen beregnes.
- [Flyt et projekt](docs://howto-project-verplaatsen): afkrydsningsfeltet *Flyt også oprindelige planer*.
- [Opdater fremdrift](docs://howto-voortgang-bijwerken): at indtaste den faktiske tilstand, som du sammenligner med den oprindelige plan.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): én oprindelig plan (*Baseline at start*) før starten, med fremdrift og en statusdato på 20. maj 2027.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): to oprindelige planer, *Contract* og *Re-baseline (variation order)*, med fremdrift og en statusdato på 5. juli 2027.
