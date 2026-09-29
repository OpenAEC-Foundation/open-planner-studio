# De app bijwerken

Doel: weten of je de nieuwste versie hebt, de app bijwerken en lezen wat er in een versie nieuw is.

## Wanneer je dit nodig hebt

Er komt regelmatig een nieuwe versie van Open Planner Studio uit. Je wilt weten of je die al hebt, bijvoorbeeld voordat je een fout meldt of omdat een extensie een nieuwere versie vraagt. Of je bent net bijgewerkt en wilt zien wat er veranderd is.

Bijwerken werkt alleen in de desktop-app. De browserversie kent geen updater.

## Stappen

### Bijwerken als de app zelf meldt dat er een nieuwe versie is

1. Start de desktop-app. Bij het opstarten controleert de app op de achtergrond of er een nieuwe versie is. Is er geen nieuwe versie, of lukt de controle niet, bijvoorbeeld zonder internet, dan merk je niets.
2. Is er wel een nieuwe versie, dan opent het venster *Software-update*. Dat toont de *Huidige versie*, de *Nieuwe versie*, de melding *Er is een nieuwe versie beschikbaar* en onder *Wat is er nieuw* de tekst die bij de update hoort.
3. Sla je open projecten op.
4. Klik op *Downloaden & installeren*. Een voortgangsbalk laat *Bezig met downloaden…* zien, en daarna volgt de installatie. Tijdens het downloaden kun je het venster niet sluiten.
5. Wacht tot de app zichzelf herstart. Dat is de nieuwe versie.

Vlak voordat de update wordt geïnstalleerd, legt de app nog een herstelmomentopname van je open werk vast.

### Zelf controleren op een nieuwe versie

1. Kies *Instellingen › Project › Instellingen*. Je kunt ook *Bestand › Instellingen* kiezen, of het tandwiel bovenaan.
2. Kies het tabblad *Geavanceerd*. Bij *Versie* staat het nummer van je huidige versie.
3. Klik op *Controleren op updates*. Het venster *Software-update* opent en meldt *Bezig met controleren…*. Daarna staat er *Je gebruikt de nieuwste versie* of de melding dat er een nieuwe versie is, met dezelfde knop *Downloaden & installeren*.

In de browser doet deze knop niets bijzonders: het venster meldt meteen *Je gebruikt de nieuwste versie*, zonder dat de app iets controleert.

### Lezen wat er nieuw is

1. Start je de desktop-app voor het eerst in een andere versie dan de vorige keer, of na een verse installatie, dan opent vanzelf een venster. Het heet *Je bent bijgewerkt!*
2. Bovenaan staat de sprong van de vorige naar de nieuwe versie. Na een verse installatie staat er alleen de nieuwe versie.
3. Heeft de app voor deze versie een samenvatting ingebouwd, dan zie je één hoofdpunt en vier kleinere punten. Bij het hoofdpunt kan een knop *Lees de gids* staan. Anders zie je alleen de versiesprong en wat hieronder staat.
4. Met *Volledige release notes* open je de changelog op GitHub. Slaagt dat niet, dan staat er *De release notes konden niet worden geopend.*
5. Onder *Deze update in cijfers* staan het aantal dagen sinds de vorige release, het aantal commits en het aantal toegevoegde regels code. Kan de app het verschil in grootte van het installatiepakket opzoeken, dan staat dat er ook. Elk cijfer staat er alleen als het beschikbaar is.
6. Klik op *Begrepen* om het venster te sluiten.

Wil je dit venster later nog een keer zien, dan kies je *Instellingen › Project › Instellingen*, tabblad *Geavanceerd*, bij *Versie* de knop *Wat is er nieuw*. Het venster opent dan voor je huidige versie, zonder vorige versie.

## Valkuilen en wat de app dan doet

**Het bijwerken mislukt.** Het venster toont *Er ging iets mis bij het bijwerken* met de technische reden eronder, en de knop *Opnieuw proberen*.

**Je hebt de app als .deb-pakket geïnstalleerd en de installatie lukt niet.** Het venster legt uit: *Werk handmatig bij door dit commando in een terminal uit te voeren, of download het nieuwste pakket.* Onder *Installatiecommando* staat het commando, met de knop *Commando kopiëren* (daarna staat er *Gekopieerd*). Met *Open downloadpagina* ga je naar de downloadpagina van de nieuwste versie.

**Je hebt de app via de Snap Store.** De app werkt zichzelf dan niet bij en controleert bij het opstarten ook niet. De Snap Store doet dat. In het venster staat *Deze versie wordt automatisch via de Snap Store bijgewerkt — je hoeft niets te doen.*

**Er komt niets bij het opstarten.** Dat is normaal als je al de nieuwste versie hebt. De opstartcontrole meldt geen fouten. Wil je zeker weten of je actueel bent, dan controleer je zelf, zoals hierboven.

## Zie ook

- [Feedback geven](docs://howto-feedback-geven): meld een fout in de nieuwste versie.
