# Ingelezen taken: de boom uit de WBS bij tegenspraak, en de opgeslagen restduur blijft

`src/services/importNormalize.ts` maakt de taken van elke lezer gelijkvormig. Twee keuzes daarin zou een collega
zonder uitleg "rechtzetten".

`rebuildImportedHierarchy` (MSPDI en CSV) heeft twee bronnen voor de boom: de outline-niveaus en de gepunte WBS-codes.
De outline wint, want dat bedoelt MS Project en het is het enige dat klopt als de WBS vrije tekst of een eigen masker
is. Behalve als de gepunte codes een volledige boom geven die de outline ergens tegenspreekt: dan wint de WBS. Oudere
exports van OPS zelf schreven het niveau uit het aantal punten van de WBS-code, maar in de volgorde van de store
(eerst de samenvattingen, dan de bladen); de outline hangt de bladen daar onder de laatste samenvatting, terwijl de
codes de boom precies beschrijven. Gebruikers hebben die bestanden nog liggen, en ze moeten blijven lezen zoals ze
altijd lazen. Volgen de WBS-codes de outline, dan geven beide bronnen dezelfde boom.

`normalizeImportedProgress` houdt de restduur die het bestand van een lopende taak vastlegt, ook bij een IFC van een
oudere versie die een dagenrest afgerond schreef. Het bestand zegt niet of een rest ingevoerd of afgeleid was, en een
MPP-rest van 4 dagen bij 33 % ziet er net zo uit als een afgeronde afleiding; de opgeslagen waarde is dan het feit.
Besluit B3 (ADR 0301) staat een verschuiving van oude bestanden toe, maar eist haar niet.
