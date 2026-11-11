# Alle experimentele functies zijn instelbaar

Het instellingenblok is bekeken in licht en donker op poort 3088, met Kantoorgebouw Zuidas geopend.
De gebruikersdienst wijst naar deze werkmap; de opgehaalde bron toont dezelfde activeringsregel.
Alle drie geregistreerde functies hebben een schakelaar. De IFC-schakelaar stond eerst uit en is
met een klik aangezet; zowel het vinkje als de bewaarde keuze stonden daarna aan.

De bestaande browserroute voor de drie instellingen-ingangen is uitgebreid, zonder extra scenario.
Na het aanvinken van de echte IFC-schakelaar zijn twee bronnen met vreemde IFC-inhoud geopend:
bonsai-4d.ifc en eigen-plus-model.ifc. Ctrl+S geeft voor beide de opslagweigering; de bronbestanden
blijven exact gelijk. Daarna is het eigen voorbeeld 03-kantoorgebouw-zuidas.ifc geopend, zonder
taakbewerking. Ctrl+S schrijft dat bestand wel. Er verschijnt geen weigering en de taken blijven gelijk.
Deze route eindigde groen: één scenario, exit 0. De oude Bonsai-bron wordt bij openen al geconverteerd;
de eis dat het document ongewijzigd is geldt alleen voor het eigen planningsbestand.

Gerichte controles met exit 0: typecheck, lint, documentatie, register/defaults/opslag van flags,
IFC-doelcontrole en MCP-bestandsroutes. De nieuwe registerverwachting faalde op de oorspronkelijke
code met vier verschillen en exit 1. De IFC-opslagguard zelf is niet gewijzigd.

Niet lokaal uitgevoerd: volledige testsuites, de corpuscontrole van alle IFC-bestanden, productie-
en desktopbuilds. De overige controles lopen in CI. De server blijft als gebruikersdienst draaien.
