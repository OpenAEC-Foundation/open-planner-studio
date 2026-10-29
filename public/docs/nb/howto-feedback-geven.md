# Gi tilbakemelding

Mål: melde fra om en feil eller komme med en idé, eventuelt med et skjermbilde, direkte fra appen.

## Når du trenger dette

Tidsplanen beregner noe du ikke forstår, en knapp gjør ikke det den skal, eller du ser noe som mangler i appen. En god rapport hjelper utviklerne med å finne problemet. Derfor legger appen selv til versjonen, operativsystemet og språket i rapporten. Det du selv beskriver, avgjør om de kan gjøre noe med den: hva du gjorde, hva du forventet og hva som skjedde.

## Trinn

1. Klikk på knappen *Gi tilbakemelding* øverst i vinduet. Knappen står alltid i titellinjen. Teksten på knappen skifter hvert tiende minutt: *Gi tilbakemelding*, *Meld en feil* eller *Legg til en ny funksjon*. Det er alltid den samme knappen. Vinduet *Gi tilbakemelding* åpnes.
2. Velg typen melding. *Noe fungerer ikke* er for en feil: noe gjør ikke det det skal. *Idé* er for noe du savner, eller noe du vil ha annerledes. *Spørsmål eller kommentar* er for resten. *Noe fungerer ikke* er valgt som standard.
3. Fyll inn *Tittel* og deretter *Beskrivelse*. De tomme feltene viser et eksempel: en tittel som *F.eks. Kritisk linje hopper etter lagring*, og for beskrivelsen spørsmålet *Hva gjorde du, hva forventet du, og hva skjedde?* Så lenge knappen *Send* er grå, forklarer en grå linje ved siden av hvorfor. For eksempel *Skriv inn en tittel.* Eller at du skriver minst 10 tegn til sammen i tittel og beskrivelse.
4. Vil du ha svar, fyll inn e-postadressen din i feltet *E-postadresse*. Feltet er valgfritt. Appen husker adressen etter at meldingen er sendt, så den står der neste gang.
5. Vil du vise noe, slå på *Legg ved skjermbilde*. Appen lager da et bilde av appen uten dette vinduet. Et øyeblikk senere ser du en liten forhåndsvisning med tre knapper ved siden av: *Kommenter*, *Ta på nytt* og *Fjern*.
6. *Kommenter* åpner et redigeringsvindu. I det legger du piler, rektangler, frihåndstegninger og tekst på bildet. Med *Dekk til* tegner du et svart område over noe som ikke skal være med, for eksempel et navn eller et beløp. Den delen er da helt borte fra bildet som appen sender. Du velger farge, angrer den siste handlingen med *Angre*, eller begynner på nytt med *Slett alt*. Klikk på *Ferdig* for å beholde endringene, eller på *Avbryt* (eller Esc) for å kaste dem.
7. *Ta på nytt* lager et nytt skjermbilde og tømmer kommentarene dine. *Fjern* fjerner skjermbildet og skrur av avkrysningsboksen.
8. Se på den grå linjen under skjemaet. Den viser hva appen selv sender med: versjonen, operativsystemet og språket. For eksempel *Sendt med: v2026.10.1 · Windows · English*.
9. Klikk på *Send*. Mens meldingen sendes, står det *Sender…* på knappen.
10. Du ser *Takk, meldingen din er sendt.* Hvis det er laget en issue på GitHub for meldingen din, finnes også knappen *Se på GitHub*. Klikk på *Lukk*.

## Hvor meldingen din går

Appen sender meldingen din til Open Feedback Studio fra OpenAEC. Du trenger ingen konto for det, heller ikke på GitHub. Utviklerne ser meldingen din i oversikten sin. Er appen knyttet til GitHub der, gjør Open Feedback Studio også meldingen til en offentlig issue på GitHub. Med *Noe fungerer ikke* får issuen etiketten *bug*, og med *Idé* får den etiketten *enhancement*. Under beskrivelsen din står det da en linje med versjonen av Open Planner Studio, operativsystemet ditt og språket i appen.

## Fallgruver og hva appen gjør da

**Meldingen din kan bli offentlig.** Ikke skriv noe du ikke vil dele. Det gjelder også skjermbildet: bildet viser alt som er synlig i appen på det tidspunktet, for eksempel aktivitetsnavn og ressurser i prosjektet ditt. Appen tar skjermbildet i det øyeblikket du slår på *Legg ved skjermbilde*. Er skjermen ikke riktig ennå, lukk vinduet, still inn skjermen riktig, åpne vinduet igjen og klikk på *Ta på nytt*. Bruk *Dekk til* for å skjule det du ikke vil vise.

