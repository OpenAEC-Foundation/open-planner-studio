# Høyreklikkmenyer

Hvilke menyer høyre museknapp åpner i Gantt og i aktivitetstabellen, hva hvert punkt gjør og hvilke aktiviteter det gjelder for. Punktene som også finnes som knapp eller hurtigtast, står i [Båndet, fane for fane](docs://ref-lint) og [Hurtigtaster](docs://ref-sneltoetsen).

## Hvilken meny hvor

Det finnes fire menyer. Hvilken du får, avhenger av hvor du klikker:

- **På en aktivitetsstolpe i Gantt** — aktivitetsmenyen, med *Start avhengighet herfra* øverst.
- **På en aktivitet i aktivitetstabellen** — den samme aktivitetsmenyen, uten det ene punktet øverst. Det gjelder for aktivitetstabellen til venstre for Gantt og for fanen *Tabell*.
- **På en gruppeoverskrift i aktivitetstabellen** — en liten meny for å utvide og skjule grupper. Gruppeoverskrifter vises bare når du grupperer, for eksempel med oppsettet *Ressursdiagram*.
- **På tomt område** — i Gantt ved siden av eller under stolpene, og i aktivitetstabellen under siste aktivitet eller på den grå raden *Ny aktivitet*. Menyen har *Ny aktivitet*, *Legg til milepæl* og *Lim inn*; i Gantt også *Tilbakestill zoom* og *Tilpass til prosjekt*. En ny aktivitet eller milepæl legges nederst i listen. I Gantt starter den på datoen der du klikket; i aktivitetstabellen åpnes navnecellen med en gang, så du kan skrive.

På tidsbåndet til en gruppeoverskrift i Gantt åpner høyre museknapp menyen for tomt område; selve gruppeoverskriften har bare en meny i aktivitetstabellen. Et høyreklikk i tidslinjens overskrift gjør ingenting. Kolonneoverskriftene i aktivitetstabellen har sin egen meny, som er beskrevet i [Tilpasse kolonner i tabellen](docs://howto-tabelkolommen-aanpassen).

**Hvilke aktiviteter gjelder et punkt for?** Du klikker på én aktivitet, men markeringen bestemmer omfanget. Hvis aktiviteten du klikker på, er en del av markeringen, gjelder punktet for hele markeringen. Hvis ikke, gjelder det bare for den ene aktiviteten. Ved høyreklikk på en stolpe i Gantt eller på en rad i aktivitetstabellen erstatter den aktiviteten markeringen, hvis den ikke var en del av den. Hvert punkt som endrer noe, er ett trinn i *Angre*, også for en hel markering.

## Aktivitetsmenyen

Punktene står i denne rekkefølgen. En linje mellom grupper er et skille i menyen.

**Start avhengighet herfra** — bare i Gantt, på en stolpe. Slår på avhengighetsmodus med denne aktiviteten markert; du drar deretter til etterfølgeren. Se [Legge til avhengigheter](docs://howto-relaties-leggen).

**Fjern avbrudd** og **Fjern alle avbrudd** — bare i Gantt, på en stolpe med avbrudd. *Fjern avbrudd* er bare der hvis du klikker på et avbrudd eller på delen etter det, og avbruddet kan redigeres; det fjerner det ene avbruddet. *Fjern alle avbrudd* fjerner alle, også avbrudd fra en kildefil som du ikke kan redigere. Se [Dele opp en aktivitet](docs://howto-taak-splitsen).

**Rediger...** — åpner vinduet *Rediger aktivitet* for denne aktiviteten. Se [Aktivitetsdialog og egenskapspanel](docs://ref-taak-eigenschappen).

**Sett inn over** og **Sett inn under** — setter inn én ny aktivitet over den øverste aktiviteten eller under den nederste i omfanget, på samme nivå. Det virker bare i ren trevisning, uten filter, gruppering eller sortering; ellers avviser appen det med en melding. Se [Legge til aktiviteter og milepæler](docs://howto-taken-en-mijlpalen-toevoegen).

**Legg til delaktivitet** — legger en ny aktivitet til som delaktivitet under aktiviteten du klikket på, nederst blant delaktivitetene. Bare for den ene aktiviteten, ikke for hele markeringen.

**Legg til milepæl** — legger en milepæl til som delaktivitet under aktiviteten du klikket på. Bare for den ene aktiviteten.

**Legg til avhengighet** — gjør det samme som *Start avhengighet herfra*: slår på avhengighetsmodus med denne aktiviteten markert. I aktivitetstabellen er punktet deaktivert hvis Gantt ikke vises, med verktøytipsen *Bare tilgjengelig når Gantt-diagrammet vises*.

**Rykk inn** og **Reduser innrykk** — flytter aktivitetene i omfanget ett nivå dypere eller ett nivå høyere i WBS. Disse to finnes bare i ren trevisning. Se [Tilpasse strukturen](docs://howto-structuur-aanpassen).

**Veksle milepæl** — gjør aktiviteten til en milepæl, eller tilbake. Den nye tilstanden følger av aktiviteten du klikket på, og gjelder for hele omfanget: hvis den er en aktivitet, blir alle aktiviteter i omfanget milepæler. En hovedaktivitet og en aktivitet med tilordninger blir ikke en milepæl; resten av omfanget blir det, og du får én melding per årsak.

**Tildel kalender ▸** — en undermeny med *Prosjektkalender* (aktiviteten har da ingen egen kalender) og under den de tilgjengelige kalenderne. Det gjeldende valget har et hakemerke. En aktivitet som allerede bruker den kalenderen, telles ikke og gir ikke et ekstra trinn i *Angre*. Se [Lage og tildele en kalender](docs://howto-kalender-maken-en-toewijzen).

**Fremdrift ▸** — en undermeny med 0%, 25%, 50%, 75% og 100%. Det gjeldende valget har et hakemerke. En hovedaktivitet har ingen egen fremdrift: finnes det en i omfanget, får aktivitetene som ikke har delaktiviteter, prosenten. Uten statusdato setter appen den til i dag, med en melding. En aktivitet som er planlagt å starte først etter statusdatoen og som ikke har noen faktisk start ennå, fører først til et spørsmål om den faktiske starten; avbryter du, endres ingenting. Se [Oppdatere fremdrift](docs://howto-voortgang-bijwerken).

**Prioritet ▸** — en undermeny med *Lav* (100), *Normal* (500) og *Høy* (900), utjevningsprioriteten for aktiviteten. Det gjeldende valget har et hakemerke. Se [Utjevning av ressurser](docs://uitleg-nivelleren).

**Spor bane** — viser forgjengerne og etterfølgerne til denne aktiviteten. Er sporingen allerede på, heter punktet *Stopp sporing av styrende avhengigheter*. Se [Banesporing](docs://howto-pad-traceren).

**Skjul**, **Utvid** og **Lagre gren som mal** — bare for en hovedaktivitet. *Skjul* og *Utvid* er alltid begge der, også hvis aktiviteten allerede er skjult eller utvidet, og de gjelder for hele omfanget. *Lagre gren som mal* lagrer aktiviteten med delaktivitetene og avhengighetene mellom dem som en WBS-mal. Se [Lagre og sette inn WBS-maler](docs://howto-wbs-sjablonen).

**Slett** — sletter aktivitetene i omfanget, med delaktivitetene deres. Det kommer ingen bekreftelse; du får dem tilbake med Ctrl+Z, ett trinn for hele omfanget. Se [Velge, slette og angre aktiviteter](docs://howto-taken-selecteren-verwijderen).

## Menyen for en gruppeoverskrift

Denne menyen finnes bare i aktivitetstabellen, på en gruppeoverskrift:

**Skjul gruppe** eller **Utvid gruppe** — skjuler eller utvider bare denne gruppen. Punktet viser hva du kan gjøre.

**Utvid alle** og **Skjul alle** — utvider eller skjuler alle grupper samtidig.

Du setter opp gruppering med et oppsett, se [Lage og bruke et oppsett](docs://howto-layouts-gebruiken).

## Se også

- [Dra, panorere og zoome i Gantt](docs://howto-gantt-bedienen): hva dra med venstre og midtre museknapp gjør.
- [Båndet, fane for fane](docs://ref-lint): knappene som har de samme handlingene.
- [Hurtigtaster](docs://ref-sneltoetsen): tastene som hører til dem.
