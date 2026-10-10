# Fereastra activității și panoul de proprietăți

Puteți modifica o activitate în două locuri: în fereastra *Editare activitate* și în panoul *Proprietăți*. Cele două locuri au aproape toate câmpurile în comun. Acest articol explică, pentru fiecare câmp, ce face, care este valoarea implicită și ce observați. Cum creați și configurați o activitate este descris în [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen). De ce calculul ajunge la aceste date este explicat în [Drumul critic și marja](docs://uitleg-kritiek-pad).

## Cele două locuri

- **Editare activitate** — fereastra pentru prima activitate selectată. Deschideți-o cu F2, dând dublu clic pe o bară din Gantt, sau dând clic dreapta pe o activitate din Gantt sau din tabel și alegând *Editare...*. Modificările dumneavoastră rămân într-o ciornă până când dați clic pe *Salvare* (Enter); *Anulare* (Esc) le elimină. *Salvare* este dezactivat cât timp numele este gol. Salvarea este un singur pas de *Anulare*, inclusiv ce ați făcut în secțiunile *Regulă de lucru*, *Dependențe*, *Atribuiri* și *Coduri și câmpuri*: acestea acționează deja asupra proiectului în timp ce editați, iar *Anulare* le inversează.
- **Proprietăți** — panoul din coloana din dreapta, pentru activitatea activă. Fiecare modificare se aplică imediat; modificările succesive ale aceluiași câmp contează ca un singur pas de *Anulare*. Dacă nu este selectată nicio activitate, apare mesajul *Selectați o activitate pentru a vedea proprietățile.* Activați-l sau dezactivați-l cu *Vizualizare › Panouri › Proprietăți*. Implicit: activat. Panoul se află lângă Gantt și pe fila *Tabel*, nu pe *IFC* și nu pe *Raport* și nu sub panoul de resurse complet.

Numai în fereastră: *Activitate superioară* și butoanele *Salvare* și *Anulare*. Numai în panou: pictograma coș *Ștergere activitate*, butonul *Calculare* din partea de jos, secțiunea *Întreruperi*, cele trei marcaje de sub *Regulă de lucru* (perioadă lungă nelucrătoare, MS Project, date înregistrate) și adăugarea de dependențe și trecerea la o activitate legată din *Dependențe*. Toate celelalte câmpuri apar în ambele locuri. Fereastra afișează *Dependențe*, *Atribuiri* și *Coduri și câmpuri* numai pentru o activitate existentă.

Dacă ați modificat ceva ce atinge datele, apăsați *Calculare*. Calculul nu are loc singur, decât dacă *Calculare automată* este activată.

## Generalități

- **Nume** (în fereastră *Nume \**) — numele activității în Gantt, în tabel și în rapoarte. Obligatoriu: un nume gol nu se păstrează. Implicit pentru o activitate nouă: *Activitate nouă*.
- **Cod WBS** — codul de structură al activității, de exemplu `RB-301`. Obligatoriu. Cu *Planificare › Aspect › WBS automat* câmpul este dezactivat (text de ajutor: *Codurile WBS sunt numerotate automat (Planificare → Aspect)*), deoarece aplicația gestionează atunci codurile.
- **Descriere** — text liber. Fără efect asupra calculului; îl puteți afișa ca coloana *Descriere* din tabel.
- **Tip** — tipul activității. Lista are grupurile *Tipuri încorporate* (*Construcție*, *Instalare*, *Demolare*, *Logistică*, *Inspecție*, *Relocare*, *Renovare*, *Întreținere*), *Tipurile mele de activitate* și *Din acest proiect*. *Altele* apare numai dacă activitatea are deja acest tip. La final sunt *+ Creare tip de activitate…* și *Gestionare tipuri de activitate…*. Implicit: tipul activității superioare, altfel *Construcție* (modul Construcție activat, implicit) sau *Altele*. Efect: nu influențează calculul; puteți grupa și filtra după tip și puteți colora barele după acesta. Aplicația păstrează un tip personalizat pe dispozitivul dumneavoastră; când îl alegeți, o copie intră în proiect (*Din acest proiect*). Dacă introduceți un nume la *+ Creare tip de activitate…* care există deja în *Tipurile mele de activitate*, chiar și cu alte majuscule, aplicația nu creează un al doilea tip, ci alege tipul existent. În *Gestionare tipuri de activitate…* modificați sau eliminați numai tipurile dumneavoastră; un nume gol sau un nume care există deja nu se păstrează. Dacă eliminați un tip folosit de proiectul deschis, aplicația vă întreabă mai întâi, iar copia din proiect rămâne. Un tip din grupul *Din acest proiect*, de exemplu dintr-un fișier al altcuiva, intră în lista dumneavoastră numai când dați clic pe *Adăugare la tipurile mele de activitate* în *Gestionare tipuri de activitate…*.
- **Calendar** — calendarul în care activitatea își numără durata, data de sfârșit și marja. Implicit: *Calendarul proiectului: {name}*. Efect: o activitate cu calendar propriu lucrează în alte zile decât calendarul proiectului. După o modificare, *Calculare* recalculează datele. Vedeți [Calendare și zile lucrătoare](docs://uitleg-kalenders).
- **Activitate superioară** (numai în fereastră) — mută activitatea sub o altă activitate. Implicit: activitatea superioară actuală; *- Niciuna (rădăcină) -* o pune la nivelul de sus. O alegere care ar crea un ciclu în dependențe este refuzată la *Salvare* cu un mesaj, iar fereastra rămâne deschisă.

## Note

- **Note** — o listă de verificare la activitate. *Adăugare notă* adaugă un rând; bifa (*Gata*) îl taie; pictograma coș (*Ștergere*) îl șterge. Fără rânduri apare *Încă nu există note.* Fără efect asupra calculului; coloana *Note* din tabel le arată cu ✓ sau ○ în față.

## Jalon

- **Jalon** — transformă activitatea într-un jalon. Implicit: dezactivat. Efect: durata devine 0. Aplicația refuză această setare pentru o activitate rezumat (o activitate cu subactivități) și pentru o activitate cu atribuiri de resurse, cu un mesaj; eliminați mai întâi atribuirile. Dacă debifați din nou, *Tip de jalon* și *Obligatoriu (prin contract)* dispar.
- **Tip de jalon** (numai pentru un jalon) — *Automat*, *Jalon de început* sau *Jalon de sfârșit*. Implicit: *Automat*. Efect: un jalon de început se află la începutul zilei, iar unul de sfârșit la sfârșitul ei. Cu *Automat*, jalonul se consideră jalon de început când este predecesor, la începutul zilei.
- **Obligatoriu (prin contract)** (numai pentru un jalon) — marchează un jalon contractual, de exemplu o inspecție sau o predare. Implicit: dezactivat. Efect: un marcaj pentru diagrama Gantt și pentru rapoarte; nu protejează o dată. Pentru aceasta folosiți o restricție sau un termen limită.

## Timp

- **Început** (în fereastra *Data de început*) — arată începutul calculat, aceeași dată ca bara din Gantt și coloana *Început*, nu ancora brută de planificare. Obligatoriu: un câmp gol revine la valoarea anterioară. Efect la introducere: noua dată devine ancora planificată (coloana *Început planificat*). Dacă activitatea are un predecesor și nu a început încă, aplicația înregistrează noul început ca restricție *Nu începe înainte de (SNET)* la acea dată (sau mută un SNET existent), cu un mesaj; după *Calculare*, activitatea nu începe deci mai devreme. Dacă există o restricție diferită de *ASAP* sau *SNET*, aplicația nu aplică începutul și spune ce restricție determină începutul.
- **Durată** — cât timp lucrează activitatea. Introduceți `5d` pentru zile, sau `12h` ori `1h 30m` pentru ore. Un număr fără unitate se socotește în unitatea activității. Zilele sunt întotdeauna întregi; orele pot avea zecimale. O intrare nevalidă afișează *Introduceți un număr întreg de zile sau de ore, de exemplu 2d sau 12h.* iar câmpul revine. Implicit pentru o activitate nouă: 5 zile (un jalon: 0). Câmpul este dezactivat pentru o activitate rezumat, un hamac și un jalon cu durata 0: durata lor rezultă din alte activități sau este zero. O activitate în ore are câmpul dezactivat cât timp *Activare planificare pe ore* este dezactivată; există un buton cu acest nume. Efect: după *Calculare*, durata determină sfârșitul în calendarul activității. Dacă activitatea are resurse și o regulă de lucru, regula decide dacă se modifică lucrul sau unitățile de atribuire. Dacă activitatea este deja parțial realizată, aplicația refuză o durată mai scurtă decât lucrul efectuat. Vedeți [Zile și ore](docs://uitleg-dagen-en-uren).
- **Unitate de durată** — o alegere între *Zile* și *Ore*, cu un buton de informații alături. Vizibilă numai când *Activare planificare pe ore* și *Permitere planificare pe ore și zile combinate* sunt activate (a doua este implicit activată când planificarea pe ore este activă). Efect: aplicația convertește numai dacă rezultatul este exact și face apoi o propunere (*Aplicare propunere* sau *Păstrare*). Dacă nu se potrivește exact, unitatea rămâne și aplicația spune acest lucru. Un calendar fără timp de lucru valid refuză schimbarea.
- **Regulă de lucru** — stabilește care dintre durată, unități de atribuire și lucru rămâne fix când se modifică una dintre cele trei. Alegeri: *Standard de proiect (Durată fixă și unități fixe)*, *Durată fixă și unități fixe*, *Durată fixă și lucru*, *Muncă fixă* și *Unități fixe*. Implicit: standardul de proiect. Sub ea apare ce protejează regula (*Protejat: …*) și, pentru o activitate din MS Project, *Din MS Project: determinată de efort* sau *Din MS Project: nu este determinată de efort*. Vizibilă numai când *Afișare reguli de lucru și lucru* este activată (*Setări*, fila *Planificare*, secțiunea *Calcul*) sau când fișierul conține chiar reguli de lucru ori lucru stocat, și numai pentru o activitate obișnuită: nu pentru o activitate rezumat, un jalon, un hamac sau o activitate în timp scurs. Vedeți [Reguli de lucru: durată, unități și lucru](docs://uitleg-werkregels).

## Hamac

- **Hamac (durată derivată)** — lasă durata să rezulte din două alte activități, în loc să aibă una proprie. Implicit: dezactivat. Numai pentru o activitate obișnuită, deci nu pentru un jalon sau o activitate rezumat. Când este activat: *Legătură determinantă pentru început* arată predecesorii cu o dependență sfârșit-început sau început-început, *Legătură determinantă pentru sfârșit* arată pe cei cu sfârșit-sfârșit sau început-sfârșit, fiecare cu tipul dependenței după el. Dacă nu aveți o legătură determinantă pentru sfârșit, apare *Nicio legătură determinantă pentru sfârșit (FF/SF) — intervalul revine la lungime zero.* și durata este zero. Vedeți [Crearea unui hamac](docs://howto-hammock).

## Restricție și termen limită

Pentru o activitate rezumat, o restricție sau un termen limită nu are efect: calculul calculează numai activitățile fără subactivități și derivă datele unei activități rezumat din subactivitățile sale.

- **Restricție** — o limită de dată pentru activitate. Alegeri: *Cât mai devreme posibil (ASAP)*, *Cât mai târziu posibil (ALAP)*, *Nu începe înainte de (SNET)*, *Nu începe după (SNLT)*, *Nu se termină mai devreme de (FNET)*, *Nu se termină mai târziu de (FNLT)*, *Trebuie să înceapă la (MSO)* și *Trebuie să se termine la (MFO)*. Implicit: *ASAP*, care nu este o restricție. Alegeți ASAP și toate restricțiile activității dispar; alegeți ALAP și restricția secundară dispare. Efect după *Calculare*: o limită mută activitatea sau face marja negativă. Vedeți [Restricții și termene limită](docs://uitleg-constraints).
- **Data restricției** — data care aparține restricției. Vizibilă pentru fiecare restricție, în afară de *ALAP*. Obligatoriu; o restricție nouă primește ca dată începutul planificat.
- **Obligatoriu (logică de fixare)** — numai pentru *MSO* și *MFO*. Implicit: dezactivat. Activat: data este fermă, trece peste dependențe și fixează bara chiar și înainte de predecesorii ei. O încălcare devine marjă negativă în amonte. La prima activare apare o singură dată o explicație.
- **Restricție secundară** și **Dată secundară** — o a doua limită, doar una dintre *SNET*, *FNET*, *SNLT* sau *FNLT* (sau *(niciuna)*). Vizibilă de îndată ce există o restricție primară care nu este ASAP, ALAP sau o fixare fermă. Este întotdeauna flexibilă. O combinație interzisă primește o margine roșie și un motiv: o restricție secundară nu poate fi fermă, nu poate fi împreună cu MSO/MFO sau cu o fixare fermă, nu poate fi împreună cu ASAP/ALAP, trebuie să fie o limită, iar restricția primară și cea secundară nu pot limita aceeași parte. O pereche validă este, de exemplu, SNET cu FNLT.
- **Termen limită** — o dată țintă pentru sfârșit. Gol = niciun termen limită. Efect: activitatea nu se mută din cauza lui. Dacă sfârșitul cel mai devreme este mai târziu, marja devine negativă, iar aplicația semnalează *Termen limită … depășit — sfârșit cel mai devreme …*.

## Progres

- **Progres (%)** — un glisor de la 0 la 100. Implicit: 0. Efect: peste 0, aplicația completează un *Început efectiv* lipsă, iar 100 completează *Sfârșit efectiv*. Starea urmează: *Nepornită* fără început efectiv, *În curs* cu început efectiv și *Finalizată* cu sfârșit efectiv. Durata rămasă (*Rămas*) este durata × (1 − progres), rotunjită la zile întregi pentru o activitate în zile și la minute întregi pentru o activitate în ore. Lucrul realizat se măsoară până la data raportului de stare; dacă nu există încă o dată a raportului de stare, aplicația o setează la azi și spune acest lucru. Pentru o activitate rezumat câmpul este dezactivat: progresul ei rezultă din subactivități după *Calculare* (*Derivat din subactivități: modificați progresul acolo. Activitatea rezumat urmează după calculare (F5).*).
- **Început efectiv** — data la care activitatea a început efectiv. O dată după sfârșitul efectiv sau după data raportului de stare este refuzată. Dacă activitatea este planificată să înceapă abia după data raportului de stare și acum primește progres, fereastra cere *Introduceți începutul efectiv*. Pentru un jalon există un singur câmp, *Dată reală*, în locul câmpurilor *Început efectiv* și *Sfârșit efectiv*.
- **Sfârșit efectiv** — data la care activitatea s-a încheiat efectiv. Introducerea ei setează progresul la 100 și starea la *Finalizată*; ștergerea ei readuce progresul la 0 și starea la *În curs*. Aceleași refuzuri ca pentru *Început efectiv*.
- **Rămas** — doar în citire (nu pentru un jalon): cât din durată mai rămâne, în unitatea activității.

Fereastra aplică aceste reguli la ciornă; ele contează numai după *Salvare*. Vedeți [Progres, data raportului de stare și referința](docs://uitleg-voortgang).

## Rezultat CPM

- **Rezultat CPM** — vizualizare doar în citire a ultimului calcul: *Început cel mai devreme*, *Sfârșit cel mai devreme*, *Început târziu*, *Sfârșit târziu*, *Marjă totală*, *Marjă liberă*, *Marjă interferentă* și *Drum critic* (*Da* sau *Nu*). Marja este în zile lucrătoare, cu două zecimale. Este învechit sau încă nu a fost calculat? Apăsați *Calculare*.

## Dependențe

- **Dependențe** — dependențele acestei activități, câte un rând pentru fiecare: activitatea legată (în panou codul WBS sau numele, dacă acesta lipsește; în fereastră numele), o pictogramă de fulger dacă dependența este determinantă (*Legătură determinantă (driving)*, după un calcul), tipul dependenței (*FS*, *SS*, *FF* sau *SF*), decalajul și pictograma coș. În panou, codul WBS este un buton: când treceți cu cursorul peste el, apare activitatea, iar dând clic pe el treceți la ea. Un semn mic în fața codului arată rolul: un cerc auriu pentru un predecesor și un pătrat violet pentru un succesor, aceleași culori ca în [Urmărirea unui traseu](docs://howto-pad-traceren). Rolul apare și în numele butonului, pentru cititorul de ecran. În fereastră este text simplu, iar secțiunea apare numai dacă activitatea are dependențe.
- **Decalaj** — scrieți un număr cu o unitate: `2d` zile lucrătoare, `3ed` zile calendaristice, `2u` sau `2h` ore de lucru, `3eu` sau `3eh` ore calendaristice, `50%` un procent din durata predecesorului, `-25e%` un procent în timp calendaristic. Un minus îl face devans. Fără unitate se socotește în zile lucrătoare. O intrare nevalidă colorează câmpul în roșu și revine. Vedeți [Dependențe și decalaj](docs://uitleg-relaties).
- **Adăugare dependență** (numai în panou) — deschide un rând de ciornă. La *Direcție* alegeți *Predecesor* sau *Succesor*, găsiți activitatea în câmpul *Căutați o activitate…* după WBS sau nume, alegeți tipul și decalajul, apoi confirmați cu *Creare dependență* (sau *Anulare*). O dependență duplicată sau o dependență cu propria activitate superioară este refuzată cu un mesaj, iar rândul rămâne.

## Întreruperi

Doar în panou și nu pentru un jalon, o activitate rezumat, un hamac, o activitate în timp scurs, o activitate planificată manual sau o activitate prea scurtă pentru o întrerupere.

- **Întreruperi** — opriri în lucrul activității. Câte o linie pentru fiecare întrerupere: *după* (cât lucru se face înainte de întrerupere), *întrerupere* (durata) și unitatea (*zile lucrătoare*, sau pentru o activitate în ore, *ore*), cu intervalul de la–până la al porțiunii de după ea, mai jos. O întrerupere făcută de redistribuire are insigna *redistribuire*. O întrerupere de durată 0 o elimină; coșul de pe fiecare linie (*Ștergere întrerupere*) o elimină de asemenea. Efect: bara este desenată întreruptă, iar după *Calculare* sfârșitul se mută cu durata întreruperii.
- **Adăugare întrerupere** — adaugă o întrerupere de o unitate la mijlocul celei mai lungi porțiuni. Dezactivat când nu este loc pentru o întrerupere.
- **Ștergere toate întreruperile** — apare când întreruperile provin dintr-un fișier sursă, într-o formă care nu poate fi editată aici (*Aceste întreruperi provin din fișierul sursă, într-o formă care nu poate fi editată aici.*). Atunci vedeți doar datele.

Vedeți [Împărțirea unei activități](docs://howto-taak-splitsen).

## Atribuiri

- **Atribuiri** — resursele acestei activități. Pentru fiecare resursă: numele, cu pictograma coș (*Ștergere*), *Unit./zi*, *Lucru (rămas)*, *Curbă*, butonul *Distribuție ore…* și *Mutare la…*. Jos este o listă *Atribuire resursă*; aceasta atribuie resursa cu 1 unitate de atribuire pe zi. Fără resurse apare textul *Creați mai întâi resurse (fila Resurse).*; când toate resursele sunt atribuite, apare *Toate resursele sunt deja atribuite.* Pentru un jalon sau o activitate rezumat, aplicația afișează că atribuirea nu este posibilă.
- **Unit./zi** — câte unități de atribuire din resursă folosește activitatea pe zi, un număr mai mare decât 0. Efect: încărcarea resursei din histogramă și supraalocarea și, cu o regulă de lucru, lucrul.
- **Lucru (rămas)** — lucrul rămas, în ore, pentru această resursă. Vizibil doar când regulile de lucru sunt afișate și activitatea are una; pentru materiale apare o liniuță. Lacătul arată ce element protejează regula de lucru (*Protejată de regula de lucru …*). Triunghiul de avertizare (*Diferă de unități de atribuire × durată*) înseamnă că lucrul salvat nu este egal cu unități × durată rămasă; histograma urmează atunci lucrul salvat.
- **Curbă** — cum se distribuie lucrul pe durată: *Uniform*, *Încărcat la început*, *Încărcat la sfârșit*, *În formă de clopot*, *Vârf timpuriu*, *Vârf târziu*, *Vârf dublu* sau *Țestoasă*. Implicit: *Uniform*. Dacă atribuirea are o distribuție proprie a orelor, apare *Contur* și lista este dezactivată; o curbă importată se numește *Curbă importată*.
- **Distribuție ore…** — deschide distribuția orelor pe zi lucrătoare a acestei atribuiri. Vedeți [Ajustarea distribuției orelor](docs://howto-urenverdeling-aanpassen).
- **Mutare la…** — mută atribuirea la o altă activitate-frunză care nu are încă resursa. Apare doar dacă există o astfel de activitate.

## Coduri și câmpuri

- **Coduri și câmpuri** — apare doar când proiectul are coduri de activitate sau câmpuri particularizate. Fiecare cod de activitate este o listă cu *(niciunul)* și valorile sub forma `cod — descriere`; pentru fiecare tip alegeți cel mult o valoare. Fiecare câmp particularizat are o intrare potrivită tipului său: *Text*, *Număr*, *Număr întreg*, *Cost*, *Dată* sau *Da/nu*. Efect: niciun efect asupra calculului. Puteți grupa și filtra după ele și le afișați ca coloane. Vedeți [Coduri și câmpuri particularizate](docs://howto-codes-en-velden).

## Marcaje sub regula de lucru

Doar în panou și doar când se aplică.

- **Perioadă nelucrătoare lungă** — *Această activitate trece peste o perioadă de … zile nelucrătoare (… până la …).*, sau cu numele sărbătorii sau al perioadei de închidere a șantierului adăugat. Apare când activitatea trece printr-o perioadă continuă de 8 zile sau mai mult, care conține cel puțin o sărbătoare. Este un avertisment, nu un refuz; verificați dacă planificarea este intenționată așa.
- **Marcaj MS Project** — o insignă *Urmează distribuția orelor din MS Project*, *Fereastra de date MS Project nu mai este aplicată după editare — …* sau *Distribuție proprie a orelor*, cu *Citiți mai multe*. Arată dacă distribuția orelor din fișierul MS Project mai determină încă datele.
- **Date salvate** — o insignă pentru un fișier importat cu date salvate: *Afișează datele așa cum sunt în fișier pentru această activitate* (pentru un fișier Primavera *Afișează datele salvate de Primavera pentru această activitate*), *Diferă de datele salvate* sau *Înregistrare parțial incompletă — vedeți coloanele pentru târziu și marjă*, cu *Citiți mai multe*. Vedeți [Datele salvate așa cum sunt](docs://uitleg-datums-zoals-opgeslagen).

## Antetul și subsolul panoului

- **Ștergere activitate** — pictograma coș de lângă titlul *Activitate*; șterge această activitate împreună cu subactivitățile sale, ca un singur pas, anulabil cu *Anulare*. Planificarea nu mai este actualizată după aceea, până când apăsați *Calculare*.
- **Calculare** — butonul de jos; același calcul ca *Acasă › Planificare › Calculare*.

## Ce nu găsiți aici

- **Prioritate de redistribuire** — nu apare în fereastră sau în panou. O setați făcând clic dreapta și alegând *Prioritate* (*Scăzută* = 100, *Normală* = 500, *Ridicată* = 900) sau tastând un număr de la 0 la 1000 în coloana *Prioritate de redistribuire*. Implicit: 500. Efect: redistribuirea păstrează mai întâi pe loc activitățile cu prioritate mai mare; 1000 fixează activitatea, astfel încât redistribuirea nu o mută niciodată. Vedeți [Redistribuirea](docs://uitleg-nivelleren).
- **Alte date ale activității** — restul datelor unei activități, cum ar fi coloanele *Planificat manual*, *Culoare* și coloanele tehnice, se află doar în tabel; vedeți [Coloanele tabelului](docs://ref-tabelkolommen).
