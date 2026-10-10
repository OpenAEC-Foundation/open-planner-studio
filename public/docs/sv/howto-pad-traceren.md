# Spåra drivkedja

Mål: visa kedjan av uppgifter före eller efter en uppgift, så att du ser vad som bestämmer uppgiftens datum och vad som flyttas om den blir försenad.

## När du behöver det

Takläggningen börjar först om tre veckor och du vill veta vilken uppgift som avgör det. Eller muraren är en vecka försenad och du vill se vilka uppgifter efter muraren som flyttas. I en tidsplan med tiotals samband ser du inte det i linjerna. Med **spåra drivkedja** färgar appen alla **föregående** (uppgifter som kommer före den valda uppgiften, direkt eller via andra uppgifter) och **efterföljande** (uppgifter som kommer efter den) och tonar ned resten.

## Steg

1. Välj uppgiften vars drivkedja du vill se, i uppgiftstabellen eller på dess balk i Gantt-diagrammet. Om du väljer flera uppgifter spårar appen från den uppgift som du valde först.
2. Välj *Tidsplan › Spåra drivkedja › Föregående* för allt som kommer före uppgiften, eller *Tidsplan › Spåra drivkedja › Efterföljande* för allt som kommer efter den. Båda knapparna kan vara på samtidigt. Samma två knappar finns på fliken *Tabell*, i gruppen *Spåra drivkedja*.
3. Om du vill se båda riktningarna på en gång: högerklicka på uppgiften, i Gantt-diagrammet eller i uppgiftstabellen, och välj *Spåra drivkedja*.
4. Titta på resultatet i Gantt-diagrammet och i uppgiftstabellen. Hur du läser det förklaras nedan.
5. Du slutar genom att klicka på den aktiva knappen igen, genom att högerklicka på en uppgift och välja *Sluta spåra drivkedja*, eller med Esc. Esc tar också bort markeringen.

Om du väljer en annan uppgift medan du spårar följer drivkedjan den nya markeringen.

## Så läser du resultatet

- De föregående är guldfärgade, de efterföljande är lila. I Gantt-diagrammet får balkarna en annan färg, i uppgiftstabellen visas en remsa till vänster om raden: heldragen för föregående, streckad för efterföljande. Den valda uppgiften har en kontur.
- En mörkare färg, i uppgiftstabellen en tjockare remsa med fet text, markerar kedjan av **drivande samband**: de samband som verkligen bestämmer datumen. Vad det betyder förklaras i [Samband och fördröjning](docs://uitleg-relaties).
- Alla uppgifter utanför drivkedjan tonas ned. Linjerna för samband som inte hör till drivkedjan är svagare och prickade.

## Fallgropar och vad appen gör

**Ingen uppgift vald.** Utan vald uppgift finns inget att spåra: knappen är på, men ingenting ändras på skärmen. Välj först en uppgift.

**Ingen framhävning av kedjan av drivande samband.** Framhävningen kommer från den senaste beräkningen. Om tidsplanen ännu inte är beräknad, eller om beräkningen ger ett fel, färgar appen alla föregående och efterföljande lika starkt. Tryck på **Beräkna** (F5), till exempel via *Start › Tidsplan › Beräkna*, och titta på drivkedjan igen. Efter en ändring finns framhävningen kvar från den föregående beräkningen så länge statusfältet visar *Inaktuell — beräkna om (F5)*.

**Ett samband på en fas.** Spårningen följer sambanden så som du har lagt dem. Ett samband från eller till en fas (sammanfattningsuppgift) kopplar fasen själv. För beräkningen gäller det för varje uppgift i fasen, men drivkedjan fortsätter inte till uppgifterna i fasen. Om du spårar en uppgift i en fas som är kopplad till en annan uppgift med ett samband på fasen själv, ser du därför inte det sambandet. Välj i så fall fasen själv.

**Bara vald riktning.** Om bara *Föregående* är på ser du inte vad som kommer efter uppgiften, och tvärtom.

## Se även

- [Samband och fördröjning](docs://uitleg-relaties): varför ett samband är drivande och hur appen beräknar startdatumet för en uppgift.
- [Kritisk linje och slack](docs://uitleg-kritiek-pad): vilken kedja som avgör projektets slutdatum.
- [Lägga till samband](docs://howto-relaties-leggen): hur du lägger till ett samband om en koppling saknas i drivkedjan.
