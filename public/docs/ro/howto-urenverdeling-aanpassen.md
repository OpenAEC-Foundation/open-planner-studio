# Modificarea distribuției orelor

Obiectiv: pentru o atribuire, decideți singur cât lucrează resursa în fiecare zi lucrătoare a activității, în loc să folosiți o curbă standard.

## Când aveți nevoie de aceasta

O curbă, precum *În formă de clopot*, are o formă fixă. Uneori știți mai bine. Zidarul începe pe fața exterioară a zidului cu gol de aer la jumătate din intensitate, pentru că schela este încă montată, și apoi lucrează cu normă întreagă. Sau doriți să mențineți un vârf chiar sub capacitate. Atunci modificați **distribuția orelor**.

Lucrați cu **faze**: zile lucrătoare consecutive în care resursa lucrează cu aceleași unități de atribuire. Distribuția modifică doar orele pe zi ale acestei atribuiri. Datele activității nu se schimbă.

## Pași

Exemplul este fața exterioară a zidului cu gol: 6 zile lucrătoare, un zidar, 48 de ore.

1. Selectați activitatea. Panoul *Proprietăți* se află în dreapta; dacă nu îl vedeți, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. În blocul *Atribuiri*, faceți clic pe pictograma diagramei cu bare *Distribuție ore…* de lângă zidar. Se deschide fereastra *Repartizarea orelor pe faze*. Porniți de la ceea ce aplicația rezervă în prezent: pentru această față exterioară a zidului cu gol, o fază de 6 zile cu 1 unitate de atribuire.
3. Dacă este nevoie, alegeți un punct de plecare la *Aplicare formă:*. Cu *În formă de clopot*, aplicația creează cinci faze: 0,18 unități pe prima și ultima zi, 0,84 pe a doua și a cincea zi și 1,98 pe cele două zile din mijloc. Totalul rămâne 48 de ore.

### Ajustarea fazelor

Puteți lucra în tabel sau în banda de deasupra acestuia.

- Introduceți alte valori în *Unități de atribuire pe zi* pentru o fază. Coloanele *Ore/zi* și *Ore* se calculează automat.
- Modificați numărul de *Zile* al unei faze. Ultima fază se întinde întotdeauna până la sfârșitul activității și primește zilele rămase.
- Alegeți *Divizare* pentru a împărți o fază în două, de exemplu 6 zile în 3 și 3. Alegeți *Combinare* pentru a uni o fază cu următoarea.
- În bandă trageți o limită pentru a prelungi sau a scurta o fază, trageți marginea de sus pentru a stabili efortul și faceți dublu clic pe o zi pentru a diviza o fază.

### Aplicarea

Alegeți *Aplicare*. Cu *Anulare* fereastra se închide fără modificare.

Un exemplu. Alegeți *Divizare*, setați *Zile* ale primei faze la 2 și efortul acestei faze la 0,5. A doua fază durează atunci 4 zile cu efort 1. Totalul este 2 × 0,5 × 8 + 4 × 1 × 8 = 40 de ore.

După *Aplicare*, curba atribuirii se setează la *Contur*, dezactivată. *Unit./zi* rămâne cum era. Histograma și supraalocarea urmează imediat noua distribuție. Recalcularea nu este necesară, pentru că nicio dată nu se mută.

### Eliberarea distribuției

Dacă atribuirea are o distribuție proprie, fereastra are și *Eliberare repartizare*. Aceasta elimină distribuția proprie, iar aplicația revine la *Unit./zi* și la curbă. Alegeți-o și dacă doriți să modificați curba, pentru că lista derulantă *Curbă* este dezactivată câtă vreme există o distribuție proprie.

## Capcane și ce face aplicația atunci

**Totalul se modifică odată cu distribuția.** Nu împărțiți orele, ci le stabiliți. Dacă setați o fază la 0,5 în loc de 0,18, totalul crește. Totalul în ore este la baza ferestrei; verificați-l înainte de a face clic pe *Aplicare*.

**Ce fac unitățile după aceea depinde de regula de lucru.** Cu *Durată fixă și unități fixe*, alte valori *Unit./zi* nu modifică distribuția. Cu *Durată fixă și lucru*, aplicația scalează orele pe zi odată cu noile unități de atribuire: la 2 unități de atribuire în loc de 1, fiecare zi se dublează, la fel și totalul (de la 32 la 64 de ore), iar durata rămâne aceeași. Cu *Muncă fixă*, unitățile modifică durata activității: distribuția se comprimă sau se întinde pe noua durată, cu același total. Cu *Unități fixe*, unitățile modifică și durata; verificați totalul de la baza ferestrei după aceea.

**Dacă modificați durata activității, distribuția se întinde odată cu ea.** Forma rămâne aceeași. Cu *Durată fixă și unități fixe* și cu *Unități fixe*, totalul crește proporțional cu durata: dacă durata unei activități cu distribuție proprie se dublează de la 4 la 8 zile lucrătoare, totalul se dublează și el, de la 32 la 64 de ore. Cu *Durată fixă și lucru* și cu *Muncă fixă*, totalul rămâne același (32 de ore rămân 32 de ore), iar unitățile scad.

**Lucrul urmează distribuția.** *Lucru (rămas)* devine suma fazelor dumneavoastră, de asemenea sub *Muncă fixă*. Durata activității nu se modifică din această cauză.

**Unități nevalide.** Un efort gol sau negativ primește o margine roșie, iar butonul *Aplicare* se dezactivează. O fază cu efort 0 este permisă. O astfel de fază rămâne în durata activității.

**Totul se aplică doar acestei atribuiri.** Aplicația afișează chiar acest lucru: *Distribuția modifică doar orele pe zi ale acestei atribuiri; datele activității și divizările rămân neschimbate.* Alte resurse ale aceleiași activități își păstrează propria distribuție.

**Redistribuirea urmează distribuția.** Redistribuirea numără aceleași ore pe zi ca histograma.

**Anularea.** *Aplicare* și *Eliberare repartizare* sunt fiecare câte un pas pentru *Anulare* (Ctrl+Z).

## Vezi și

- [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen): punerea unei resurse pe o activitate și alegerea unei curbe.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): ce faceți când o resursă are prea mult de lucru într-o zi.
