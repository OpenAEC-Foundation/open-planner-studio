# Redistribuirea resurselor

Aveți un singur zidar și doi pereți care trebuie zidiți în aceleași zile. Pe hârtie planificarea funcționează, dar în practică el poate fi doar într-un singur loc. Redistribuirea este modul în care aplicația rezolvă astfel de suprapuneri: face ca activitățile să înceapă mai târziu, până când resursa poate face față. În acest articol citiți exact ce mută redistribuirea, când cedează data de sfârșit și ce nu rezolvă pentru dumneavoastră.

## Conceptul

O resursă este **supraalocată** într-o zi lucrătoare dacă planificarea cere de la ea mai mult decât poate oferi în ziua respectivă. Ce poate oferi este capacitatea ei: *Capacitate maximă* în zilele lucrătoare ale calendarului ei. Dacă nu lucrează în acea zi conform calendarului, capacitatea ei este 0.

**Redistribuirea** rezolvă asta făcând activitățile să înceapă mai târziu. Nu face nimic mai mult. Nu scurtează o activitate, nu împarte o activitate, nu schimbă unitățile de atribuire sau dependențele și nu adaugă o resursă suplimentară. Pentru fiecare activitate, aplicația caută primul loc în care resursele sunt libere și mută activitatea acolo.

Există două moduri, în fereastra *Redistribuire resurse*:

