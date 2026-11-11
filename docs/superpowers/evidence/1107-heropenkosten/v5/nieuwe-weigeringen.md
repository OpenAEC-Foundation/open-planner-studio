# Bekende weigering en stop vóór de eindtelling

**Geen eindtelling na de main-merge:** de bouw is volgens opdracht gestopt wegens werkelijk precisieverlies na echte
voortgangsinvoer. Zie [het stopbewijs](../../2026-11-11-1107-precisieverlies-stop.md). Daarom is niet vastgesteld dat de
onderstaande weigering de enige overblijvende afwijking tegenover main na #898 is.

De eerder gemeten nieuwe weigering is knownbug 1116, BLOKKEERT vóór 1c, voor de PR van 1109:

| Bestand | Bewerking | Eerste melding |
|---|---|---|
| fixtures/ifc-arity-oude-writer.ifc + wand | task-mula7vhu11iq28 voortgang 50 % via enterTaskProgress | IFCPROPERTYSINGLEVALUE #412 (UnchangedSinceImport): ontbreekt in de uitvoer na de bewerking |

De echte actie wist `importPristine`; ook de pset en koppeling vervallen. De bestaande verliesbewaking weigert getypeerd,
zonder uitvoerbytes. Dit geval is in v4 gemeten en in deze ronde geregistreerd, niet gerepareerd. Bewijs:
`../v4/onderzoek-voortgang.json` en `../v4/nieuwe-weigeringen.json`.

De zes eerdere weigeringen wegens de volgorde van `resourceCalendars` schrijven in de blijvende gerichte proef weer,
ook na main. De kalenderinhoud blijft exact bewaakt. Er is geen nieuwe volledige lijst op basis van een eindtelling.
