# Tipuri de activitate: durată, unități și lucru

Puneți un tencuitor la tencuială, iar activitatea durează patru zile. Dacă adăugați un al doilea tencuitor, lucrarea poate fi gata în două zile. Ea poate rămâne și patru zile, dar cu de două ori mai mult lucru. Ambele variante au sens. Aplicația alege una dintre variante în funcție de **tipul de activitate**. În acest articol citiți cum leagă aplicația durata, unitățile de atribuire și lucrul și ce menține constant fiecare tip de activitate.

## Conceptul

Trei mărimi sunt legate între ele:

- **Durată**: cât durează activitatea, în zile lucrătoare sau în ore.
- **Unități de atribuire**: cât lucrează o resursă la activitate pe zi lucrătoare. În panoul *Proprietăți* se numește *Unități de atribuire*, în alte ferestre *Unit./zi*. Valoarea 1 înseamnă un tencuitor pentru toată ziua, 2 înseamnă doi, iar 0,5 înseamnă o jumătate de zi.
- **Lucru**: numărul total de ore pe care resursa le petrece la activitate.

Suma este: lucru = durată × unități × ore pe zi lucrătoare. Orele pe zi lucrătoare vin din calendarul activității. Tencuiala durează patru zile lucrătoare cu un tencuitor. Cu o zi lucrătoare de 8 ore, lucrul este de 4 × 1 × 8 = 32 de ore.