- Implicit, data de sfârșit a proiectului poate să se mute. Aceasta este redistribuirea în sensul propriu.
- Cu caseta *Redistribuire numai în limita marjei — data de sfârșit a proiectului rămâne fixă*, aplicația mută activitățile doar în limitele marjei lor. Data de sfârșit rămâne pe loc. Dacă aceasta nu reușește, activitatea rămâne unde este, iar aplicația raportează un conflict. Ce este marja, citiți în [Drumul critic și marja](docs://uitleg-kritiek-pad).

## Cum calculează aplicația

### Cât cere o activitate

Pe zi lucrătoare, aplicația numără câte unități de atribuire cere fiecare activitate de la o resursă. Acestea sunt unitățile conform curbei sau conform distribuției orelor proprii, exact aceleași ore pe zi pe care le arată histograma. Capacitatea resursei este *Capacitate maximă*, sau valoarea treptei din capacitatea pe perioade care se aplică în ziua respectivă. O zi este supraalocată dacă cererea este mai mare decât capacitatea.

### În ce ordine

Aplicația plasează activitățile una câte una, în această ordine: întâi cea cu prioritatea cea mai mare, apoi cea cu cea mai mică marjă totală, apoi cea cu început cel mai devreme și apoi ordinea din tabelul de activități. O activitate ajunge la rând abia când predecesorii ei au primit locul.

Prioritatea este un număr de la 0 la 1000 pe care îl setați pentru fiecare activitate. Implicit este 500. În meniul de clic dreapta al unei bare de activitate se numește *Prioritate*, cu alegerile *Scăzută* (100), *Normală* (500) și *Ridicată* (900). O activitate care vine mai devreme primește locul pe care îl dorește. Activitățile care urmează trebuie să se încadreze în jurul ei. Așa decide prioritatea care activitate rămâne și care cedează. Valoarea 1000 este specială: o astfel de activitate nu se mută niciodată din cauza capacității. Este "Do Not Level" din MS Project.

### Unde se mută o activitate

Pentru fiecare activitate, aplicația pornește de la începutul cel mai devreme pe care îl permit dependențele. Aceasta ține cont de faptul că predecesorii pot fi deja mutați ei înșiși. Dacă activitatea încape acolo, rămâne. Dacă nu încape, aplicația încearcă următoarea zi lucrătoare a activității, și tot așa. O activitate încape dacă în fiecare zi a ei, fiecare resursă are destulă capacitate liberă. Dacă are mai multe resurse, toate trebuie să fie libere în zilele respective. Astfel o activitate se mută întotdeauna mai târziu, niciodată mai devreme.

Aplicația notează mutarea ca **întârziere prin redistribuire**: un număr de zile lucrătoare, în calendarul activității, cu care activitatea începe mai târziu decât cer dependențele. O vedeți în coloana *Întârziere prin redistribuire* sub *Calculat*. Întârzierea se salvează împreună cu fișierul de proiect. *Calculare* (F5) o ia în calcul ca timp de așteptare suplimentar înainte de început. Activitățile care urmează se mută prin dependențele lor.

### În marjă sau dincolo de ea

Fără *netezire*, aplicația caută până când activitatea încape. Ca rezultat, data de sfârșit a proiectului se poate muta.

Cu *netezire*, o activitate nu poate începe mai târziu decât începutul târziu, adică ultima zi la care ar putea începe fără ca data de sfârșit să se mute. Dacă activitatea nu încape în acest interval, rămâne la cel mai devreme loc. Activitatea apare apoi sub *Conflicte rămase*.

### Ce nu mută aplicația

- Activitățile care au început deja sau s-au încheiat. Încărcarea lor se numără, dar ele nu primesc niciodată o întârziere prin redistribuire.
- Activitățile cu prioritatea 1000. Ele urmează predecesorii, dar nu se mută din cauza capacității.
- Activitățile fără atribuire la resursele selectate, jaloanele și fazele. Se mută doar dacă se mută un predecesor.
- Materialul. Acesta nu se redistribuie niciodată.

### Propunere și aplicare

*Calculare* face o propunere: activitățile care se mută, cu începutul vechi și nou, și data de sfârșit dinainte și de după. Nimic nu se schimbă în planificarea dumneavoastră până când alegeți *Aplicare*. Apoi aplicația scrie întârzierile în activități și recalculează imediat planificarea.

## Exemplu lucrat: zidarul la doi pereți

Exemplul este proiectul de exercițiu al tutorialelor *House extension*, așa cum este chiar înainte de redistribuire, în tutorialul 5. În tutorialul 5 faceți singur acest pas și verificați cifrele. În acest exemplu tencuiala este pe *Muncă fixă*, iar tencuitorul lucrează cu unități de atribuire de 2, ca în [Regulile de lucru: durată, unități de atribuire și lucru](docs://uitleg-werkregels).

După planșeul cu goluri, încheiat luni 28 iunie, foaia interioară a zidăriei (5 zile lucrătoare) și foaia exterioară (6 zile lucrătoare) încep amândouă marți 29 iunie. Ambele sunt pe zidar, cu unități de atribuire de 1 și o *Capacitate maximă* de 1. După foaia interioară urmează elementele de acoperiș (o lucrare de macara de 6 ore) și învelitoarea (2 zile lucrătoare). Cadrele așteaptă învelitoarea și foaia exterioară. Predarea este luni 30 august.

### Supraalocarea

Foaia interioară se întinde de la 29 iunie până la 5 iulie inclusiv, foaia exterioară de la 29 iunie până la 6 iulie inclusiv. Din 29 iunie până la 5 iulie inclusiv, adică 5 zile lucrătoare, planificarea cere 2 unități de atribuire de la un zidar cu capacitate 1. Zidarul este supraalocat în cele 5 zile.

### Ordinea

Ambele activități au prioritatea 500. Cadrele ferestrelor sunt livrate abia pe 14 iulie (în tutorialul 3 ați setat o restricție *Nu începe înainte de (SNET)* pentru aceasta). Ca rezultat, foaia interioară are o marjă de 3 zile lucrătoare, iar cea exterioară de 5. Foaia interioară are cea mai mică marjă și de aceea vine prima. Ea rămâne din 29 iunie până la 5 iulie inclusiv.

### Mutarea

Foaia exterioară nu poate începe pe 29 iunie. Prima zi în care zidarul este din nou liber este marți 6 iulie. Aceasta este cu 5 zile lucrătoare mai târziu decât începutul cel mai devreme, deci întârzierea prin redistribuire este 5. Foaia exterioară se întinde acum de la 6 iulie până la 13 iulie inclusiv. Cadrele încep oricum abia pe 14 iulie, deci predarea rămâne luni 30 august. Fereastra arată *Data de sfârșit a proiectului: neschimbată (30-08-2027)* și afișează o linie: *Build outer cavity leaf*, început vechi 29-06-2027, început nou 06-07-2027, *5 d*.

Cele 5 zile lucrătoare de mutare sunt exact marja foii exterioare. De aceea *netezire* dă și aici același rezultat. Foaia exterioară nu mai are marjă și acum este critică.

### Dacă cadrele nu sosesc pe 14 iulie

Fără această restricție, cadrele pot începe vineri 9 iulie, iar predarea este miercuri 25 august. Foaia exterioară are atunci doar 2 zile lucrătoare de marjă.

- Fără *netezire*, foaia exterioară se mută tot cu 5 zile lucrătoare. Acum cadrele trebuie să aștepte: încep pe 14 iulie, cu 3 zile lucrătoare mai târziu. Tot ce urmează se mută și ele, iar predarea trece de la 25 august la 30 august, tot cu 3 zile lucrătoare mai târziu.
- Cu *netezire*, nimic nu se mută. Foaia exterioară nu încape în cele 2 zile lucrătoare de marjă. Fereastra arată conflictul *Build outer cavity leaf*, 5 zile, cu motivul *Capacitate liberă insuficientă în marjă pentru a rezolva acest conflict.*

### Dacă foaia exterioară primește prioritate

Dacă dați foaiei exterioare prioritatea *Ridicată* (900), ea vine prima. Rămâne pe 29 iunie, iar acum foaia interioară cedează: cu 6 zile lucrătoare mai târziu, de la 7 iulie până la 13 iulie inclusiv. Foaia interioară are doar 3 zile lucrătoare de marjă, deci mutarea cu 6 zile lucrătoare este cu 3 în plus. Elementele de acoperiș, cadrele și tot ce urmează se mută și ele. Predarea trece de la luni 30 august la joi 2 septembrie. Aceeași supraalocare dă deci o dată de sfârșit diferită, în funcție de care activitate rămâne pe loc.

### Dacă vine un al doilea zidar

Dacă setați *Capacitate maximă* a zidarului la 2, nu mai există supraalocare. *Calculare* raportează *Nicio activitate nu trebuie mutată — planificarea este deja fără conflicte.*

## Consecințe și idei greșite

**"Redistribuirea găsește cea mai scurtă planificare."** Nu. Aplicația lucrează activitate cu activitate, într-o ordine fixă, și nu caută cea mai bună soluție de ansamblu. Vedeți exemplul cu prioritatea: o altă prioritate dă o altă dată de sfârșit.

**"O activitate redistribuită este sigură."** Redistribuirea folosește marja. Activitatea mutată are apoi mai puțină marjă sau nu mai are deloc și poate deveni critică, ca foaia exterioară de mai sus. Dacă întârzie apoi, predarea se mută.

**"Redistribuirea urmărește modificările mele ulterioare."** Nu. Întârzierea este un număr fix de zile lucrătoare. Dacă foaia interioară devine mai scurtă după redistribuire, foaia exterioară începe totuși cu 5 zile lucrătoare mai târziu, deși acest lucru nu mai este necesar. Redistribuiți atunci din nou. Aplicația pornește de la zero.

**Nu totul se poate rezolva prin mutare.** Dacă resursa nu lucrează în zilele de care are nevoie activitatea, sau dacă activitatea, prin curba ei, cere într-o zi mai mult decât poate oferi resursa, supraalocarea rămâne. Aplicația spune atunci de ce, la activitate.

**Materialul nu se redistribuie.** Dacă materialul cere într-o zi mai mult decât capacitatea lui, aplicația raportează asta ca supraalocare, dar redistribuirea nu îl atinge.

**Activități fixate.** Dacă toate activitățile care se suprapun au prioritatea 1000, fereastra raportează *Nicio activitate nu trebuie mutată — planificarea este deja fără conflicte.*, deși supraalocarea rămâne. Așadar, după aplicare, uitați-vă la mesajul *Supraalocare* din panglică.

## Vezi și

- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): pașii pentru a găsi supraalocarea și a o redistribui.
- [Drumul critic și marja](docs://uitleg-kritiek-pad): ce este marja și de ce devine o activitate critică.
- [Regulile de lucru: durată, unități de atribuire și lucru](docs://uitleg-werkregels): cum se mișcă durata unei activități odată cu unitățile de atribuire.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): trei turnuri care au nevoie de aceleași echipe și de macaraua-turn, și ce face redistribuirea cu acestea.
