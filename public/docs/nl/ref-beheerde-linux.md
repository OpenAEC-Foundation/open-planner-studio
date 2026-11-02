# Beheerde Linux-sessie

Deze referentie beschrijft Planner in OpenAEC Linux, de Linux-omgeving die de SuperCloud naar je browser streamt. Je werkt daar in de gewone desktop-app. Je beheerder kiest de appversie in het gezamenlijke image.

## Bestanden

Je beheerder stelt met `OPENAEC_MAP` de beginmap voor Openen, Opslaan als en export in. In de SuperCloud is dat doorgaans `/openaec`. Zonder deze variabele blijft de gewone mapkeuze gelden. Een startbestand kan meteen met de app worden geopend. Je kunt daarna de gewone bestandsdialogen gebruiken.

De gebruikersmap of de Linux-data/configmappen moeten tussen sessies bewaard blijven. Daar staan je instellingen en herstelbestanden. Een alleen-lezen programmamap is voldoende; je bestandenmap moet schrijfbaar zijn.

## Updates

Met `OPENAEC_BEHEERD=1` controleert Planner niet op nieuwe versies, toont het geen automatische updatemelding en downloadt het geen update. Deze modus staat standaard uit. Ook de handmatige updatecontrole installeert niets. Je beheerder werkt het gezamenlijke image bij.

## Stoppen en herstel

Bij normaal sluiten blijven de bestaande vragen over niet-opgeslagen wijzigingen gelden.

Stopt de beheerder de beheerde sessie met `SIGTERM`, dan blokkeert Planner verdere invoer en schrijft het de laatste niet-opgeslagen wijzigingen naar de herstelopslag. Bij de volgende start kun je die herstellen. Dit vraagt een bewaarde gebruikersmap en minstens 30 seconden ruimte om af te sluiten. Een geforceerde stop of een volle schijf kan herstel verhinderen.

## AI-koppeling

Je beheerder kan de MCP-koppeling voor de sessie starten met `OPENAEC_MCP_POORT` en `OPENAEC_MCP_GEHEIM`. Het geheim wordt niet als gebruikersvoorkeur bewaard. Poort en Nieuw token zijn dan niet wijzigbaar in het lint; je beheerder past de omgeving aan. De server luistert alleen binnen de gedeelde Linux-netwerkruimte op loopback en accepteert geen browserverzoeken met een `Origin`-kop.

De gewone rechten, pauzeknop, alleen-lezenstand en documentbeveiliging blijven gelden. Zie [Een AI-assistent koppelen](docs://howto-ai-assistent-koppelen).
