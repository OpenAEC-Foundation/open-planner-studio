# Automatisch opslaan aanzetten

Doel: je projectbestand door de app laten bijwerken terwijl je werkt, zodat je niet steeds op Ctrl+S hoeft te drukken.

## Wanneer je dit nodig hebt

Je werkt een lange sessie aan één planning, of je vergeet steeds op te slaan, en je wilt dat het bestand op schijf of in een gedeelde map bij blijft. Automatisch opslaan vervangt geen crashherstel: dat staat altijd aan en werkt los hiervan. Wat het verschil is, lees je in [Bestanden en formaten](docs://uitleg-bestanden).

## Stappen

1. Heeft het project nog geen bestand, sla het dan eerst één keer op met *Start › Bestand › Opslaan als*. Zolang er geen bestand is, is de schakelaar grijs en staat er bij de muisaanwijzer: *Sla dit project eerst op om automatisch opslaan te gebruiken.*
2. Klik linksboven in de balk bovenaan op de schakelaar *Automatisch opslaan*. Staat hij aan, dan zegt de aanwijzer: *Automatisch opslaan staat aan: wijzigingen worden naar dit bestand geschreven.*
3. Werk verder. Zodra je project wijzigingen heeft, schrijft de app het naar je bestand, zonder venster en hoogstens eens per tien seconden. De markering *Niet opgeslagen* verdwijnt dan vanzelf.
4. Wil je stoppen, klik dan nog een keer op de schakelaar. De aanwijzer zegt dan: *Automatisch opslaan staat uit. Crashherstel blijft altijd actief.*

Chrome en Edge laten een bestand dat je opende eerst alleen lezen. De schakelaar doet daar niets, tot je één keer met *Opslaan* (Ctrl+S) hebt opgeslagen en de browser toestemming gaf om te schrijven. Daarna kun je hem aanzetten. In Firefox blijft de schakelaar grijs: de app kan daar niet in je bestand schrijven.

## Wat de app doet

De schakelaar hoort bij één project. Elk tabblad heeft zijn eigen stand. Hij staat na het openen van een project altijd uit en de app onthoudt hem niet tot een volgende keer.

Automatisch opslaan schrijft alleen naar het bestand dat het project al heeft. Kies je *Opslaan als*, dan schrijft het vanaf dan naar het nieuwe bestand. De app schrijft alleen als er wijzigingen zijn.

Lukt het schrijven zelf niet, bijvoorbeeld omdat het bestand verdwenen of vergrendeld is, dan verschijnt de melding *Automatisch opslaan mislukt* met de reden erbij. In de browser is dat vaak *Het bestaande projectbestand is niet schrijfbaar.* Heeft de browser de toestemming om te schrijven niet (meer), dan slaat de app die ronde stil over: ze vraagt er niet om.

## Valkuilen en wat de app dan doet

**Het bestand krijgt ook wijzigingen die je liever niet bewaart.** Automatisch opslaan schrijft de stand van je project zoals hij op dat moment is. Draai je iets terug met Ctrl+Z, dan krijgt het bestand binnen tien seconden ook die teruggedraaide stand. Wil je een oudere versie houden, maak dan eerst een kopie met *Opslaan als*.

**Een crash kost nog steeds de laatste seconden.** De app schrijft hoogstens eens per tien seconden, dus wat je in die tussentijd deed, staat nog niet in je bestand. Crashherstel heeft dezelfde grens.

**Na een herstel in de browser is de schakelaar weer grijs.** Een project dat je na een crash in de browser terughaalt, is niet meer aan zijn bestand gekoppeld. Sla het één keer op, dan werkt de schakelaar weer. Zie [Herstellen na een crash](docs://howto-herstellen-na-een-crash).

**Een project uit een ander formaat heeft geen bestand.** Een CSV-, XML-, `.mpp`- of `.xer`-bestand krijgt pas een IFC-bestand als je opslaat. Daarna kun je automatisch opslaan aanzetten.

## Zie ook

- [Bestanden en formaten](docs://uitleg-bestanden): het verschil tussen opslaan, automatisch opslaan en crashherstel.
- [Een bestand openen en opslaan](docs://howto-bestand-openen-en-opslaan): opslaan, opslaan als en de markering *Niet opgeslagen*.
- [Herstellen na een crash](docs://howto-herstellen-na-een-crash): wat de app aanbiedt als ze niet netjes sloot.
