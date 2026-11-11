# Wat nog weigert na echte voortgangsinvoer

Zeven bewerkingen die in de begintelling schreven, weigeren nu: één echte voortgangsinvoer op een oude eigen bron en zes gevallen van taak wissen. De zes kalenders blijven bij gewone opslag zonder model volledig behouden; alleen de lijstvolgorde wijzigt. Geen daarvan is gerepareerd of genormaliseerd.

Van de veertig eerdere kale voortgangsgevallen schrijven er 39 weer. Het oude b5-geval schrijft via de echte invoer nu ook; dat is een verbetering tegenover de begintelling. Netto: 2562/701/0 → 2556/707/0.

| Nr. | Bestand | Bewerking | Eerste verschil |
|---:|---|---|---|
| 1 | fixtures/ifc-arity-oude-writer.ifc + wand | task-mula7vhu11iq28 voortgang 50 % via invoer | IFCPROPERTYSINGLEVALUE #412 (UnchangedSinceImport): ontbreekt in de uitvoer na de bewerking ('UnchangedSinceImport') |
| 2 | h7-tijden-oude-writer.ifc + wand | task-muid03m2d3yp6 wissen | planning.resourceCalendars.0.id: "rescal-ifc-$FxXapUfGJILc3THOjNhMt" → "rescal-ifc-JRRH7LiFsfpdy9yHzDERfz" |
| 3 | h7-tijden-oude-writer.ifc + wand | task-muid03mez0ja8 wissen | planning.resourceCalendars.1.id: "rescal-ifc-JRRH7LiFsfpdy9yHzDERfz" → "rescal-ifc-N7aLzPZHzF4hoVxFoDMTR1" |
| 4 | h7-tijden-oude-writer.ifc + wand | task-muid03mqme6o10 wissen | planning.resourceCalendars.2.id: "rescal-ifc-N7aLzPZHzF4hoVxFoDMTR1" → "rescal-ifc-S19xwPcXFFKzr7AH0darqF" |
| 5 | fixtures/urenperdag-oude-writer.ifc + wand | t-nacht wissen | planning.resourceCalendars.1.id: "rescal-ifc-0TQXQ79vaRIKOrwTlRR7eF" → "rescal-ifc-3WTqntjNdr5U$5qjw6xO7k" |
| 6 | fixtures/urenperdag-oude-writer.ifc + wand | t-spanne wissen | planning.resourceCalendars.3.id: "rescal-ifc-0kGmvTM7NkCsMqxBqlbxhA" → "rescal-ifc-0RziPdFTfq46dL4sXPp8Es" |
| 7 | fixtures/urenperdag-oude-writer.ifc + wand | t-maandag wissen | planning.resourceCalendars.5.id: "rescal-ifc-2tjB_83sHJE7lTWFBaLSjr" → "rescal-ifc-23WHkNns$nje3jcCxSzxkG" |

De voortgangsinvoer wist de vlag `importPristine` zoals de app. Daardoor vervallen `UnchangedSinceImport`, de pset `OPS_ImportProvenance` en de koppeling ernaartoe. De bestaande verliesbewaking weigert dit als `niet-gedragen`; er worden geen bytes teruggegeven. De precieze gevallen staan in `onderzoek-voortgang.json`. Alleen gemeld, niet gerepareerd.
