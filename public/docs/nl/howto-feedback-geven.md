# Feedback geven

Doel: een fout melden of een idee doorgeven, eventueel met een schermafbeelding, rechtstreeks vanuit de app.

## Wanneer je dit nodig hebt

De planning rekent iets door dat je niet begrijpt, een knop doet niet wat hij zou moeten doen, of je mist iets in de app. Een goede melding helpt de makers het probleem te vinden. De app zet daarom zelf de versie, het besturingssysteem en de taal in je melding. Wat je zelf beschrijft, bepaalt of ze er wat mee kunnen: wat je deed, wat je verwachtte en wat er gebeurde.

## Stappen

1. Klik bovenin het venster op de knop *Feedback geven*. Die knop staat altijd in de titelbalk. Hij wisselt elke tien minuten van tekst: *Feedback geven*, *Meld een bug* en *Voeg een nieuwe feature toe*. Het is steeds dezelfde knop. Het venster *Feedback geven* opent.
2. Kies de soort melding. *Iets werkt niet* is voor een fout: iets doet niet wat het hoort te doen. *Idee* is voor iets wat je mist of anders wilt. *Vraag of opmerking* is voor de rest. *Iets werkt niet* staat standaard aan.
3. Vul de *Titel* in en daarna de *Omschrijving*. De lege velden tonen een voorbeeld: een titel als *Bijv. Kritiek pad verspringt na opslaan*, en voor de omschrijving de vraag *Wat deed je, wat verwachtte je en wat gebeurde er?* Zolang de knop *Versturen* grijs is, staat er een grijze regel bij die zegt waarom, bijvoorbeeld *Vul een titel in.* of dat je in titel en omschrijving samen minstens 10 tekens schrijft.
4. Wil je een reactie, vul dan je *E-mailadres* in. Dat veld is optioneel. De app onthoudt het adres na een geslaagde melding, zodat het er de volgende keer al staat.
5. Wil je iets laten zien, zet dan *Screenshot bijvoegen* aan. De app maakt dan een schermafbeelding van de app zonder dit venster. Even later zie je een klein voorbeeld met drie knoppen ernaast: *Annoteren*, *Opnieuw maken* en *Weghalen*.
6. *Annoteren* opent een editor. Daarin zet je pijlen, rechthoeken, vrije lijnen en tekst op de afbeelding. Met *Afdekken* trek je een zwart vlak over iets wat niet mee mag, zoals een naam of een bedrag. Dat deel is daarna echt weg uit de afbeelding die de app verstuurt. Je kiest de kleur, draait je laatste handeling terug met *Ongedaan maken* of begint opnieuw met *Alles wissen*. Klik op *Klaar* om je wijzigingen te bewaren, of op *Annuleren* (of Esc) om ze weg te gooien.
7. *Opnieuw maken* maakt een nieuw screenshot en wist je annotaties. *Weghalen* haalt het screenshot weg en zet het vinkje uit.
8. Kijk onder het formulier naar de grijze regel *Meegestuurd*. Die toont wat de app zelf meestuurt: de versie, het besturingssysteem en de taal, bijvoorbeeld *Meegestuurd: v2026.10.1 · Windows · Nederlands*.
9. Klik op *Versturen*. Tijdens het versturen staat er *Bezig met versturen…* op de knop.
10. Je ziet *Bedankt, je melding is verstuurd.* Is er voor je melding een issue op GitHub gemaakt, dan staat er ook de knop *Bekijk op GitHub*. Klik op *Sluiten*.

## Waar je melding heen gaat

De app verstuurt je melding naar Open Feedback Studio van OpenAEC. Je hebt daar geen account voor nodig, ook niet op GitHub. De makers zien je melding in hun overzicht. Is de app daar aan GitHub gekoppeld, dan maakt Open Feedback Studio er ook een openbaar issue op GitHub van. Bij *Iets werkt niet* krijgt het issue het label *bug*, bij *Idee* het label *enhancement*. Onder je omschrijving staat dan een regel met de versie van Open Planner Studio, je besturingssysteem en de taal van de app.

## Valkuilen en wat de app dan doet

