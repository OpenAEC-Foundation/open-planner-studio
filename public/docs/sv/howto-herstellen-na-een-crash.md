# Återställa efter en krasch

Mål: få tillbaka det du har gjort efter att appen eller webbläsaren stannade oväntat och du inte hade sparat.

## När du behöver det här

Den bärbara datorn kraschade, appen frös eller webbläsarfliken kraschade, och du hade ännu inte sparat de senaste ändringarna. Så snart något ändras någonstans sparar appen i bakgrunden kopior av alla öppna projekt. Det sker högst en gång var tionde sekund. Kopian är skild från projektfilen. Skillnaden mellan att spara och automatisk sparning beskrivs i [Filer och format](docs://uitleg-bestanden).

## Steg

1. Starta appen igen. I webbläsaren laddar du om samma flik: återställningskopian hör till just den fliken.
2. Om appen hittade kopior visas fönstret *Återställ osparat arbete*: *Open Planner Studio stängdes inte av på rätt sätt. Följande dokument hade osparade ändringar som kan återställas*: För varje projekt visar fönstret namnet, sökvägen till filen om projektet har en fil (i webbläsaren bara filnamnet), antalet uppgifter och tidpunkten för kopian. Till exempel *21 uppgifter* och *Sparad: sep 29, 2026, 9:41 AM*. Fönstret kan också visa projekt som du inte har ändrat.
3. Välj *Återställ*. Appen öppnar alla projekt i listan, var och ett i en flik, med tillståndet från den senaste kopian. Enter gör samma sak.
4. Kontrollera dina projekt och spara dem direkt med Ctrl+S.

Vill du inte återställa har du två val. *Återställ inte* tar bort kopiorna, och det kan du inte ångra. Stänger du fönstret med Esc, med krysset eller genom att klicka bredvid det, finns kopiorna kvar. Appen frågar igen vid nästa start.

Frågetecknet uppe till höger i fönstret öppnar den här artikeln utan att du gör något val. Medan du läser i Hjälp väntar fönstret. När du går tillbaka finns det där igen, och du kan fortfarande återställa.

## Fallgropar och vad appen gör då

**Du får tillståndet från den senaste kopian.** Det du gjorde de sista sekunderna före kraschen kan saknas. Ett projekt som hade ändringar markeras igen som *Ej sparad*. Historiken för *Ångra* är tom: du kan inte ångra steg från före kraschen. Zoomnivå, rullningsposition och markering återskapas.

**På skrivbordet behåller ett återställt projekt sin fil, i webbläsaren gör det inte.** På skrivbordet skriver *Spara* till den ursprungliga filen, med det återställda tillståndet. I webbläsaren är ett återställt projekt inte längre kopplat till sin fil. *Spara* frågar då var filen ska sparas. Brytaren *Automatisk sparning* är också grå tills du har sparat projektet en gång.

**Ett projekt i vyn *Datum som registrerats* stannar kvar i den vyn.** Se [Datum som registrerats](docs://uitleg-datums-zoals-opgeslagen).

**På skrivbordet visas fönstret inte vid varje start.** Återställningskopiorna ligger i appens datamapp, som IFC-filer vars namn börjar med *recovery*. Stänger du appen på vanligt sätt tar den bort sina egna kopior. Fönstret visas därför efter ett oväntat avslut, efter en omstart för en appuppdatering eller om du sköt upp återställningen vid en tidigare start.

**I webbläsaren sparas kopian per flik.** Kopian ligger i webbläsarens lagring. En ny flik eller ett nytt fönster erbjuder inte kopiorna från en annan flik. Kopior från flikar som inte längre finns rensas efter sju dagar, så snart appen skriver kopior igen.

**I webbläsaren visas fönstret också efter en vanlig omladdning.** Det sker även om du hade sparat allt. Om du sparade precis före omladdningen och inte ändrade något efter det kan du välja *Återställ inte* utan risk. Din fil är uppdaterad.

**Fönstret visas inte.** Då hittade appen ingen kopia. Det sker om du ännu inte har ändrat något, om du använder en ny flik i webbläsaren, om du tidigare tog bort återställningen med *Återställ inte*, eller om kraschen kom innan appen sparade den första kopian. Det kan ta upp till ungefär tio sekunder efter din första ändring.

**En kopia är skadad.** Appen visar *Den återställda filen kunde inte läsas*, med orsaken, och erbjuder de andra projekten. Om du väljer *Återställ* tar appen efteråt bort alla kopior, även den som inte kan läsas. Om ingen kopia alls kan läsas visas fönstret inte, och kopiorna finns kvar.

**Återställningen misslyckas.** Appen visar *Kunde inte återställa* med orsaken. Kopiorna finns kvar och frågan kommer tillbaka vid nästa start.

**Vissa projekt kan inte läsas in.** Appen visar: *2 återställningsfiler kunde inte läsas in och hoppades över.* Vid en enda fil visar den *1 återställningsfil kunde inte läsas in och hoppades över.* De andra projekten återställs. Eftersom något hoppades över finns alla kopior kvar, och fönstret kommer tillbaka vid nästa start med samma lista. Välj då *Återställ inte* om du redan har fått tillbaka allt som gick att återställa.

## Se även

- [Filer och format](docs://uitleg-bestanden): spara, automatisk sparning och kraschskydd sida vid sida.
- [Så här slår du på automatisk sparning](docs://howto-automatisch-opslaan): låter appen uppdatera din fil själv.
- [Öppna och spara en fil](docs://howto-bestand-openen-en-opslaan): spara efter att du har återställt.
- [Datum som registrerats](docs://uitleg-datums-zoals-opgeslagen): vad som händer med ett projekt i den vyn.
