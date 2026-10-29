# Alegerea unui tip de activitate

Scop: setați pentru fiecare activitate ce ajustează aplicația atunci când modificați durata, unitățile de atribuire sau lucrul: durata, unitățile de atribuire sau lucrul însuși.

## Când aveți nevoie de asta

Ați atribuit resurse unei activități și doriți ca aplicația să calculeze în felul în care calculați dumneavoastră. Un exemplu: macaraua este închiriată pentru o zi, iar ziua aceea este fixă. Un alt exemplu: știți că în activitate sunt 160 de ore de zidărie și doriți să vedeți cât durează cu trei persoane, în loc de două. Aceste două situații au nevoie de un tip de activitate diferit.

Tipul de activitate decide care dintre cele trei mărimi (durata, unitățile de atribuire și lucrul) se modifică odată cu celelalte atunci când schimbați una. Fundalul și exemplele lucrate se află în [Tipuri de activitate: durată, unități de atribuire și lucru](docs://uitleg-werkregels).

## Pași

### Afișarea tipului de activitate

Tipul de activitate nu este afișat implicit. Activați afișarea o singură dată:

1. Alegeți *Setări › Proiect › Setări aplicație*, fila *Planificare*.
2. Sub titlul *Calculare*, bifați *Tipuri de activitate*.
3. Închideți fereastra cu *Închidere*.

Aceasta este o setare a aplicației, nu a fișierului de proiect. Dacă un fișier conține deja tipuri de activitate sau lucru stocat, de exemplu un fișier din MS Project sau Primavera P6, aplicația afișează tipul de activitate pentru acel fișier chiar fără această setare. Același lucru se întâmplă din momentul în care alegeți dumneavoastră un tip de activitate într-un fișier: afișarea rămâne atunci activată pentru acel fișier, chiar dacă dezactivați din nou setarea. Afișarea rămâne activată cât timp fișierul este deschis și, după redeschidere, atâta timp cât fișierul conține un tip de activitate sau lucru stocat.

### Alegerea tipului de activitate pentru o activitate

1. Selectați activitatea. Panoul *Proprietăți* se află în dreapta; dacă nu îl vedeți, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. La *Tip de activitate*, alegeți una dintre cele cinci opțiuni: *Standard de proiect (Durată fixă și unități fixe)*, *Durată fixă și unități fixe*, *Durată fixă și lucru*, *Muncă fixă* sau *Unități fixe*. Cu *Standard de proiect*, activitatea urmează standardul proiectului.
3. Doriți să știți ce face o opțiune? În lista derulantă deschisă, fiecare opțiune are o pictogramă i. Treceți cursorul peste ea, faceți clic sau atingeți-o pentru explicație. Un clic pe pictograma i nu alege încă tipul de activitate.
4. Lângă câmpul închis există și o pictogramă i. Aceasta explică tipul de activitate care se aplică acum, de exemplu *Durata rezultă din lucru și din unități de atribuire.* Cu *Standard de proiect*, este tipul de activitate dintre paranteze.

*Standard de proiect* este prima opțiune și este ceea ce are implicit o activitate. Tipul de activitate dintre paranteze este cel pe care proiectul îl are în prezent ca valoare implicită. Aplicația nu are un buton pentru a schimba standardul proiectului: acesta vine dintr-un import (de exemplu din MS Project sau Primavera P6) sau din conexiunea MCP. Dacă doriți alt tip de activitate pentru o singură activitate, alegeți-l aici.

Tipul de activitate îl puteți alege și în tabel. Faceți clic pe **+** din dreapta antetului tabelului de activități (*Adăugare coloană*) și, sub *Planificare*, alegeți coloana *Tip de activitate*.

O activitate fără atribuire nu are nimic de legat, deci tipul de activitate nu face nimic acolo. Atribuiți mai întâi o resursă (vedeți [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen)).

### Vizualizarea și modificarea lucrului

Pentru o activitate cu atribuiri apare o coloană *Lucru (h)* în secțiunea *Atribuiri* din panoul *Proprietăți*, lângă *Unități de atribuire*. Aceasta este lucrul rămas al acelei resurse, în ore. Deasupra unei coloane apare un lacăt mic, care arată ce menține tipul de activitate: *Unități de atribuire* cu *Durată fixă și unități fixe* și cu *Unități fixe*, *Lucru (h)* cu *Durată fixă și lucru* și cu *Muncă fixă*.

Dacă doriți să modificați lucrul singur, scrieți orele în câmp și apăsați Enter. Aplicația nu acceptă o valoare de 0 sau mai mică: câmpul revine la valoarea anterioară.

### Ce se întâmplă

Dacă alegeți un tip de activitate, încă nu se schimbă niciun număr. Sub un tip de activitate care protejează lucrul, aplicația fixează doar lucrul rămas, astfel încât *Lucru (h)* are o valoare stocată. Abia la următoarea modificare tipul de activitate decide ce urmează să se modifice. Modificați, de exemplu, *Unități de atribuire* și vedeți ce se întâmplă cu durata și cu lucrul.

Dacă aceasta modifică durata activității, bara de stare afișează *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu din *Acasă › Planificare › Calculare*, pentru a vedea datele noi. Dacă *Calculare automată* este activată (în aceeași filă *Planificare*, sub titlul *Calculare*), aplicația face asta singură.

## Ce tip de activitate se potrivește

- **Durată fixă și unități fixe** se potrivește când durata este o convenție și unitățile de atribuire sunt ce introduceți dumneavoastră. Lucrul rezultă din cele două. Aceasta este opțiunea implicită. Macaraua închiriată pentru o zi aparține aici: ziua este fixă, iar dumneavoastră decideți câte macarale sunt pe ea.
- **Durată fixă și lucru** se potrivește când activitatea trebuie încheiată într-un termen fix și știți cât lucru are. Dacă durata se modifică, aplicația ajustează unitățile de atribuire.
- **Muncă fixă** se potrivește când știți câte ore de lucru are și doriți să vedeți cum variază durata în funcție de numărul de persoane. Cele 160 de ore de zidărie cu trei persoane, în loc de două, aparțin aici. Tencuiala din proiectul de exercițiu primește acest tip de activitate.
- **Unități fixe** se potrivește când unitățile de atribuire sunt fixe, de exemplu o macara, iar lucrul decide durata.

## Capcane și ce face aplicația atunci

**Câmpul *Tip de activitate* lipsește.** Atunci setarea *Tipuri de activitate* este dezactivată și fișierul nu are încă tipuri de activitate, sau ați selectat un jalon, o fază, un hamac sau o activitate cu tipul de durată *Timp scurs*. Acolo nu există un tip de activitate. Selectați o activitate obișnuită.

**Durata se modifică fără ca dumneavoastră s-o modificați.** Sub *Muncă fixă* și *Unități fixe*, durata rezultă din unitățile de atribuire și din lucru. Dacă modificați unul dintre acestea sau numărul de resurse, aplicația ajustează durata, rotunjită în sus la zile lucrătoare întregi. Pentru o activitate exprimată în ore, aplicația rotunjește în sus la minute întregi.

**Lucrul nu corespunde exact unităților de atribuire × durată.** Rotunjirea poate fi motivul. În câmpul *Lucru (h)* apare atunci un semn de avertizare, *Diferă de unități de atribuire × durată*. Histograma urmează lucrul stocat.

**Materialul nu contează.** Pentru o resursă de tip material, *Lucru (h)* afișează o liniuță. Materialul nu determină niciodată durata.

**O activitate cu progres.** Tipul de activitate lucrează cu partea rămasă. Astfel, *Lucru (h)* arată doar ce mai trebuie făcut.

**Anularea.** Alegerea unui tip de activitate și fiecare modificare pe care o calculează tipul de activitate reprezintă un singur pas pentru *Anulare* (Ctrl+Z). Tipul de activitate ales dispare atunci din nou, dar câmpul *Tip de activitate* rămâne vizibil.

## Vezi și

- [Tipuri de activitate: durată, unități de atribuire și lucru](docs://uitleg-werkregels): cum leagă aplicația durata, unitățile de atribuire și lucrul, cu exemple lucrate.
- [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen): cum puneți o resursă pe o activitate.
