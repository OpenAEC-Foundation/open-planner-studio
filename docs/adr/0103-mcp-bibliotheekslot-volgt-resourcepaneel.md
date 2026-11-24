# Het bibliotheekslot van de bridge volgt het resourcepaneel

Een resource uit een resourcebibliotheek draagt een herkomststempel. De bibliotheek bepaalt dan wat de resource is
(`RESOURCE_DIFF_FIELDS`: naam, type, omschrijving, uurtarief, meeteenheid), het project bepaalt hoeveel en wanneer
(`maxUnits`, `availabilitySteps`, `calendarId`). Het resourcepaneel toont de bibliotheekvelden op zo'n rij als platte
tekst. `planner_manage_resources` weigert dezelfde velden. Anders schrijft de bridge wat de planner zelf niet kan
schrijven, en volgt bij de volgende verversing een afwijkingsvraag die de bewerking kan terugdraaien. De weigering
noemt de twee echte routes: wijzigen in de bibliotheek (Backstage, Bibliotheek), wat voor elk project met die resource
geldt en daarom niet via de bridge wordt aangeboden, of de resource eerst losmaken van de bibliotheek.

## Gevolgen

- Of er een bibliotheekherkomst geldt, beslissen paneel en bridge met dezelfde functies: `onOpenStatusForResource`
  met `isResourceFieldLocked`. Welke velden op slot zitten, beslist de bridge met `RESOURCE_DIFF_FIELDS`; het paneel
  kiest per cel in `ResourcePanel.tsx` of die cel het slot volgt. Verhuist een veld van bibliotheek naar projectinzet,
  dan beweegt de bridge mee met `RESOURCE_DIFF_FIELDS`, maar de cel in het paneel moet apart worden aangepast.
- Raakt een update één veld dat op slot zit, dan wordt het hele item geweigerd, ook de velden die wel mochten. Half
  toepassen zou een stille gedeeltelijke uitvoering zijn.
- Buiten het slot blijven, net als in het paneel: een stempel van een ander bedrijf dan dat van het project, een item
  dat niet meer in de bibliotheek staat (`removed`), en verwijderen (in het paneel ook een gewone rijactie).
- Losmaken kan de bridge alleen noemen, niet uitvoeren (`docs/TODO.md`).
