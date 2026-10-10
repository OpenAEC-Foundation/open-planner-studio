# Välja framdriftsläge

Mål: bestäm hur appen planerar det återstående arbetet för en uppgift som redan har påbörjats medan dess föregående uppgift fortfarande pågår: enligt sambandet (Retained Logic) eller enligt vad som faktiskt händer (Progress Override).

## När du behöver det

På plats går arbetet ofta före logiken. Målaren börjar redan i rummen som har putsats, medan putsaren fortfarande är upptagen på andra ställen. I tidsplanen är det till exempel ett samband slut-till-start där den efterföljande uppgiften börjar innan den föregående uppgiften är klar. Appen kallar det **framdrift i fel ordning**. Om statusfältet visar *N samband med framdrift i fel ordning* har du ett sådant fall, och framdriftsläget avgör hur appen planerar det återstående arbetet för den efterföljande uppgiften. Vad de två lägena gör, med ett räkneexempel, finns i [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang).

## Steg

1. Uppdatera framdriften och ange rapportdatumet, så som beskrivs i [Uppdatera framdrift](docs://howto-voortgang-bijwerken).
2. Gå till *Tidsplan › Baslinjer & framdrift › Framdriftsläge* och öppna listan.
3. Välj *Retained Logic* eller *Progress Override*.
4. Tryck på **Beräkna** (F5), till exempel via *Tidsplan › Tidsplan › Beräkna*. Valet gör tidsplanen inaktuell: statusfältet visar *Inaktuell — beräkna om (F5)*. Om *Beräkna automatiskt* är på gör appen detta själv.

Hur väljer du?

- **Retained Logic** är standard. Sambandet gäller fortfarande: det återstående arbetet för den efterföljande uppgiften börjar först när den föregående uppgiften är klar. Välj detta om ordningen verkligen är fast, eller om du vill planera försiktigt.
- **Progress Override** låter verkligheten avgöra. Det återstående arbetet för den efterföljande uppgiften börjar på rapportdatumet, utan att vänta på den föregående uppgiften. Välj detta om den efterföljande uppgiften verkligen fortsätter att arbeta och slutdatumet inte ska bero på en föregående uppgift som fortfarande pågår.

## Kontrollera resultatet

- Klicka på meddelandet *N samband med framdrift i fel ordning* i statusfältet. Panelen *Varningar* öppnas. Du når den också via *Tidsplan › Tidsplan › Varningar*. Varje samband finns med där, med texten *Framdrift i fel ordning: framdriften för den efterföljande uppgiften strider mot sambandet*, till exempel *4.2 Plastering → 4.5 Painting (FS)*.
- Titta på balken för den efterföljande uppgiften. Med Retained Logic pågår den till efter slutet på dess föregående uppgift. Med Progress Override är den klar tidigare. I exemplet i förklaringen är det tisdag 27 juli mot torsdag 22 juli.

## Fallgropar och vad appen gör

**Ingen skillnad.** Läget påverkar bara uppgifter som redan har påbörjats medan deras föregående uppgift ännu inte är klar. Utan sådan uppgift ändras ingenting.

**Meddelandet finns kvar.** Progress Override löser inte meddelandet om framdrift i fel ordning. Läget bestämmer hur appen beräknar; motsägelsen mellan samband och framdrift finns kvar. Om sambandet inte längre är rätt ändrar du det ([Lägga till samband](docs://howto-relaties-leggen)).

**Det hör till projektet.** Valet sparas i projektfilen, gäller hela projektet och kan ångras med Ctrl+Z. Ett nytt projekt använder Retained Logic.

**En P6-fil.** Om du öppnar en Primavera P6-fil (.xer) tar appen läget från filen. Förutom Retained Logic och Progress Override har P6 även Actual Dates. Appen känner inte till det tredje läget; en sådan fil beräknas som Retained Logic. Importmeddelandet räknar det som *1 P6-tidsplaninställning med säker reservlösning.*

**Beräkningsprofilen.** I profilen Primavera P6 fungerar Progress Override även bakåt, i de senaste datumen och det fria slacket för den föregående uppgiften (beräkningsregel *Progress Override negeras även för en påbörjad efterföljande uppgift bakåt*). I profilerna Open Planner Studio och Microsoft Project är det inte så. Du hittar beräkningsreglerna under *Inställningar › Projekt › Projektinfo*, i blocket *Beräkningsprofil och beräkningsalternativ*. I exemplet i förklaringen syns inte effekten bakåt.

## Se även

- [Framdrift, rapportdatum och baslinje](docs://uitleg-voortgang): skillnaden mellan de två lägena, med siffror.
- [Uppdatera framdrift](docs://howto-voortgang-bijwerken): att ange den framdrift som läget använder.
- [Lägga till samband](docs://howto-relaties-leggen): att ändra ett samband som inte längre är rätt.
