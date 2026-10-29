# Panou resurse

Panoul resurse este locul unde gestionați resursele: cine și ce este disponibil, cu ce capacitate și pe ce calendar. Histograma de sub diagrama Gantt și supraalocarea fac parte din acesta. Acest articol explică, pentru fiecare câmp și buton, ce face, care este valoarea implicită și ce observați. Cum creați și atribuiți resurse este descris în [Gestionarea resurselor](docs://howto-resources-beheren) și [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen). Rezolvarea supraalocării este descrisă în [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen).

## Unde îl găsiți

- **Panou complet** — *Resurse › Gestionare › Resurse* sau *Vizualizare › Panouri › Resurse*. Ocupă tot spațiul de lucru; crucea din dreapta sus îl închide.
- **Andocare resurse** — *Resurse › Gestionare › Andocare resurse* sau *Vizualizare › Panouri › Andocare resurse*: o listă compactă în coloana din dreapta, lângă diagrama Gantt. Consultați mai jos.
- **Histogramă** — *Resurse › Histogramă › Histogramă* sau *Vizualizare › Panouri › Histogramă*: o bandă sub diagrama Gantt. Consultați mai jos.
- **Vizualizări** — dacă proiectul dumneavoastră aparține unei biblioteci de resurse, în colțul din dreapta sus al panoului puteți alege între *Bibliotecă*, *Proiect* și *Ocupare*. Fără bibliotecă există doar tabelul proiectului. De fiecare dată când îl deschideți, panoul pornește pe *Proiect*, astfel încât să nu ajungeți în biblioteca comună fără să observați.

## Resursă nouă

- **Resursă nouă în proiect** (în vizualizarea *Bibliotecă*, *Resursă nouă în bibliotecă*) — buton în dreapta sus. Deschide un rând ciornă la capătul tabelului. Nimic nu se creează până când introduceți un nume și părăsiți rândul (sau apăsați Enter). Dacă faceți clic în altă parte cu rândul gol sau apăsați Esc, nu rămâne nimic în urmă: nicio resursă și niciun pas sub *Anulare*. Puteți completa câmpurile în orice ordine; totul se salvează deodată. Enter sau săgeata în jos confirmă rândul și deschide un rând ciornă nou; Shift+Enter sau săgeata în sus confirmă rândul și revine în tabel. Rândul ciornă nu are butonul de extindere pentru capacitate, creionul pentru calendar și coșul de gunoi, pentru că acestea lucrează cu o resursă care încă nu există. Butonul *Resursă nouă* din *Resurse › Gestionare* face același lucru.
- **Navigarea în tabel** — în tabel, Enter și Shift+Enter, precum și săgețile în sus și în jos, mută cursorul între rânduri. Enter pe ultimul rând deschide un rând ciornă nou.

## Vizualizarea Proiect

Tabelul cu ceea ce folosește acest proiect. Fiecare rând este o resursă. Modificările de text și de tarif intră în vigoare imediat ce părăsiți câmpul și contează ca un pas sub *Anulare*.

- **Culoare** — un selector de culoare. Implicit: prima culoare liberă din paletă. Efect: culoarea accentului resursei sub barele Gantt (*Vizualizare › Referințe și progres › Accent resursă*) și a pătrățelului din andocare.
- **Nume** — numele resursei. Un nume gol nu se păstrează; câmpul revine la numele vechi.
- **Tip** — *Forță de muncă*, *Utilaj*, *Material*, *Subcontractant* sau *Echipă*. Implicit pentru o resursă nouă: *Forță de muncă*. Efect: *Material* are o *Unitate de măsură* și nu se numără în suma *Toate resursele* a histogramei; redistribuirea sare peste material. *Echipă* poate fi aleasă ca *Echipă* pentru alte resurse. Celelalte tipuri se calculează la fel.
- **Capacitate maximă** — cât din resursă este disponibil pe zi, un număr mai mare decât 0 (fracțiile sunt permise). Implicit: 1. Efect: capacitatea pe zi. Dacă încărcarea este mai mare, resursa este supraalocată. Săgeata de lângă ea desfășoară *Capacitate pe etape de timp*; numărul de lângă săgeată este numărul de pași.
- **Capacitate pe etape de timp** — pași cu *De la* (o dată) și *Capacitate maximă*. *Adăugare pas* adaugă un pas cu data de azi și valoarea 1. Fără pași, apare *Niciun pas — se aplică mereu capacitatea maximă fixă.* Efect: de la data unui pas se aplică *Capacitate maximă* a acestuia în locul valorii fixe; câștigă ultimul pas cu o dată egală sau anterioară zilei respective.
- **Calendar** — o listă cu *Calendar de proiect* (implicit), calendarele proiectului și *+ Calendar de resursă* pentru unul nou. Creionul (*Editare…*) deschide calendarul ales și este dezactivat pentru *Calendar de proiect*. Efect: zilele în care lucrează resursa. În ziua liberă capacitatea este 0; dacă este planificat lucru în acea zi, resursa este supraalocată, cu motivul *Nu lucrează în această zi conform calendarului „…”*. Calendarul resursei nu schimbă datele unei activități. Consultați [Ferestrele calendarului](docs://ref-kalenders).
- **Tarif standard/oră** — costul pe oră. Gol = fără tarif; un număr nevalid revine la valoarea anterioară. Efect: nicio influență asupra planificării sau a încărcării. Tariful standard determină coloana *Total*, este salvat în fișierul IFC și este scris și la exportul în MS Project (tarif standard) și în XML Primavera P6 (cost pe unitate).
- **Total** — doar în citire: orele încărcate × tarif standard, cu două zecimale; *—* fără tarif sau încărcare. La capăt, un rând *Total* adună toate resursele. Orele vin din ultimul calcul și se numără ca unități de atribuire × ore pe zi din calendarul activității. Sunt învechite? Apăsați *Calculare*.
- **Unitate de măsură** — unitatea de măsură a materialului, de exemplu `m³`. Este de completat numai pentru tipul *Material* (text de ajutor: *Se completează numai pentru resursele de tip Material.*). Efect: doar o etichetă; nu face calcule.
- **Echipă** — echipa din care face parte resursa, dintre resursele de tip *Echipă*. Implicit: *Niciuna*. Efect: doar grupare; capacitatea și încărcarea unei echipe nu sunt suma membrilor ei.
- **Ștergere** (coșul de gunoi) — șterge resursa. Dacă are atribuiri, aplicația întreabă mai întâi *„…” are … atribuire(i) — ștergeți?* cu o bifă pentru confirmare și o cruce pentru anulare.
- **Către bibliotecă** — doar când proiectul aparține unei biblioteci de resurse, pentru o resursă a cărei nume nu vine încă din bibliotecă. O pune în bibliotecă sau o leagă de un element existent cu același nume și arată ce s-a întâmplat (*Adăugat.*, *Exista deja în bibliotecă — acum este legat.* sau *Legat de elementul existent din bibliotecă — valorile diferă, vedeți marcajul.*).
- **Desprindere de bibliotecă** — pictograma de desprindere de pe o resursă care vine din bibliotecă. Elimină originea; după aceea toate câmpurile sunt din nou libere.

Fără resurse, apare *Nicio resursă încă. Adăugați una pentru a începe.* Dacă proiectul aparține unei biblioteci, apare *Acest proiect nu folosește încă resurse din bibliotecă.* cu o sugestie.

### Resurse din bibliotecă

Resursa care vine din bibliotecă are o pictogramă mică de bibliotecă (*Din bibliotecă*). Câmpurile *Nume*, *Tip*, *Tarif standard/oră* și *Unitate de măsură* sunt atunci doar text (*Valoare din bibliotecă — modificați-o în vizualizarea Bibliotecă sau desprindeți această resursă de bibliotecă.*), pentru că biblioteca decide ce este resursa. *Culoare*, *Capacitate maximă*, pașii de capacitate, *Calendar* și *Echipă* rămân editabile, pentru că proiectul decide cât și când. Pot apărea două insigne: *diferă — decideți* (un clic deschide fereastra *Legare bibliotecă de resurse*) și *nu mai este în bibliotecă*, cu butonul *Eliminare din proiect*.

## Vizualizarea Bibliotecă

Doar când proiectul aparține unei biblioteci de resurse. Consultați [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken) și [Gestionarea și partajarea bibliotecilor de resurse](docs://howto-bibliotheken-beheren). Sus este un avertisment colorat: *Aceasta modifică biblioteca și se aplică tuturor proiectelor — nu poate fi anulată.* Tabelul are aceleași câmpuri ca vizualizarea *Proiect*, cu aceste diferențe:

- Nu există coloana *Total*: aceasta este un calcul pentru un singur proiect.
- Coloana *Echipă* apare imediat ce biblioteca are resurse.
- Coloana *Calendar* oferă calendarele bibliotecii, cu *Fără calendar* ca implicit.
- **Atribuire la proiect** — pune resursa în proiect, cu o copie a calendarului ei. Arată *Adăugat.* sau *Există deja în proiect.*
- **Ștergere** — întreabă *Eliminați „…” din bibliotecă? Aceasta se aplică tuturor proiectelor și nu poate fi anulată.*
- Fără resurse, apare *Nu există încă resurse în bibliotecă.*

## Vizualizarea Ocupare

O vizualizare doar în citire a tuturor documentelor deschise: ce resurse din bibliotecă sunt rezervate unde. Nu există buton pentru o resursă nouă. Consultați [Utilizarea prezentării generale a ocupării](docs://howto-bezettingsoverzicht-gebruiken).

- **Tabel** — pentru fiecare resursă din bibliotecă: *Nume*, *Documente* (numărul de documente în care apare), *Perioadă* și *Vârf / Capacitate* (cea mai mare încărcare combinată față de capacitate în ziua respectivă). Un text roșu *N zile cu supraalocare* înseamnă că, în mai multe documente, resursa are mai mult decât capacitatea ei. Săgeata de lângă un nume desfășoară documentele, fiecare cu perioadă și vârf; un clic pe un rând arată histograma acelei resurse (*Selectați o resursă pentru a vedea histograma.*).
- **Ce se numără** — doar documentele deschise în această aplicație (*Această prezentare vede doar documentele deschise în această aplicație.*). Un document care nu a fost calculat primește un mesaj pe rândul său. Documentul activ se numără cu ultimele cifre calculate (*Învechit: acestea sunt ultimele cifre calculate — apăsați F5 în acest document.*). Un alt document este calculat în avans de prezentare (*Calculat din timp pentru această prezentare — documentul în sine arată datele mai vechi până apăsați F5 acolo sau activați „Calculare automată”.*); dacă *Calculare automată* este activată, prezentarea calculează chiar aceste documente. Dacă calculul eșuează, documentul nu se numără (*Nu se numără: planificarea nu este calculată — activați acest document și apăsați F5.*). Fără resurse rezervate, apare *Nicio resursă din bibliotecă nu este rezervată în documentele deschise.*
- **Ordine** — resursele cu supraalocare sunt sus: întâi cele cu cele mai multe zile cu supraalocare, apoi alfabetic.

## Andocare resurse

O listă compactă în coloana din dreapta, lângă panoul *Proprietăți*. Pentru fiecare resursă: un pătrățel de culoare, numele (doar în citire), un triunghi roșu *Supraalocată* de îndată ce resursa are cel puțin o zi cu supraalocare, și *Capacitate maximă* pentru editare. Dacă există o selecție de activități, apar doar resursele acelor activități. În antet se află *Panou complet* (deschide panoul complet) și *Închidere panou*. Fără resurse, apare *Nicio resursă încă. Adăugați una pentru a începe.*

## Histograma

O bandă sub diagrama Gantt care arată încărcarea unei resurse pe zi. Activați-o sau dezactivați-o cu *Resurse › Histogramă › Histogramă* sau *Vizualizare › Panouri › Histogramă*. Implicit: dezactivată; alegerea dumneavoastră este reținută. Înălțimea este implicit de 160 de pixeli și se poate trage de marginea dintre diagrama Gantt și histogramă.

- **Selector** — în stânga, sub tabelul de activități, este o listă: *Toate resursele* fixat sus, sub el câte un rând pentru fiecare resursă. Un clic alege rândul, tastele cu săgeată îl parcurg, iar *Resurse › Histogramă › Anterior* și *Următorul* fac același lucru. Un punct roșu lângă un rând înseamnă că resursa are cel puțin o zi cu supraalocare; pentru *Toate resursele*, punctul ia în calcul doar resursele care nu sunt material. Dacă există o selecție de activități, lista conține doar resursele acelor activități; dacă resursa aleasă nu se află în ea, banda arată temporar *Toate resursele* din selecție.
- **Bare** — o bară pe zi: încărcarea în *unități*. O linie arată capacitatea; partea din bară peste capacitate este roșie. Sus, în stânga, este cea mai mare valoare cu *unități*. *Toate resursele* adună încărcarea și capacitatea tuturor resurselor, cu excepția materialului.
- **Infobulă** — țineți mouse-ul nemișcat o clipă peste o zi: *N activități contribuie la {date}*, cu numele a cel mult opt activități. Pentru o resursă aleasă și o zi în care calendarul ei nu lucrează, apare și *Nu lucrează în această zi conform calendarului „…”*.
- **Mesaje în bandă** — *Recalculați (F5) pentru a afișa încărcarea* cât timp nu există încărcare, *Nicio resursă încă* fără resurse și *⚠ Planificare învechită — recalculați (F5)* în dreapta sus, când planificarea este învechită.
- **Ce se numără** — unitățile de atribuire pe zi ale fiecărei atribuiri, împărțite pe zilele lucrătoare ale activității, conform *Curbă* (sau *Distribuție ore*); doar activitățile frunză, fără jaloane. Încărcarea se reîmprospătează după *Calculare* și după modificările resurselor și atribuirilor; dacă modificați datele activităților, se ia în calcul doar după *Calculare*.

## Supraalocarea

O resursă este supraalocată într-o zi dacă încărcarea ei este mai mare decât capacitatea. Capacitatea este *Capacitate maximă* (cu pașii de capacitate) într-o zi lucrătoare a calendarului ei și 0 într-o zi liberă. Aici materialul se numără. Motivul este fie prea puțină capacitate, fie o zi în care resursa nu lucrează conform calendarului ei.

Unde o vedeți:

- **Resurse › Supraalocare** — numărul de resurse supraalocate, sau *Niciuna*.
- **Bara de stare** — *N resursă(e) supraalocată(e)*; un clic deschide panoul *Avertismente*.
- **Avertismente** — câte un rând pentru fiecare resursă: *Supraalocare în N zi(le) (prima – ultima)*, cu *resursa nu lucrează în aceste zile conform calendarului ei* adăugat dacă toate zilele sunt zile libere, sau *din care N zi(le) resursa nu lucrează conform calendarului ei* pentru un amestec. Consultați [Notificări și avertismente](docs://ref-meldingen).
- **Histogramă** — părțile roșii ale barelor și punctul roșu din selector.
- **Andocare** — triunghiul *Supraalocată*.

Redistribuirea poate rezolva supraalocarea, lăsând activitățile să înceapă mai târziu. Implicit, sfârșitul proiectului se poate muta; cu *redistribuire* rămâne în limitele marjei. Redistribuirea nu rezolvă o resursă care trebuie să lucreze într-o zi liberă. Consultați [Redistribuire](docs://uitleg-nivelleren).
