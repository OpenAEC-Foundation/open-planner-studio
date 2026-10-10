# Tipuri de rapoarte

Fiecare raport din fila *Raport*, cu opțiunile care îi aparțin: ce fac, valoarea implicită, ce se schimbă în raport și unde le găsiți. Cum se creează un raport și cum se salvează ca PDF este descris în [Crearea și tipărirea unui raport](docs://howto-rapport-maken-en-afdrukken).

## Cum funcționează fereastra raportului

Deschideți fila *Raport* (sau apăsați Ctrl+P). În stânga este coloana *Raport*, cu lista derulantă *Tip de raport*, blocul *Rezumat* cu numărători, blocul *Setări* sau *Opțiuni de raport* și, la capăt, butonul *Exportare PDF*. În dreapta este previzualizarea. Ce vedeți în previzualizare intră în PDF.

**Tip de raport** — ce raport vedeți. Alegeți din unsprezece rapoarte. Implicit: *Diagramă Gantt*. Unde: *Raport*, în partea de sus a coloanei *Raport*.

**Exportare PDF** — creează PDF-ul. Efect: rezultatul este doar un PDF; aplicația nu trimite nimic la o imprimantă. Dacă planificarea nu este actualizată, aplicația calculează mai întâi. Dacă la calcul apare o eroare, de exemplu din cauza unei bucle în dependențe, butonul nu creează niciun fișier și afișează eroarea. Unde: *Raport*, în partea de jos a coloanei *Raport*.

**Reținute.** Aplicația păstrează toate opțiunile de raport pe acest dispozitiv, pentru toate proiectele dumneavoastră. Ele nu fac parte din fișierul proiectului. Doar câmpul *Companie:* din Diagrama Gantt nu se păstrează.

**Planificarea curentă.** Rapoartele folosesc ultimul calcul. Dacă planificarea s-a modificat de atunci, rapoartele tabelare afișează în partea de sus *Planificarea s-a modificat de la ultimul calcul — apăsați Calculare (F5) pentru valori curente.* Dacă nu s-a calculat niciodată, apare *Încă necalculat — apăsați Calculare (F5) pentru date și marjă.* Dacă proiectul este în vizualizarea *Date cum au fost înregistrate*, rapoartele afișează datele din fișierul sursă, iar o bandă o spune.

**Abrevieri.** *zl* înseamnă zile lucrătoare. *TF* înseamnă marjă totală, *FF* înseamnă marjă liberă.

## Hârtie și orientare

**Hârtie:** — dimensiunea hârtiei PDF-ului. Alegeți din A4, A3, A2 și A1. Implicit: A3. Efect: paginile sunt aranjate pentru această dimensiune. Există o singură alegere pentru toate rapoartele: ce alegeți pentru un raport se aplică și celorlalte. Pe A4 vertical, un tabel larg devine mic, deoarece tabelul este scalat la lățimea paginii. Unde: *Setări* (Diagramă Gantt și Diagramă resurse) sau *Opțiuni de raport* (cele șapte rapoarte tabelare). Prezentare jaloane și varianța nu au alegeri proprii.

**Orientare:** — orizontală sau verticală. Alegeți din *Orizontal* și *Vertical*. Implicit: *Orizontal*. Efect: ca la *Hârtie:*. Unde: același loc ca *Hârtie:*.

## Diagramă Gantt

Planificarea ca diagramă cu bare, cu un tabel în stânga și o axă de timp în dreapta, pe mai multe pagini dacă este nevoie. Previzualizarea arată pagina cu antet, tabel, axă de timp și legendă. Blocul *Rezumat* numără *Activități:*, *Activități frunză:*, *Critic:* și *Dependențe:*. Toate opțiunile se află sub *Setări*.

**Companie:** — compania din antetul paginii. Implicit: compania din informațiile proiectului. Efect: doar antetul raportului; ce introduceți aici nu se păstrează. Schimbați compania în *Setări › Proiect › Informații proiect*, în câmpul *Beneficiar/organizație*, și confirmați cu *Aplicare*.

**Autor:** — autorul din antetul paginii. Doar în citire: aplicația îl preia din informațiile proiectului.

**Dimensiune font:** — dimensiunea textului și a tabelului din raport. Alegeți din 90%, 100%, 110% și 125%. Implicit: 100%. Efect: cu un font mai mare, textul, rândurile și tabelul cresc, iar axa de timp pierde din lățime. Independent de *Dimensiune text* din setări.

**Culori bare:** — de ce depinde culoarea unei bare. Alegeți din *Drum critic*, *Per activitate — automat* și *Pe categorie*, cu o listă derulantă *Câmp de categorie* pentru *Pe categorie*. Implicit: *Drum critic*. Efect: este aceeași alegere ca *Culori bare* din fila *Vizualizare*: dacă o schimbați aici, Gantt de pe ecran se schimbă la fel. Dacă câmpul ales nu există în acest proiect, apare *Acest câmp nu există în acest proiect. Se folosește temporar tipul de activitate.*

**Linie de stare:** — o linie la data raportului de stare. Alegeți din *Niciuna*, *Linia datei raportului de stare* și *Linia de progres*. Implicit: *Niciuna*. Efect: *Linia datei raportului de stare* desenează o linie la data raportului de stare; *Linia de progres* desenează linia în zigzag care se umflă până la progresul fiecărei activități. Dacă proiectul nu are data raportului de stare, apare *Setați mai întâi data raportului de stare*, iar raportul nu desenează nimic.

**Urmărire vizualizare (filtru, grupare, sortare)** — doar pentru Diagrama Gantt. Implicit: dezactivat. Efect: dezactivat, pe hârtie apare toată ierarhia activităților. Activat, se desenează exact rândurile de pe ecran: cu filtrul, gruparea, sortarea și fazele restrânse.

**Potrivire automată pe hârtie** — scalează axa de timp la lățimea paginii. Implicit: activat. Efect: activat, scalează axa de timp la lățimea paginii; numărul de pagini rezultă din înălțime. Dezactivat, folosește o scală fixă (*Zoom:*) și se întinde și pe lățime, ceea ce dă repede multe pagini.

**Zoom:** — scala fixă a axei de timp. Vizibil doar când *Potrivire automată pe hârtie* este dezactivat. Glisor de la 1 la 40. Implicit: 22. Efect: o valoare mai mare face axa de timp mai lată, deci mai multe pagini pe lățime.

**Axa de timp pe:** — întinde axa de timp pe mai multe lățimi de pagină. Alegere de la 1 până la 8 pagini. Implicit: 1 pagină. Efect: doar cu *Potrivire automată pe hârtie*; altfel alegerea este dezactivată și apare *Doar la potrivire automată*. Util pentru o planificare lungă, pe care doriți s-o tipăriți într-o dimensiune lizibilă.

**Repetare antet pe fiecare pagină** — Implicit: activat. Efect: activat, pune antetul paginii pe fiecare pagină; dezactivat, doar pe prima.

**Repetare subsol pe fiecare pagină** — Implicit: activat. Efect: activat, pune subsolul (numele proiectului, data tipăririi și legenda) pe fiecare pagină; dezactivat, doar pe ultima. Un material fără legendă nu se poate citi, de aceea este activat implicit.

**Nume activități pe bare** — Implicit: activat. Efect: numele activității pe bară, acolo unde este loc.

**Afișare procent de finalizare** — Implicit: activat. Efect: o parte mai închisă a barei, până la progresul activității, și coloana *Proc. fin* din tabel.

**Trunchiere nume activități** — Implicit: activat. Efect: activat, taie numele din tabel la lățimea *Coloană nume:*. Dezactivat, coloana crește odată cu cel mai lung nume; apoi apare *Coloana de nume se adaptează la cel mai lung nume de activitate*.

**Coloană nume:** — lățimea coloanei de nume. Vizibil doar când *Trunchiere nume activități* este activat. Glisor de la 60 la 400. Implicit: 130.

**Afișare suprapunere referință** — referința activă lângă bare. Implicit: dezactivat. Efect: o bară subțire, în culoarea referinței, sub bara activității, doar pentru activitățile care sunt în referință.

**Drum critic** — Implicit: activat. Efect: controlează doar liniile roșii de dependență între două activități critice și linia din legendă. Barele urmează *Culori bare:*, indiferent de această casetă.

**Afișare marjă** — Implicit: activat. Efect: marja ca bandă în spatele barelor necritice.

**Dependențe** — liniile de dependență. Implicit: activat. Efect: desenează săgeți între bare.

**Afișare doar pentru zilele lucrătoare** — comprimă axa de timp în acest raport. Implicit: dezactivat. Efect: sfârșiturile de săptămână și sărbătorile sunt sărite, iar benzile de săptămână înlocuiesc umbrirea sfârșiturilor de săptămână. Independent de aceeași setare pentru Diagrama Gantt de pe ecran.

**Sfârșituri de săptămână** — Implicit: activat. Efect: umbrește sfârșiturile de săptămână și sărbătorile pe axa de timp, atâta timp cât scala face zilele distincte. Pe axa comprimată (*Afișare doar pentru zilele lucrătoare*) această casetă nu are efect.

**Legendă** — Implicit: activat. Efect: legenda din subsol.

**Calitate previzualizare** — cât de clară este previzualizarea. Alegeți din *Standard*, *Ridicată* și *Maximă*. Implicit: *Ridicată*. Efect: doar claritatea previzualizării de pe ecran; PDF-ul nu se schimbă. Unde: *Raport*, deasupra previzualizării.

## Diagramă resurse

Aceleași bare ca la Diagrama Gantt, grupate pe resursă: cine face ce și când. Blocul *Rezumat* numără *Resurse:*, *Atribuiri:* și *Fără resursă:* (cu o perioadă și *În afara perioadei:*). Diagrama are toate opțiunile Diagramei Gantt, cu excepția *Urmărire vizualizare (filtru, grupare, sortare)*, *Drum critic* și *Dependențe*: rândurile nu vin de pe ecran, o activitate poate apărea sub mai multe resurse, iar dependențele nu sunt desenate aici. Caseta *Drum critic* este ascunsă și activată. Acestea vin cu opțiunile Diagramei Gantt din *Setări*, cu aceste patru casete și perioada:

**Fiecare resursă pe pagină nouă** — Implicit: dezactivat. Efect: fiecare resursă începe pe o pagină nouă, ca să puteți înmâna câte o fișă pentru fiecare echipă sau angajat. Dezactivat, rezultă un singur document continuu.

**Includere activități fără resursă** — Implicit: dezactivat. Efect: activitățile fără resursă apar ca ultima bandă din diagramă, ca să vedeți ce nu are încă nimeni.

**Grupare pe tip de resursă** — Implicit: dezactivat. Efect: un strat peste celelalte: întâi o bandă pentru fiecare tip de resursă (forță de muncă, echipă, subcontractant, utilaj, material), iar în interiorul ei câte o bandă pentru fiecare resursă.

**Afișare unități de atribuire/zi și curbă** — Implicit: activat. Efect: două coloane după numele activității, cu unitățile de atribuire pe zi și curba de distribuție a resursei din acea bandă. Dacă este prea puțin loc pentru axa de timp, raportul omite coloanele și afișează *Coloanele Unități/zi și Curbă au fost omise: …*; mai mult loc vine dintr-o dimensiune mai mare a hârtiei sau din orientarea orizontală, dintr-un font mai mic sau dintr-un tabel mai îngust.

**Perioadă raport:** — doar activitățile care ating perioada. Implicit: *Durata proiectului*. Efect: axa de timp merge exact peste perioadă. Dacă nu este nimic în perioadă, apare *Nicio activitate în perioada raportului — alegeți altă perioadă sau Întregul proiect.* Consultați *Perioadă raport* mai jos.

## Prezentare jaloane

Toate jaloanele proiectului, într-un tabel. Fără opțiuni proprii. Blocul *Rezumat* numără *Jaloane*, *Obligatoriu* și *Întârziat*. Coloanele sunt *WBS*, *Nume*, *Tip* (*Automat*, *Început* sau *Sfârșit*), *Data*, *Restricție/termen limită*, *Marjă*, *Obligatoriu* și *Stare*. Starea este *Întârziat* dacă restricția este încălcată, termenul limită este ratat sau marja totală este negativă; altfel *Critic*, dacă jalonul este critic conform definiției critice a proiectului; altfel *Conform planificării*. Fără jaloane apare *Niciun jalon în acest proiect.* PDF-ul folosește hârtia și orientarea pe care le-ați ales ultima dată pentru alt raport.

## Varianță

Planificarea curentă lângă referința activă, pentru activitățile frunză. Fără opțiuni proprii. Blocul *Rezumat* numără *Activități*, *Întârziată* și *Devansată* și afișează *Sfârșit proiect: +3 zile lucrătoare* (diferența în zile lucrătoare între sfârșitul referinței și sfârșitul calculat). Coloanele sunt *WBS*, *Nume*, *Început referință*, *Sfârșit referință*, *Început calculat*, *Sfârșit calculat*, *Δ început (zl)*, *Δ sfârșit (zl)* și *Stare*. Starea depinde de sfârșit: *Întârziată* dacă sfârșitul este mai târziu decât în referință, *Devansată* dacă este mai devreme, altfel *Conform planificării*. *Nouă* este o activitate care nu este în referință, iar *Eliminată* este o activitate care este în referință, dar nu mai este în planificare. Fără referință activă apare *Nicio referință activă — salvați o referință sau setați una ca activă.* PDF-ul folosește hârtia și orientarea pe care le-ați ales ultima dată pentru alt raport.

## Previziune

Ce se desfășoară sau începe în perioadă: lista pentru întâlnirea săptămânală. Opțiuni sub *Opțiuni de raport*.

**Perioadă raport:** — fereastra raportului. Implicit: *Luna următoare*. Efect: raportul conține activitățile nefinalizate care ating perioada, chiar dacă o acoperă complet, plus activitățile întârziate de dinaintea zilei de referință, atâta timp cât sfârșitul perioadei nu este înainte de ziua de referință.

**Aproape critic ≤ (zl):** — pragul pentru *Aproape critic*. Număr de la 0 la 60. Implicit: 5. Efect: o activitate cu o marjă totală mai mare decât 0 și cel mult atâtea zile lucrătoare este aproape critică. La 0 contează doar ce marchează opțiunea de calcul a proiectului *Marcare activități aproape critice*.

Blocul *Rezumat* numără *Activități*, *Întârziate*, *În curs*, *Ar fi trebuit să înceapă*, *Începe*, *Critic* și *Aproape critic*. Starea fiecărui rând, mereu față de ziua de referință: *Întârziat* (nefinalizată, iar sfârșitul este înainte de ziua de referință), *Ar fi trebuit să înceapă* (nepornită, deși începutul era înainte de ziua de referință), *În curs*, *Începe* (nepornită încă, începe în fereastră). Coloanele sunt *WBS*, *Nume*, *Început*, *Sfârșit*, *Rest (zl)*, *Proc. fin*, *TF (zl)*, *Critic*, *Resurse* și *Stare*.

## Critic și aproape critic

Activitățile care determină sfârșitul proiectului și cele care sunt aproape de ele. Opțiune sub *Opțiuni de raport*.

**Aproape critic ≤ (zl):** — Implicit: 5. Număr de la 0 la 60. Efect și sens ca la Previziune. Subtitlul indică pragul ales.

Raportul conține activitățile nefinalizate care sunt critice (conform solverului și definiției critice a proiectului) sau aproape critice, sortate după drumul de marjă, apoi după marja totală, apoi după început. Blocul *Rezumat* numără *Critic*, *Aproape critic*, *Lanțuri critice* și *Activități frunză*. Coloanele sunt *WBS*, *Nume*, *Început*, *Sfârșit*, *Rest (zl)*, *TF (zl)*, *FF (zl)*, *Traseu* și *Stare*. Coloana *Traseu* arată drumul de marjă dacă opțiunea de calcul *Mai multe drumuri de marjă* este activată, altfel o liniuță.

## Raport de progres

Unde se află proiectul la data raportului de stare. Opțiuni sub *Opțiuni de raport*.

**Perioadă raport:** — Implicit: *Luna trecută*. Efect: *Finalizate în perioada trecută* numără în perioadă. *Încep în perioada următoare* privește înainte de la data raportului de stare, până la *Previziune până la*; cu o perioadă *Luna trecută*, privește pe atât de departe cât privește perioada înapoi.

**Aproape critic ≤ (zl):** — Implicit: 5. Ca la Previziune.

Blocul *Rezumat* afișează *Data raportului de stare*, *Perioadă*, *Previziune până la*, *Sfârșit referință*, *Sfârșit prognozat*, *Δ sfârșit (zl)*, *Planificat* (cu *(referință)* sau *(planificarea curentă)*), *Real* și numărătorile *Finalizat*, *În curs*, *Nepornită*, *Întârziate* și *Critic*. Planificatul și realul sunt ponderați după durata activităților. Planificatul se măsoară față de referință, dacă există o referință activă, altfel față de planificarea curentă. Secțiunile sunt *Finalizate în perioada trecută*, *În curs*, *Încep în perioada următoare*, *Întârziate* și *Activități critice deschise*; o activitate poate fi în mai multe secțiuni.

## Sănătatea planificării

O verificare a planificării în sine pentru erori și valori neobișnuite, cu evaluarea DCMA în 14 puncte în partea de sus. Opțiunile se află sub *Opțiuni de raport*.

**Marjă mare > (zl):** — Număr de la 1 la 365. Implicit: 44. Efect: o activitate neterminată cu mai multă marjă totală decât această valoare se încadrează la *Marjă mare*.

**Durată lungă > (zl):** — Număr de la 1 la 365. Implicit: 44. Efect: o activitate neterminată, care nu este jalon, cu o durată mai mare se încadrează la *Durată lungă*.

**Decalaj > (zl):** — Număr de la 0 la 365. Implicit: 10. Efect: o dependență cu mai mult decalaj se încadrează la *Decalaj lung*. Un decalaj negativ (devans) este întotdeauna raportat.

**Aproape critic ≤ (zl):** — Număr de la 0 la 60. Implicit: 5. Efect: stabilește verificarea *Aproape critic*.

Secțiunea *Evaluare DCMA în 14 puncte* apare prima. Ea urmează cele paisprezece verificări ale Agenției SUA pentru managementul contractelor de apărare (US Defense Contract Management Agency), cu formulele și pragurile din *EVMS Program Analysis Pamphlet* (DCMA-EA PAM 200.1, octombrie 2012). Pentru fiecare punct vedeți *Număr*, *Din* (totalul din care s-a numărat), *Valoare*, *Prag*, *Rezultat* și *Detalii*. Rezultatul este *Respectă*, *Marcat* sau *N/A*; pentru N/A, motivul este în detalii. Un marcaj nu înseamnă un eșec: broșura îl numește un motiv pentru o analiză suplimentară. Pragurile din *Opțiuni de raport* nu se aplică la această secțiune; ea folosește întotdeauna pragurile din broșură.

Se numără activitățile frunză neterminate, fără jaloane și hamacuri, și dependențele către asemenea activități. Nota de deasupra raportului arată ambele numere. Cele paisprezece puncte:

- *Logică*: activități fără predecesor sau succesor. Prag: cel mult 5%.
- *Devansuri*: dependențe cu decalaj negativ. Prag: niciunul.
- *Decalaje*: dependențe cu decalaj pozitiv, oricât de scurt. Prag: cel mult 5%.
- *Tipuri de dependență*: ponderea dependențelor FS. Prag: cel puțin 90%.
- *Restricții stricte*: activități cu o restricție obligatorie sau cu MSO, MFO, SNLT sau FNLT. Prag: cel mult 5%.
- *Marjă mare*: activități cu mai mult de 44 de zile lucrătoare de marjă totală. Prag: cel mult 5%. Necesită un calcul.
- *Marjă negativă*: activități cu marjă totală sub 0. Prag: niciunul. Necesită un calcul.
- *Durată mare*: activități mai lungi de 44 de zile lucrătoare. Numără durata din referință dacă activitatea este în referința activă, altfel durata curentă. Prag: cel mult 5%.
- *Date invalide*: un început efectiv sau un sfârșit efectiv după data raportului de stare, sau un început prognozat ori un sfârșit prognozat înainte de data raportului de stare. Prag: niciunul. Necesită o dată a raportului de stare.
- *Resurse*: activități fără resursă. Prag: niciunul. Numai dacă proiectul folosește resurse; altfel N/A.
- *Activități restante*: din activitățile care, conform referinței, ar trebui să fie finalizate până la data raportului de stare inclusiv, ponderea celor care se termină mai târziu sau au un sfârșit prognozat mai târziu. Prag: cel mult 5%. Necesită o dată a raportului de stare și o referință activă.
- *Test drum critic*: aplicația prelungește o activitate critică cu 100 de zile lucrătoare și recalculează, pe o copie, fără a modifica proiectul. Testul trece dacă ultima activitate a proiectului nu se termină atunci înaintea acelei activități. Testează activitatea critică neterminată cu începutul cel mai devreme; în detalii sunt numite activitatea și numărul de zile lucrătoare cu care s-a mutat sfârșitul.
- *CPLI*: (lungimea drumului critic + marjă) / lungimea drumului critic. Lungimea numără zilele lucrătoare de la data raportului de stare până la sfârșitul ultimei activități; marja este diferența față de sfârșitul de referință al acelei activități, sau marja calculată dacă activitatea nu este în referință. Prag: cel puțin 0,95. Necesită o dată a raportului de stare.
- *BEI*: numărul de activități finalizate la data raportului de stare, împărțit la numărul de activități care, conform referinței, ar trebui să fie finalizate până atunci, plus activitățile fără referință. Prag: cel puțin 0,95. Necesită o dată a raportului de stare și o referință activă.

Două puncte diferă de broșură, pentru că aplicația nu are conceptul: *Durată mare* numără fiecare activitate neterminată, în timp ce broșura o limitează la perioada de planificare detaliată (rolling wave), iar *Resurse* analizează doar resursele atribuite, nu costurile. Broșura nu oferă niciun număr pentru testul drumului critic; cele 100 de zile lucrătoare sunt alegerea aplicației.

Verificările apar în această ordine, cu gravitatea lor. Eroare: *Marjă negativă*, *Termen limită ratat*, *Restricție încălcată* și *Progres inconsecvent* (un început efectiv sau un sfârșit efectiv după data raportului de stare, un început prognozat sau un sfârșit prognozat înainte de data raportului de stare, 100% fără un sfârșit efectiv, un sfârșit efectiv dar nu 100%, progres fără un început efectiv). Avertisment: *Fără predecesor (început deschis)* și *Fără succesor (sfârșit deschis)* (nu jaloane), *Durată lungă*, *Devans (decalaj negativ)*, *Restricție strictă* (o restricție obligatorie sau MSO, MFO, SNLT sau FNLT), *Progres în afara secvenței* și *Activitate restantă (față de referință)*. Informație: *Aproape critic*, *Marjă mare*, *Decalaj lung*, *Dependență diferită de FS* și *Fără resursă* (numai dacă proiectul folosește resurse). Raportul verifică numai activitățile frunză care nu sunt hamacuri. Blocul *Rezumat* numără *Marcaje DCMA*, *Erori*, *Avertismente*, *Informații*, *Activități frunză* și *Dependențe*; sub secțiunea DCMA se află o secțiune *Prezentare generală* (pentru fiecare verificare, gravitatea și numărul) și o secțiune *Constatări* (fiecare activitate sau dependență). Fără un calcul, lipsesc verificările care necesită marjă.

## Încărcare resurse

Pentru fiecare resursă, pe săptămână sau pe lună, ce este necesar în comparație cu ce este disponibil. Opțiunile se află sub *Opțiuni de raport*.

**Perioadă raport:** — Implicit: *Durata proiectului*. Efect: fiecare săptămână sau lună care atinge perioada este inclusă integral. Astfel, un rând arată același număr ca histograma.

**Agregare:** — Alegeți dintre *Pe săptămână* și *Pe lună*. Implicit: *Pe săptămână*. Efect: un rând pe săptămână calendaristică (coloana *Săptămâna din*, cu ziua de luni) sau pe lună calendaristică (coloana *Lună*).

**Doar perioadele supraalocate** — Implicit: dezactivat. Efect: activat afișează numai săptămânile sau lunile cu cel puțin o zi supraalocată.

Coloanele sunt *Resursă*, *Tip*, *Săptămâna din* sau *Lună*, *Necesar*, *Disponibil*, *Varianță* (disponibil minus necesar; negativ înseamnă lipsă), *Vârf/zi* și *Supraalocare*. *Necesar* este suma unităților de atribuire pe zile. Sunt incluse numai săptămânile sau lunile cu cerere. Blocul *Rezumat* numără *Resurse*, *Săptămâni* sau *Luni*, *Săptămâni cu supraalocare* sau *Luni cu supraalocare* și *Resurse cu supraalocare*.

## Atribuiri de resurse

Pentru fiecare resursă, activitățile la care este atribuită: ce face această echipă sau această macara? Opțiuni sub *Opțiuni de raport*.

**Perioadă raport:** — Implicit: *Durata proiectului*. Efect: cu o perioadă, sunt incluse numai atribuirile activităților care ating perioada, plus lucrul restant de dinainte de ziua de referință. *Durata proiectului* nu filtrează după dată.

**Include activitățile finalizate** — Implicit: dezactivat. Efect: activat include și atribuirile activităților finalizate.

Rândurile sunt pe resursă și, în cadrul unei resurse, după început. Blocul *Rezumat* numără *Resurse*, *Atribuiri* și *Activități fără resursă*. Coloanele includ resursa, activitatea, începutul și sfârșitul, *Rest (zl)*, *Unit./zi*, *Proc. fin*, *Critic* și *Stare*.

## Rezumat WBS

Planificarea, sintetizată pe element WBS: prezentarea generală pentru management. Opțiuni sub *Opțiuni de raport*.

**Nivel:** — până la ce nivel se afișează WBS-ul. Alegeți dintre *WBS complet* și nivelurile 1 până la 8. Implicit: nivelul 2. Efect: subtitlul spune *Până la nivelul 2*.

**Afișare activități** — Implicit: dezactivat. Efect: activat afișează și activitățile frunză propriu-zise sub fiecare element.

Coloanele includ *WBS*, *Nume*, *Început*, *Sfârșit*, *Început referință*, *Sfârșit referință*, *Durată (zile lucr.)*, *Proc. fin*, *Δ sfârșit (zl)*, *Min. TF*, *Act* (numărul de activități), *Crit*, *În lucru* și *Realizat*. Începutul și sfârșitul unei activități rezumat provin din ultimul calcul. Progresul este ponderat după durată, pe activitățile frunză. *Min. TF* și numerele se referă la activitățile frunză de mai jos. Blocul *Rezumat* numără *Elemente WBS* și *Activități*.

## Perioadă raport

Patru rapoarte tabelare și diagrama resurselor lucrează cu o *Perioadă raport:*: *Look-ahead*, *Raport de progres*, *Încărcare resurse*, *Atribuiri de resurse* și *Diagrama resurselor*. Fiecare raport își păstrează propria perioadă. Sub lista derulantă se află *De la* și *Până la*, cu datele pe care le produce alegerea.

**Ziua de referință.** O perioadă cu *Următorul* sau *Ultimul* se numără de la data raportului de stare al proiectului sau de la azi, dacă nu există o dată a raportului de stare. Atunci rapoartele tabelare afișează *Nu este setată data raportului de stare — raportul calculează cu data de azi (…).* Dacă mutați data raportului de stare, fereastra se mută odată cu ea. Ambele zile sunt incluse.

**Săptămâna următoare, Următoarele 2 săptămâni, Următoarele 4 săptămâni, Următoarele 6 săptămâni, Următoarele 8 săptămâni, Următoarele 12 săptămâni** — de la ziua de referință, fiecare săptămână are 7 zile. Cu data raportului de stare joi, 20 mai, *Săptămâna următoare* merge de la 20 până la 26 mai, iar *Următoarele 4 săptămâni* de la 20 mai până la 16 iunie.

**Ultima săptămână, Ultimele 2 săptămâni, Ultimele 4 săptămâni, Ultimele 6 săptămâni, Ultimele 8 săptămâni, Ultimele 12 săptămâni** — aceleași șase, dar numărate înapoi: fiecare săptămână are 7 zile, până la ziua de referință inclusiv. *Ultimele 2 săptămâni* merge de la 7 până la 20 mai, cu ziua de referință 20 mai.

**Luna următoare, Luna trecută** — o lună calendaristică înainte sau înapoi, până cu o zi înainte de aceeași dată din cealaltă lună. *Luna următoare* merge până la 19 iunie, cu ziua de referință 20 mai; *Luna trecută* merge de la 21 aprilie până la 20 mai.

**Durata proiectului** — de la primul început până la ultimul sfârșit al planificării.

**Personalizat** — o perioadă proprie. Efect: *De la* și *Până la* devin două câmpuri pentru dată. Ele pornesc cu datele alegerii anterioare. Data de sfârșit nu poate fi înaintea datei de început (*Data de sfârșit este înaintea datei de început.*), iar ambele câmpuri trebuie completate (*Completați ambele date.*). Dacă introducerea nu este corectă, raportul rămâne pe ultima perioadă validă.

## Vezi și

- [Crearea și tipărirea unui raport](docs://howto-rapport-maken-en-afdrukken): tot drumul de la tipul de raport până la PDF.
- [Alegerea perioadei raportului](docs://howto-rapportageperiode-kiezen): pași și exemple.
- [Drum critic și marjă](docs://uitleg-kritiek-pad): ce înseamnă critic și aproape critic.
- [Progres, data raportului de stare și referința](docs://uitleg-voortgang): data raportului de stare și referința cu care lucrează rapoartele.
- [Rezolvarea supraalocării](docs://howto-overbezetting-oplossen): ce faceți cu săptămânile supraalocate din Încărcare resurse.
- [Formate de import și export](docs://ref-import-exportformaten): PDF alături de celelalte formate.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): două referințe cu progres și o dată a raportului de stare, pentru a analiza raportul de varianță.
