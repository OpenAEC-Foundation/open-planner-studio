# Använda delad vy och minikartan

Mål: se två delar av tidslinjen sida vid sida och snabbt förflytta dig genom en lång tidsplan.

## När du behöver det

Du diskuterar början av grundläggningen och samtidigt överlämningen nio månader senare. Utan hjälp zoomar du hela tiden in och ut och tappar reda på var du var. Med **delad vy** ser du samma tidsplan två gånger, sida vid sida, med vardera sitt eget tidsfönster. Med **minikartan** ser du hela projektperioden i en smal remsa, och med ett klick hoppar du till den del du letar efter.

## Steg

### Slå på delad vy

1. Välj fliken *Visa*. I gruppen *Presentation* finns *Presentation*, *Delad vy* och *Minikarta*.
2. Klicka på *Delad vy*. Gantt-diagrammet delas i två. Båda fönstren startar med zoomnivån och positionen för din aktuella vy.

De två fönstren delar uppgiftstabellen, raderna och den vertikala rullningen. Det som varje fönster har för sig självt är tidsskalan: zoomnivå och horisontell position.

### Ge varje fönster ett eget tidsintervall

- Zooma och scrolla i det fönster där musen är. Med standardinställningen för *Scrolla & zooma* (*Zooma + dra*) zoomar mushjulet i det fönstret, centrerat på musen. Följer din inställning ett annat läge, gör hjulet i båda fönstren det som det läget anger.
- Med standardinställningen scrollar du genom raderna med Skift och mushjulet. Det gäller båda fönstren samtidigt.
- Knapparna *Zooma +* och *Zooma -* och listan för tidsskalan (till exempel *Kvartal*) fungerar bara på det vänstra fönstret. Du zoomar alltså det högra fönstret med mushjulet.
- Dra skiljelinjen mellan de två fönstren åt vänster eller höger för att göra dem bredare eller smalare. De börjar på hälften.

### Slå av delad vy

Klicka på *Delad vy* igen. Ett fönster blir kvar, med vyn från det vänstra fönstret. En ny delad vy startar igen med vyn från det ögonblicket.

### Slå på minikartan

1. Klicka på *Minikarta* i gruppen *Presentation*.
2. Under tidslinjen visas en remsa med hela projektperioden. Uppgifterna i din aktuella vy visas som tunna streck (så efter ett filter visas bara de uppgifter som filtret visar). En ram runt den del du ser nu visas också.
3. Klicka var som helst på remsan för att flytta ramen dit. Fönstret centreras på den platsen. Eller ta tag i ramen och dra den.

Minikartan flyttar bara tidsfönstret. Raderna blir kvar som de är.

Om delad vy är på får varje fönster sin egen remsa, under sin egen del av tidslinjen. Varje remsa styr bara fönstret ovanför den.

## Fallgropar och vad appen gör

**Minikartan gör ingenting om hela projektet redan syns.** Om du zoomar ut så långt att hela tidsplanen får plats finns det inget att flytta till, och ett klick har ingen effekt. Zooma in först.

**Minikartan finns bara i Gantt-diagrammet.** På flikarna *Tabell*, *IFC* och *Rapport* och i den fullständiga resurspanelen (*Resurser*, inte *Resursdocka*) finns ingen tidslinje. Därför finns där varken någon minikarta eller någon delad vy. De visas igen så snart du går tillbaka till en vy med Gantt-diagrammet.

**Delad vy hör till projektet, minikartan gör inte det.** Delad vy gäller för det öppna projektet. Om du byter till ett annat projekt och tillbaka är den fortfarande där. Minikartan är ett val för alla projekt och blir kvar på eller av efter en omstart. Båda är skärmval: de ingår inte i projektfilen, gör inte projektet ”ändrat” och ingår inte i *Ångra*.

**Delad vy och presentation.** Båda blir kvar synliga när du slår på presentationsläget (se [Presentera på en stor skärm](docs://howto-presentatie)). Eftersom menyfliksområdet är borta då kan du inte längre slå på eller av dem i det läget. Ställ därför in dem ordentligt innan du börjar.

## Se även

- [Presentera på en stor skärm](docs://howto-presentatie): Gantt-diagrammet i helskärm, utan menyfliksområdet.
- [Skapa och använda en layout](docs://howto-layouts-gebruiken): tidsskalan kan också sparas som en del av en layout.
