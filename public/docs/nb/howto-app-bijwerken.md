# Oppdatere appen

Mål: vite om du har den nyeste versjonen, oppdatere appen og lese hva som er nytt i en versjon.

## Når du trenger dette

En ny versjon av Open Planner Studio kommer med jevne mellomrom. Du vil vite om du allerede har den, for eksempel før du melder en feil, eller fordi en utvidelse ber om en nyere versjon. Eller du har nettopp oppdatert og vil se hva som er endret.

Oppdatering fungerer bare i skrivebordsappen. Nettleserversjonen har ingen oppdateringsfunksjon.

## Fremgangsmåte

### Oppdater når appen selv sier at det finnes en ny versjon

1. Start skrivebordsappen. Ved oppstart sjekker appen i bakgrunnen om det finnes en ny versjon. Finnes det ingen ny versjon, eller mislykkes sjekken, for eksempel uten internett, merker du ingenting.
2. Finnes det en ny versjon, åpnes vinduet *Programvareoppdatering*. Det viser *Gjeldende versjon*, *Ny versjon*, meldingen *Det finnes en ny versjon* og, under *Hva er nytt*, teksten som hører til oppdateringen.
3. Lagre de åpne prosjektene dine.
4. Klikk på *Last ned og installer*. En fremdriftslinje viser *Laster ned…*, og deretter følger installasjonen. Du kan ikke lukke vinduet mens det lastes ned.
5. Vent til appen starter seg selv på nytt. Da har du den nye versjonen.

Rett før oppdateringen installeres, lager appen også en automatisk sikkerhetskopi av det åpne innholdet ditt, for gjenoppretting ved brudd. Se [Gjenoppretting ved brudd](docs://howto-herstellen-na-een-crash).

### Sjekk selv om det finnes en ny versjon

1. Velg *Innstillinger › Prosjekt › Appinnstillinger*. Du kan også velge *Fil › Appinnstillinger*, eller tannhjulet øverst.
2. Velg fanen *Avansert*. Under *Versjon* står nummeret på den gjeldende versjonen din.
3. Klikk på *Se etter oppdateringer*. Vinduet *Programvareoppdatering* åpnes og viser *Sjekker…*. Etterpå viser det enten *Du bruker den nyeste versjonen*, eller meldingen om at det finnes en ny versjon, med samme knapp *Last ned og installer*.

I nettleseren gjør denne knappen ingenting spesielt: vinduet viser straks *Du bruker den nyeste versjonen*, uten at appen sjekker noe.

### Les hva som er nytt

1. Starter du skrivebordsappen for første gang i en annen versjon enn sist, åpnes et vindu av seg selv. Vinduet heter *Du er oppdatert!* Etter en ny installasjon åpnes det ikke: første oppstart er ikke en oppdatering. Vil du likevel se det, bruk knappen *Hva er nytt* (se nedenfor).
2. Øverst vises hoppet fra forrige versjon til den nye versjonen. Med knappen *Hva er nytt* vises bare den nye versjonen.
3. Har appen en oppsummering innebygd for denne versjonen, ser du ett hovedpunkt og fire mindre punkter. Hovedpunktet kan ha en knapp *Les veiledningen*. Ellers ser du bare hoppet mellom versjonene og det som står under.
4. Med *Se alle utgivelsesnotatene* åpner du endringsloggen på GitHub. Fungerer ikke det, står det *Utgivelsesnotatene kunne ikke åpnes.*
5. Under *Denne oppdateringen i tall* står antall dager siden forrige utgivelse, antall commits og antall lagt til kodelinjer. Kan appen finne størrelsesforskjellen på installasjonspakken, vises den også. Hvert tall vises bare hvis det er tilgjengelig.
6. Klikk på *Forstått* for å lukke vinduet.

Vil du se dette vinduet én gang til senere, velg *Innstillinger › Prosjekt › Appinnstillinger*, fanen *Avansert*, og under *Versjon* knappen *Hva er nytt*. Vinduet åpnes da for den gjeldende versjonen din, uten en forrige versjon.

## Feil og hva appen gjør da

**Oppdateringen mislykkes.** Vinduet viser *Noe gikk galt under oppdateringen* med den tekniske årsaken under, og knappen *Prøv igjen*.

**Du installerte appen som en .deb-pakke, og installasjonen mislykkes.** Vinduet forklarer: *Oppdater manuelt ved å kjøre denne kommandoen i en terminal, eller last ned den nyeste pakken.* Under *Installasjonskommando* står kommandoen, med knappen *Kopier kommando* (etterpå står det *Kopiert*). Med *Åpne nedlastingssiden* går du til nedlastingssiden for den nyeste versjonen.

**Du har appen via Snap Store.** Appen oppdaterer seg da ikke selv, og den sjekker heller ikke ved oppstart. Snap Store gjør det. I vinduet står det *Denne versjonen oppdateres automatisk via Snap Store — du trenger ikke å gjøre noe.*

**Det vises ingenting ved oppstart.** Det er normalt hvis du allerede har den nyeste versjonen. Sjekken ved oppstart melder ikke feil. Vil du være sikker på at du er oppdatert, sjekk selv, som beskrevet ovenfor.

## Se også

- [Gi tilbakemelding](docs://howto-feedback-geven): meld en feil i den nyeste versjonen.