**Skjermbildet er for stort.** Appen gjør skjermbildet mindre før det sendes. Er det fortsatt for stort, sendes meldingen din uten bilde. Takkeskjermen sier da *Skjermbildet var for stort og ble ikke sendt med.*

**Sending fungerer ikke.** En melding vises i vinduet, og teksten din blir stående. Det er fire tilfeller:

- *Meldingen ble ikke godtatt.* Kontroller teksten og e-postadressen. En melding som stort sett består av lenker, blir avvist.
- *Du har sendt mange meldinger på kort tid.* Prøv igjen om en time.
- *Sending mislyktes.* Det er ingen forbindelse, eller serveren svarer ikke. Prøv igjen, eller klikk på *Åpne på GitHub*. Den knappen vises ikke hvis et tidligere forsøk var usikkert (se under).
- *Vi er ikke sikre på om meldingen din er kommet frem. Vent et minutt og send den på nytt. Hvis den allerede er der, ser vi det av seg selv.* Forbindelsen brøt av etter at appen hadde sendt meldingen din. Teksten din blir stående. Det finnes ingen knapp *Åpne på GitHub*, fordi meldingen din fortsatt kan komme inn. Slik er det til meldingen din er sendt eller allerede mottatt, også hvis du lukker vinduet i mellomtiden og åpner det igjen.

**Meldingen din er allerede mottatt.** Sender du en melding som allerede finnes hos oss, blir skjemaet stående med denne teksten over seg: *Denne meldingen er allerede hos oss. Vil du legge til noe? Endre da teksten og send den på nytt.* Teksten din blir stående, og e-postadressen din huskes. Klikk på *Lukk* hvis du ikke vil legge til noe. Skjemaet er da tomt neste gang. Skriver du noe mer, forsvinner meldingen, og du kan sende på nytt. Knappen heter da igjen *Lagre og lukk*, og teksten din blir bevart.

**Åpne på GitHub.** Dette er veien uten Open Feedback Studio. Til dette trenger du en konto på GitHub. Uten skjermbilde åpnes GitHub-siden der du lager en ny issue, med en gang i nettleseren din. Tittel og beskrivelse er da allerede fylt inn. Med skjermbilde ser du først *Nesten ferdig — skjermbildet ditt ligger på utklippstavlen.* med fire trinn. Klikk på *OK, gå til GitHub*, klikk inne i det store tekstfeltet på issuesiden, og trykk på Ctrl+V (Cmd+V på en Mac). Klikk deretter på *Send inn ny issue* nederst. Først da er meldingen din sendt.

**Liming fungerer ikke.** På GitHub-veien lagres skjermbildet også som en fil på datamaskinen din. I desktopappen viser vinduet stien: *Kan ikke lime inn? Vi har også lagret skjermbildet til* stien *— dra filen inn i tekstfeltet.* I nettleseren laster appen ned bildet som `feedback-` med et nummer og endelsen `.png`. Du finner det i nedlastingsmappen din, og du drar det inn i tekstfeltet.

**Skjermbildet feiler.** Da står det *Kunne ikke lage skjermbilde. Du kan fortsatt sende tilbakemeldingen uten skjermbilde.* Avkrysningsboksen skrur seg av, og du kan sende meldingen din uten bilde.

**Du lukker vinduet før du sender.** Er det noe i skjemaet, heter knappen nederst *Lagre og lukk*. Er skjemaet tomt, heter den *Lukk*. *Lagre og lukk*, krysset og Esc lukker vinduet. Meldingen din blir da lagret som utkast, til du sender den eller klikker på *Tøm*. Når du åpner vinduet igjen, er typen, teksten din, e-postadressen og skjermbildet med kommentarene fortsatt der. Utkastet blir bevart så lenge appen er åpen. Etter at du har avsluttet appen, er det borte. Etter en vellykket melding er skjemaet tomt igjen. Vil du begynne på nytt selv, klikk på *Tøm* nederst til venstre. Et klikk ved siden av vinduet lukker det ikke. Mens meldingen sendes, lukker Esc ikke vinduet.

## Se også

- [Oppdatere appen](docs://howto-app-bijwerken): før du sender en rapport, kontroller om du har den nyeste versjonen.