**Je melding kan openbaar worden.** Zet er niets in wat je niet wilt delen. Dat geldt ook voor het screenshot: de afbeelding toont alles wat op dat moment in de app zichtbaar is, zoals taaknamen en resources van je project. De app maakt het screenshot op het moment dat je *Screenshot bijvoegen* aanzet. Staat het scherm nog niet goed, sluit dan het venster, zet het scherm goed, open het venster weer en klik op *Opnieuw maken*. Dek met *Afdekken* af wat je niet wilt laten zien.

**Het screenshot is te groot.** De app verkleint het screenshot voor het versturen. Blijft het daarna nog te groot, dan gaat je melding zonder afbeelding. Het bedankscherm zegt dan *Het screenshot was te groot en is niet meegestuurd.*

**Versturen lukt niet.** Er staat een melding in het venster en je tekst blijft staan. Er zijn vier gevallen:

- *De melding is niet geaccepteerd.* Controleer de tekst en het e-mailadres. Een melding die vooral uit links bestaat, wordt geweigerd.
- *Je hebt in korte tijd veel meldingen verstuurd.* Probeer het over een uur opnieuw.
- *Versturen is niet gelukt.* Er is geen verbinding of de server antwoordt niet. Probeer het opnieuw, of klik op *Open op GitHub*. Die knop staat er niet als een eerdere poging onzeker was (zie hieronder).
- *We weten niet zeker of je melding is aangekomen. Wacht een minuut en verstuur hem dan opnieuw; als hij er al is, zien we dat vanzelf.* De verbinding viel weg nadat de app je melding had verstuurd. Je tekst blijft staan. Er is geen knop *Open op GitHub*, want je melding kan nog binnenkomen. Dat blijft zo tot je melding verstuurd of al binnen is, ook als je het venster tussendoor sluit en weer opent.

**Je melding is al binnen.** Verstuur je een melding die er al is, dan blijft het formulier staan met erboven: *Deze melding is al bij ons binnen. Wil je iets toevoegen? Pas dan de tekst aan en verstuur opnieuw.* Je tekst blijft staan en je e-mailadres wordt onthouden. Klik op *Sluiten* als je niets wilt toevoegen; het formulier is de volgende keer leeg. Typ je iets bij, dan verdwijnt de melding en kun je opnieuw versturen; de knop heet dan weer *Bewaren en sluiten* en je tekst blijft bewaard.

**Open op GitHub.** Dit is de weg zonder Open Feedback Studio. Hiervoor heb je wel een account op GitHub nodig. Zonder screenshot opent de pagina van GitHub waarop je een nieuw issue maakt meteen in je browser, met je titel en omschrijving al ingevuld. Met screenshot zie je eerst *Bijna klaar — je screenshot staat op het klembord.* met vier stappen. Klik op *OK, ga naar GitHub*, klik op de issuepagina in het grote tekstvak en druk op Ctrl+V (Cmd+V op een Mac). Klik daarna onderaan op *Submit new issue*. Pas dan is je melding verstuurd.

**Plakken lukt niet.** Op de GitHub-weg staat het screenshot ook als bestand op je computer. In de desktop-app noemt het venster het pad: *Lukt plakken niet? We hebben de screenshot ook opgeslagen op* dat pad, *— sleep dat bestand in het tekstvak.* In de browser downloadt de app de afbeelding als `feedback-` met een getal en de extensie `.png`. Je vindt hem in je downloadmap en sleept hem in het tekstvak.

**Het screenshot mislukt.** Er staat *Screenshot maken mislukt. Feedback kan nog steeds zonder screenshot worden verstuurd.* Het vinkje gaat uit en je kunt je melding zonder afbeelding versturen.

**Je sluit het venster voordat je verstuurt.** Staat er iets in het formulier, dan heet de knop onderin *Bewaren en sluiten*; bij een leeg formulier heet hij *Sluiten*. *Bewaren en sluiten*, het kruisje en Esc sluiten het venster, en je melding blijft bewaard als concept tot je verstuurt of op *Leegmaken* klikt. Open je het venster weer, dan staan de soort, je tekst, het e-mailadres en het screenshot met annotaties er nog. Het concept blijft bewaard zolang de app open is; na het afsluiten van de app is het weg. Na een geslaagde melding is het formulier weer leeg. Wil je zelf opnieuw beginnen, klik dan links onderin op *Leegmaken*. Een klik naast het venster sluit het niet. Tijdens het versturen sluit Esc het venster niet.

## Zie ook

- [De app bijwerken](docs://howto-app-bijwerken): controleer voor een melding of je de nieuwste versie hebt.