Dacă modificați una dintre cele trei mărimi, cel puțin una dintre celelalte două trebuie să se modifice, altfel formula nu mai este valabilă. Tipul de activitate decide care. Îl setați pe activitate, în panoul *Proprietăți*. Aplicația afișează tipul de activitate și lucrul abia după ce le activați. Cum funcționează, aflați în [Alegerea unui tip de activitate](docs://howto-werkregel-kiezen).

Tipul de activitate funcționează doar la activitățile obișnuite. Jaloanele, fazele (activitățile rezumat), hamacele și activitățile ale căror *Tip durată* este *Timp scurs* nu au unul: câmpul *Tip de activitate* nu apare. Materialul, de exemplu beton sau mortar de tencuială, nu intră nici el în calcul. Cantitatea de material nu determină niciodată durata, iar aplicația nu o ajustează niciodată din cauza unui tip de activitate.

## Cum calculează aplicația

### Tipul de activitate acționează asupra a ceea ce modificați

Aplicația recalculează durata, unitățile de atribuire și lucrul doar în momentul în care modificați unul dintre ele: durata activității, unitățile de atribuire, lucrul, o resursă adăugată sau scoasă, ori orele pe zi dintr-un calendar. **Calculare** (F5) nu modifică niciunul dintre ele: F5 calculează doar datele. Nici alegerea unui tip de activitate nu schimbă vreun număr. Tipul de activitate se aplică la următoarea dumneavoastră modificare.

Dacă un tip de activitate modifică durata activității, planificarea devine învechită. Bara de stare arată atunci *Învechit — recalculați (F5)*, cu excepția cazului în care *Calculare automată* este activată.

### Patru tipuri de activitate

În panoul *Proprietăți* există o pictogramă i lângă lista derulantă *Tip de activitate*. Treceți cu cursorul peste ea, faceți clic pe ea sau atingeți-o, iar aplicația explică tipul de activitate care se aplică acum. În lista derulantă deschisă, fiecare opțiune are și ea o pictogramă i. Explicația începe cu o propoziție îngroșată. Cele patru tipuri de activitate, cu propoziția respectivă din aplicație:

- **Durată fixă și unități fixe** (*Lucrul rezultă din durată și din unități de atribuire.*). Acesta este tipul implicit. Aplicația nu modifică niciodată durata, iar lucrul rezultă din durată și din unități de atribuire. Dacă scrieți singur lucrul, aplicația ajustează unitățile de atribuire, pentru că durata este fixă.
- **Durată fixă și lucru** (*Unitățile de atribuire rezultă din durată și din lucru.*). Aplicația nu modifică niciodată durata. Dacă modificați durata, lucrul rămâne, iar unitățile de atribuire se ajustează.
- **Muncă fixă** (*Durata rezultă din lucru și din unități de atribuire.*). Lucrul este fixat, iar durata rezultă din lucru și din unități de atribuire.
- **Unități fixe** (*Durata rezultă din lucru și din unități de atribuire.*). Unitățile de atribuire sunt fixate, iar durata rezultă din lucru.

Deci două tipuri de activitate lasă durata neatinsă. La celelalte două, durata se modifică odată cu unitățile de atribuire, lucrul sau numărul de resurse. Cu o singură resursă, muncă fixă și unități fixe fac exact același lucru. Ele diferă atunci când modificați singur durata: la muncă fixă lucrul rămâne și unitățile de atribuire se ajustează, iar la unități fixe unitățile de atribuire rămân și lucrul crește odată cu durata. Ele diferă și când sunt mai multe resurse pe activitate (vezi mai jos).

Exemplele rezolvate de mai jos arată ce face fiecare tip de activitate.

### Rotunjire

Durata care rezultă din sumă este rotunjită în sus de aplicație. Pentru o activitate în zile, rotunjirea se face la zile lucrătoare întregi, pentru o activitate în ore, la minute întregi. Lucrul și unitățile de atribuire rămân cele pe care le-ați introdus sau cele pe care aplicația le-a luat din sumă. Din acest motiv formula nu mai este uneori exact valabilă. Exemplul de mai jos arată ce se întâmplă atunci.

### Mai multe resurse

Dacă o activitate are mai multe resurse, se aplică două principii. La durată fixă și lucru, la muncă fixă și la unități fixe, lucrul total rămâne același când adăugați sau scoateți o resursă. Aplicația îl împarte atunci proporțional cu unitățile de atribuire. La durată fixă și unități fixe, o resursă nouă aduce în schimb lucrul ei. La muncă fixă și la unități fixe, resursa cea mai lentă decide durata: pentru fiecare resursă, aceasta este lucrul împărțit la unitățile de atribuire, iar contează cel mai mare rezultat.

Un exemplu: două resurse au fiecare 32 de ore de lucru și unități de atribuire de 1, adică 4 zile lucrătoare împreună. Setați unitățile de atribuire ale primei resurse la 0,5. Durata devine atunci 8 zile lucrătoare. La muncă fixă, a doua resursă își păstrează cele 32 de ore de lucru, iar unitățile ei de atribuire scad la 0,5. La unități fixe, a doua resursă își păstrează unitățile de atribuire de 1, iar lucrul ei crește la 64 de ore.

### Progres

Dacă activitatea are deja progres, tipul de activitate lucrează cu partea rămasă: durata rămasă și lucrul rămas. În panoul *Proprietăți*, acest lucru se află în coloana *Lucru (h)*. Ce s-a făcut deja rămâne.

### Activități în ore

O activitate pe ore se calculează la fel, dar în minute. Dacă pe o activitate de 5 ore este doar macaraua, atunci lucrul este de 5 ore. La muncă fixă, durata pentru unități de atribuire de 2 devine atunci 2,5 ore. Planșeul din plăci alveolare din proiectul de exercițiu are pe ea și echipa de dulgherie. Ea are nevoie tot de 5 ore de lucru, este cea mai lentă, așa că durata rămâne 5 ore. Cum se leagă orele de zile este explicat în [Zile și ore](docs://uitleg-dagen-en-uren).

## Exemplu lucrat: tencuiala

Exemplul este proiectul de exercițiu din tutoriale, *House extension*. În tutorialul 5 faceți singur calculul și verificați cifrele. Aici citiți ce face fiecare tip de activitate.

Tencuiala durează 4 zile lucrătoare. Un tencuitor este atribuit la ea, cu unități de atribuire de 1, iar ziua lucrătoare are 8 ore. Deci lucrul este de 32 de ore.

### Durată fixă și unități fixe

- Faceți durata de 6 zile lucrătoare: lucrul crește la 48 de ore, unitățile de atribuire rămân 1.
- Setați unitățile de atribuire la 2: durata rămâne 4 zile lucrătoare, lucrul devine 64 de ore.
- Introduceți 48 de ore în *Lucru (h)*: durata rămâne 4 zile lucrătoare, unitățile de atribuire devin 1,5.
- Atribuiți o a doua resursă, de exemplu *Plasterer 2*, cu unități de atribuire de 1: durata rămâne 4 zile lucrătoare, iar a doua resursă aduce 32 de ore de lucru, 64 de ore împreună.

### Durată fixă și lucru

- Faceți durata de 6 zile lucrătoare: lucrul rămâne 32 de ore, unitățile de atribuire scad la 0,67.
- Setați unitățile de atribuire la 2: durata rămâne 4 zile lucrătoare. Pentru că durata este fixă, lucrul crește și el până la 64 de ore.
- Introduceți 16 ore în *Lucru (h)*: durata rămâne 4 zile lucrătoare, unitățile de atribuire devin 0,5.
- Atribuiți o a doua resursă, de exemplu *Plasterer 2*, cu unități de atribuire de 1: cele 32 de ore se împart, câte 16 ore fiecare, iar unitățile de atribuire devin 0,5 pentru amândoi. Durata rămâne 4 zile lucrătoare.

### Muncă fixă

- Faceți durata de 6 zile lucrătoare: lucrul rămâne 32 de ore, unitățile de atribuire scad la 0,67.
- Setați unitățile de atribuire la 2: lucrul rămâne 32 de ore, iar durata devine 2 zile lucrătoare. Acesta este pasul pe care îl faceți în tutorialul 5.
- Introduceți 48 de ore în *Lucru (h)*: unitățile de atribuire rămân 1, iar durata devine 6 zile lucrătoare.
- Atribuiți o a doua resursă, de exemplu *Plasterer 2*, cu unități de atribuire de 1: cele 32 de ore se împart, câte 16 ore fiecare, iar durata devine 2 zile lucrătoare. Scoateți din nou a doua resursă, iar durata este din nou 4 zile lucrătoare.

### Unități fixe

- Faceți durata de 6 zile lucrătoare: unitățile de atribuire rămân 1, lucrul crește la 48 de ore.
- Setați unitățile de atribuire la 2: lucrul rămâne 32 de ore, iar durata devine 2 zile lucrătoare.
- Introduceți 48 de ore în *Lucru (h)*: unitățile de atribuire rămân 1, iar durata devine 6 zile lucrătoare.
- Atribuiți o a doua resursă, de exemplu *Plasterer 2*, cu unități de atribuire de 1: cele 32 de ore se împart, câte 16 ore fiecare, iar durata devine 2 zile lucrătoare.

### Când suma nu iese

La muncă fixă setați unitățile de atribuire la 3. Lucrul este de 32 de ore, deci durata devine 32 ÷ (3 × 8) = 1,33 zile lucrătoare. Aplicația rotunjește în sus la 2 zile lucrătoare. Lucrul (32 de ore) și unitățile de atribuire (3) rămân, dar 2 × 3 × 8 fac 48 de ore. Histograma distribuie deci cele 32 de ore pe cele 2 zile lucrătoare: câte 2 unități de atribuire pe zi, nu 3. În câmpul *Lucru (h)* apare un semn de avertizare, *Diferă de unități de atribuire × durată*, care arată acest lucru.

Cu două resurse cu unități de atribuire diferite, funcționează la fel. Dacă, la muncă fixă, adăugați o a doua resursă, de exemplu *Plasterer 2*, cu unități de atribuire de 2 la tencuitorul cu unități de atribuire de 1, aplicația împarte cele 32 de ore în raportul 1 : 2, adică 10,7 și 21,3 ore. Fiecare are atunci nevoie de 1,33 zile lucrătoare. Durata devine 2 zile lucrătoare.

Un fișier din P6 sau MS Project poate avea și un *Lucru (rămas)* care nu este egal cu unități × durată rămasă. Atunci apare același semn de avertizare. Aplicația nu modifică singură acest lucru. Dacă modificați durata unei astfel de activități, aplicația urmează tipul de activitate, și atunci când lucrul rămas a venit din fișier. La *Durată fixă și unități fixe* și la *Unități fixe*, lucrul rămas devine unități × noua durată rămasă. La *Durată fixă și lucru* și la *Muncă fixă*, lucrul rămâne și unitățile de atribuire se ajustează. Dacă un lucru rămas din fișier dispare astfel, primiți o notificare cu vechiul și noul număr de ore. Ctrl+Z restabilește vechea valoare. Explicația de lângă semnul de avertizare vă spune, pentru fiecare activitate, care dintre cele două se întâmplă.

### Un alt calendar

La muncă fixă, ziua lucrătoare din calendar trece de la 8 la 6 ore. Lucrul rămâne 32 de ore, deci durata devine 32 ÷ 6 = 5,33, rotunjită în sus la 6 zile lucrătoare. Cum numără aplicația zilele lucrătoare și orele de lucru este explicat în [Calendare și zile lucrătoare](docs://uitleg-kalenders). Aplicația afișează: *După modificarea calendarului, tipul de activitate a ajustat durata pentru 1 activitate (lucrul rămâne, orele pe zi s-au schimbat).*

### Activitate cu progres

Inner cavity leaf necesită 5 zile lucrătoare și este gata în proporție de 40%: sunt gata 2 zile lucrătoare, iar 3 zile lucrătoare (24 de ore) rămân. La muncă fixă setați unitățile de atribuire de la 1 la 2. Lucrul rămas rămâne 24 de ore, iar durata rămasă devine 1,5, rotunjită în sus la 2 zile lucrătoare. Activitatea durează acum 2 + 2 = 4 zile lucrătoare, iar progresul este de 50%. Procentul se modifică, pentru că partea făcută rămâne aceeași, iar restul devine mai scurt.

## Consecințe și concepții greșite

**„Muncă fixă înseamnă că durata este fixă.”** Nu, dimpotrivă. La *Durată fixă și unități fixe* și la *Durată fixă și lucru*, durata este fixă. La *Muncă fixă* și la *Unități fixe*, durata rezultă din celelalte două.

**„Dacă aleg un tip de activitate, planificarea mea se schimbă.”** Nu. Alegerea nu schimbă niciun număr. Abia la următoarea dumneavoastră modificare tipul de activitate decide ce se mută. La un tip de activitate care protejează lucrul, aplicația fixează lucrul în momentul alegerii, ca să existe un număr de protejat. O astfel de activitate are atunci un *Lucru (h)* salvat.

**„Durata s-a schimbat fără să o ating eu.”** Asta se poate întâmpla după o modificare a unităților de atribuire, a lucrului, a numărului de resurse sau a orelor pe zi, la muncă fixă sau la unități fixe. Bara de stare arată atunci că planificarea este învechită. Apăsați **Calculare** (F5) ca să vedeți datele noi.

**Fără atribuire, un tip de activitate nu face nimic.** Atunci nu există unități de atribuire și nici lucru de legat de durată.

**Fișierele din MS Project sau Primavera P6 arată întotdeauna tipul de activitate.** Pentru o activitate din MS Project, aplicația păstrează uneori setarea determinată de efort. Această setare salvată schimbă două cazuri. La *Durată fixă și lucru* și activitate determinată de efort, lucrul se modifică odată cu durata, nu odată cu unitățile. La *Unități fixe* și activitate care nu este determinată de efort, lucrul se modifică atunci când adăugați sau scoateți o resursă, iar durata rămâne. Activitățile create în aplicație nu au această setare. Explicația din spatele pictogramei i ține cont de această setare.

## Vezi și

- [Alegerea unui tip de activitate](docs://howto-werkregel-kiezen): pașii pentru a seta tipul de activitate al unei activități.
- [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen): cum puneți o resursă pe o activitate, cu unități de atribuire și distribuție.
- [Zile și ore](docs://uitleg-dagen-en-uren): cum convertește aplicația zilele și orele.
- [Calendare și zile lucrătoare](docs://uitleg-kalenders): cum numără aplicația zilele lucrătoare și orele de lucru.
