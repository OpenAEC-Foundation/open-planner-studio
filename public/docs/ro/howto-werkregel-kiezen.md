# Alegerea unei reguli de lucru

Scop: setați pentru fiecare activitate ce ajustează aplicația atunci când modificați durata, unitățile de atribuire sau lucrul: durata, unitățile de atribuire sau lucrul însuși.

## Când aveți nevoie de asta

Ați atribuit resurse unei activități și doriți ca aplicația să calculeze în felul în care calculați dumneavoastră. Un exemplu: macaraua este închiriată pentru o zi, iar ziua aceea este fixă. Un alt exemplu: știți că în activitate sunt 160 de ore de zidărie și doriți să vedeți cât durează cu trei persoane, în loc de două. Aceste două situații au nevoie de o regulă de lucru diferită.

Regula decide care dintre cele trei mărimi (durata, unitățile de atribuire și lucrul) se modifică odată cu celelalte atunci când schimbați una. Fundalul și exemplele lucrate se află în [Reguli de lucru: durată, unități de atribuire și lucru](docs://uitleg-werkregels).

## Pași

### Afișarea regulii de lucru

Regula de lucru nu este afișată implicit. Activați afișarea o singură dată:

1. Alegeți *Setări › Proiect › Setări*, fila *Planificare*.
2. Sub titlul *Calculare*, bifați *Afișare reguli de lucru și lucru*.
3. Închideți fereastra cu *Închidere*.

Aceasta este o setare a aplicației, nu a fișierului de proiect. Dacă un fișier conține deja reguli de lucru sau lucru stocat, de exemplu un fișier din MS Project sau Primavera P6, aplicația afișează regula de lucru pentru acel fișier chiar fără această setare. Același lucru se întâmplă din momentul în care alegeți dumneavoastră o regulă de lucru într-un fișier: afișarea rămâne atunci activată pentru acel fișier, chiar dacă dezactivați din nou setarea. Afișarea rămâne activată cât timp fișierul este deschis și, după redeschidere, atâta timp cât fișierul conține o regulă de lucru sau lucru stocat.

### Alegerea unei reguli

1. Selectați activitatea. Panoul *Proprietăți* se află în dreapta; dacă nu îl vedeți, activați-l cu *Vizualizare › Panouri › Proprietăți*.
2. La *Regulă de lucru*, alegeți una dintre cele cinci opțiuni: *Standard de proiect (Durată fixă și unități fixe)*, *Durată fixă și unități fixe*, *Durată fixă și lucru*, *Muncă fixă* sau *Unități fixe*. Cu *Standard de proiect*, activitatea urmează standardul proiectului.
3. Sub lista derulantă, aplicația arată ce protejează regula, de exemplu *Protejat: lucru (durata urmează unitățile de atribuire)*.

*Standard de proiect* este prima opțiune și este ce are implicit o activitate. Regula dintre paranteze este cea pe care proiectul o are în prezent ca valoare implicită. Aplicația nu are un buton pentru a schimba standardul proiectului: acesta vine dintr-un import (de exemplu din MS Project sau Primavera P6) sau din conexiunea MCP. Dacă doriți altă regulă pentru o singură activitate, alegeți-o aici.

Regula o puteți alege și în tabel. Faceți clic pe **+** din dreapta antetului tabelului de activități (*Adăugare coloană*) și, sub *Planificare*, alegeți coloana *Regulă de lucru*.

O activitate fără atribuire nu are nimic de legat, deci regula nu face nimic acolo. Atribuiți mai întâi o resursă (vedeți [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen)).

### Vizualizarea și modificarea lucrului

Pentru o activitate cu atribuiri apare o coloană *Lucru (rămas)* în secțiunea *Atribuiri* din panoul *Proprietăți*, lângă *Unit./zi*. Aceasta este lucrul rămas al acelei resurse, în ore. Deasupra unei coloane apare un lacăt mic, care arată ce menține regula: *Unit./zi* cu *Durată fixă și unități* și cu *Unități fixe*, *Lucru (rămas)* cu *Durată fixă și lucru* și cu *Muncă fixă*.

Dacă doriți să modificați lucrul singur, scrieți orele în câmp și apăsați Enter. Aplicația nu acceptă o valoare de 0 sau mai mică: câmpul revine la valoarea anterioară.

### Ce se întâmplă

Dacă alegeți o regulă, încă nu se schimbă niciun număr. Sub o regulă care protejează lucrul, aplicația fixează doar lucrul actual, astfel încât *Lucru (rămas)* are o valoare stocată. Abia la următoarea modificare regula decide ce urmează să se modifice. Modificați, de exemplu, *Unit./zi* și vedeți ce se întâmplă cu durata și cu lucrul.

Dacă aceasta modifică durata activității, bara de stare afișează *Învechit — recalculați (F5)*. Apăsați **Calculare** (F5), de exemplu din *Acasă › Planificare › Calculare*, pentru a vedea datele noi. Dacă *Calculare automată* este activată (în aceeași filă *Planificare*, sub titlul *Calculare*), aplicația face asta singură.

## Ce regulă se potrivește

- **Durată fixă și unități** se potrivește când durata este o convenție și unitățile de atribuire sunt ce introduceți dumneavoastră. Lucrul rezultă din cele două. Aceasta este opțiunea implicită. Macaraua închiriată pentru o zi aparține aici: ziua este fixă, iar dumneavoastră decideți câte macarale sunt pe ea.
- **Durată fixă și lucru** se potrivește când activitatea trebuie încheiată într-un termen fix și știți cât lucru are. Dacă durata se modifică, aplicația ajustează unitățile de atribuire.
- **Muncă fixă** se potrivește când știți câte ore de lucru are și doriți să vedeți cum variază durata în funcție de numărul de persoane. Cele 160 de ore de zidărie cu trei persoane, în loc de două, aparțin aici. Tencuiala din proiectul de exercițiu primește această regulă.
- **Unități fixe** se potrivește când unitățile de atribuire sunt fixe, de exemplu o macara, iar lucrul decide durata.

## Capcane și ce face aplicația atunci

**Câmpul *Regulă de lucru* lipsește.** Atunci setarea *Afișare reguli de lucru și lucru* este dezactivată și fișierul nu are încă reguli de lucru, sau ați selectat un jalon, o fază, un hamac sau o activitate cu tipul de durată *Timp scurs*. Acolo nu există o regulă de lucru. Selectați o activitate obișnuită.

**Durata se modifică fără ca dumneavoastră s-o modificați.** Sub *Muncă fixă* și *Unități fixe*, durata rezultă din unitățile de atribuire și din lucru. Dacă modificați unul dintre acestea sau numărul de resurse, aplicația ajustează durata, rotunjită în sus la zile lucrătoare întregi. Pentru o activitate exprimată în ore, aplicația rotunjește în sus la minute întregi.

**Lucrul nu corespunde exact unităților de atribuire × durată.** Rotunjirea poate fi motivul. Lângă *Lucru (rămas)* apare atunci un semn de avertizare, *Diferă de unități de atribuire × durată*. Histograma urmează lucrul stocat.

**Materialul nu contează.** Pentru o resursă de tip material, *Lucru (rămas)* afișează o liniuță. Materialul nu determină niciodată durata.

**O activitate cu progres.** Regula lucrează cu partea rămasă. Astfel, *Lucru (rămas)* arată doar ce mai trebuie făcut.

**Anularea.** Alegerea unei reguli și fiecare modificare pe care o calculează regula reprezintă un singur pas pentru *Anulare* (Ctrl+Z). Regula dispare atunci din nou, dar câmpul *Regulă de lucru* rămâne vizibil.

## Vezi și

- [Reguli de lucru: durată, unități de atribuire și lucru](docs://uitleg-werkregels): cum leagă aplicația durata, unitățile de atribuire și lucrul, cu exemple lucrate.
- [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen): cum puneți o resursă pe o activitate.
