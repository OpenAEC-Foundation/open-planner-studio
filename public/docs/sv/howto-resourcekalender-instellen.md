# Ställa in en resurskalender

Mål: registrera vilka dagar en resurs är tillgänglig, så att histogrammet, överbeläggningen och utjämningen räknas med den.

## När du behöver det här

Murararlaget arbetar bara måndag till torsdag. Kranen är på ett annat projekt de första två veckorna i augusti. En underentreprenör har fyra fasta arbetsdagar. Utan en egen kalender antar appen att resursen arbetar på dagarna i projektkalendern.

En resurskalender ändrar inga uppgiftsdatum alls. Den bestämmer bara när resursen är tillgänglig. Om en uppgift arbetar en dag då resursen inte arbetar är kapaciteten den dagen 0, och dagen räknas som överbeläggning. Om du vill att uppgiften själv ska gå på andra dagar ger du uppgiften en egen kalender ([Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen)). Skillnaden beskrivs i [Kalendrar och arbetsdagar](docs://uitleg-kalenders).

## Steg

### Skapa en ny resurskalender

1. Välj *Resurser › Hantera › Resurser*. Resurspanelen öppnas. Om resursen inte finns ännu skapar du den med *Ny resurs i projektet*.
2. Hitta resursens rad. I kolumnen *Kalender* är standardvärdet *Projektkalender*. Resursen följer då projektkalendern.
3. Välj *+ Resurskalender* i listen. Fönstret *Resurskalender* öppnas. Det har samma fält som kalenderformuläret: *Namn*, *Arbetsdagar*, arbetstiderna och *Helgdagar*. Den nya kalendern börjar som en kopia av standardkalendern och heter *Resurskalender*.
4. Ge kalendern ett namn som passar resursen, till exempel *Crew Mon–Thu*, och ställ in arbetsdagarna: avmarkera fredag under *Arbetsdagar*. Du lägger helgdagar eller stillestånd i listan *Helgdagar* med *Lägg till helgdag*.
5. Klicka på *Tillämpa*. Kalendern finns nu i projektets bibliotek och är kopplad till resursen, i ett enda steg som du kan ångra med *Ångra*. Med *Avbryt* skapas inget.

### Välja eller justera en befintlig kalender

I kolumnen *Kalender* väljer du en kalender i listan. *Projektkalender* tar bort resursens egen kalender igen. Vill du justera den valda kalendern klickar du på pennan bredvid listan (*Redigera…*). Fönstret *Resurskalender* öppnas med den aktuella kalendern.

### Titta på resultatet

1. Om statusfältet visar *Inaktuell — beräkna om (F5)* trycker du på **Beräkna** (F5).
2. Välj *Resurser › Histogram › Histogram* och klicka på resursen i listan till vänster om histogrammet. Dagarna då resursen inte arbetar men är schemalagd är röda. Om du håller musen över en sådan dag visar staplen till exempel *Arbetar inte denna dag enligt kalendern "Crew Mon–Thu"*.
3. Under *Resurser › Överbeläggning* visas antalet resurser med överbeläggning. Statusfältet visar till exempel *1 resurs(er) med överbeläggning*.

## Fallgropar och vad appen gör då

**Bara dagarna räknas, inte timmarna.** En resurskalender avgör vilka dagar resursen arbetar. Hur många enheter som finns tillgängliga den dagen följer av resursens *Max enheter*, inte av arbetstiderna i kalendern.

**Utjämning löser inte alltid detta.** Om det inte finns något fönster där varje dag i uppgiften infaller på en arbetsdag för resursen hjälper det inte att flytta. Välj *Resurser › Utjämning › Utjämna…* och klicka på *Beräkna*. Uppgiften finns då under *Kvarvarande konflikter*, med orsaken *Resursen arbetar inte alla dagar som uppgiften behöver — att flytta löser inte detta.* Tilldela sedan uppgiften till en annan resurs, eller ge den en egen kalender.

**En delad kalender.** Listan visar alla projektets kalendrar, alltså också projektkalendern och kalendrarna för uppgifter. Om du justerar en sådan kalender med pennan ändras tidsplanen för de uppgifter som använder den också. Statusfältet visar dessutom *Inaktuell — beräkna om (F5)*. Skapa hellre en egen kalender för resursen.

**Överbeläggning beror inte alltid på kalendern.** En resurs som arbetar varje dag kan också få överbeläggning. Verktygstipset nämner bara kalendern om dagen inte är en arbetsdag för resursen.

## Se även

- [Kalendrar och arbetsdagar](docs://uitleg-kalenders): varför en resurskalender inte flyttar några datum.
- [Skapa och tilldela en kalender](docs://howto-kalender-maken-en-toewijzen): fälten i kalenderformuläret.
- [Skapa helgdagar och byggsemester](docs://howto-feestdagen-genereren): lägga in helgdagar och stillestånd i kalendern.
- [Kalenderfönster](docs://ref-kalenders): alla fält i kalenderfönstren.
