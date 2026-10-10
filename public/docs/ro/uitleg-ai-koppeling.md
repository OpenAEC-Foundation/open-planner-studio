# Cum funcționează legătura cu AI

Ce se întâmplă de fapt când un asistent de inteligență artificială lucrează în planificarea dumneavoastră? În acest articol citiți ce este legătura, de ce diferă de schimbul unui fișier, ce limite își impune singură aplicația și cum află asistentul cum trebuie construită o planificare. Exemplul de la final arată cu cifre ce poate face un asistent dintr-o dată și ce puteți anula din aceasta.

## Conceptul

Un asistent de inteligență artificială, de exemplu o aplicație de chat sau un asistent de programare, poate opera un alt program prin **Model Context Protocol** (MCP). În acest schimb, Open Planner Studio are rolul de server. Aplicația desktop pornește un server mic pe calculatorul dumneavoastră, **puntea**. Asistentul se conectează la ea și primește o listă de **instrumente**: unelte cu un nume care începe cu `planner_`, de exemplu citirea activităților, adăugarea unei dependențe sau salvarea unei referințe. Care sunt acestea, este descris în [Instrumentele AI](docs://ref-ai-tools).

Partea remarcabilă este că asistentul lucrează în proiectul pe care îl aveți deschis în acel moment, nu într-o copie. Nu exportați nimic, nu importați nimic și nu există niciun moment în care dumneavoastră și asistentul vedeți două versiuni diferite. O activitate adăugată de asistent apare imediat în Gantt. Aplicația nu este naivă în privința aceasta: asistentul lucrează cu același calcul, aceeași istorie de anulare și aceleași reguli ca dumneavoastră.

Cum activați legătura, este descris în [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen). Mai jos citiți cum funcționează.

## Cum tratează aplicația legătura

### Un server la care aude doar calculatorul dumneavoastră

Puntea ascultă doar pe calculatorul dumneavoastră (`127.0.0.1`), pe un singur port, implicit 3877. Acceptă cereri doar la adresa `/mcp` și doar cu **tokenul** dumneavoastră în antetul `Authorization: Bearer`. Refuză o cerere fără tokenul corect. O cerere care vine dintr-un browser, pe care îl recunoaște după antetul `Origin`, este refuzată și ea, astfel încât o pagină web deschisă întâmplător nu poate vorbi cu planificarea dumneavoastră. Cererile sunt procesate strict una câte una.

Legătura este HTTP simplu pe calculatorul dumneavoastră; prin aplicație nu iese nimic. Ce face un asistent cu planificarea pe care o citește, de exemplu ce face furnizorul lui cu ea, depinde de asistent și nu ține de aplicație.

### Asistentul lucrează pe un singur document

La prima modificare, puntea leagă legătura de documentul care este activ atunci. Dacă schimbați singur fila după aceea, aplicația refuză următoarea modificare a asistentului (cod `DOC_DRIFT`), până când acesta confirmă cu `planner_switch_document` pe ce document vrea să lucreze. Astfel nimic nu ajunge în proiectul greșit. Un asistent care deschide sau dublează singur un document lucrează după aceea în acel nou document.

### Fiecare modificare se recalculează

În aplicație planificați manual: modificați ceva, apoi apăsați *Calculare* (F5), dacă *Calculare automată* nu este activată. Acest lucru nu se aplică la o modificare făcută de asistent. Fiecare acțiune de scriere a asistentului trece printr-o singură tranzacție. Dacă datele proiectului se schimbă în ea, aplicația recalculează la final, singură, o dată pentru un script. Instrumentul de citire dă întotdeauna date la zi: dacă planificarea nu mai este actualizată, de exemplu pentru că ați modificat ceva singur și nu ați apăsat încă *Calculare*, instrumentul de citire recalculează mai întâi. Există o excepție: dacă proiectul se află în vizualizarea *Datele înregistrate* (după un import), instrumentele de citire nu recalculează în liniște, pentru că asta ar înlocui acele date. Asistentul primește atunci datele înregistrate, cu o notificare că nu au fost recalculate. O modificare făcută chiar de asistent recalculează întotdeauna, chiar și atunci. Dumneavoastră nu trebuie să apăsați *Calculare* după o modificare a asistentului. Asistentul citește apoi rezultatul, de exemplu sfârșitul proiectului și drumul critic, cu instrumentele de citire. Vezi și [Datele înregistrate](docs://uitleg-datums-zoals-opgeslagen).

### Un script este un singur pas

Asistentul poate trimite o serie de pași ca un întreg, cu `planner_batch`, un script de cel mult 100 de pași. Dumneavoastră primiți astfel un singur pas de anulare, o singură recalculare și o singură copie de rezervă. Dacă un pas eșuează structural, de exemplu un instrument necunoscut sau o dependență circulară, aplicația anulează tot scriptul. Nu păstrați niciodată o planificare pe jumătate terminată. Un refuz al unui element dintr-un pas în bloc, de exemplu o singură linie de progres nevalidă din douăzeci, este mai blând: elementul respectiv rămâne afară, iar restul se execută. Refuzurile apar în partea de sus a răspunsului.

### Limitele dumneavoastră

Patru lucruri le stabiliți singur, în fila *AI*:

- *Pauzare* și *Doar în citire* lasă asistentul conectat, dar refuză orice modificare. Citirea rămâne posibilă, inclusiv recalcularea unei planificări care nu mai este actualizată la citire: acestea sunt câmpuri calculate, nu date ale proiectului, deci nu se adaugă niciun pas de anulare și proiectul nu se consideră modificat. Dacă sunteți chiar în mijlocul unei editări, de exemplu trăgând o bară sau tastând într-un câmp, un instrument de citire nu recalculează: asistentul primește atunci datele de dinaintea editării dumneavoastră, cu o notificare că nu sunt la zi.
- O fereastră de dialog deschisă blochează totul. Dacă de exemplu este deschisă fereastra de dialog a activității, setările, modul de prezentare sau fereastra de bun venit, aplicația refuză și citirea, pentru că sunteți în mijlocul unei acțiuni manuale. Asistentul primește codul de eroare `DIALOG_OPEN`. Mesajul numește numele intern al ceea ce este deschis, de exemplu `showTaskDialog` pentru fereastra de dialog a activității.
- *Copia de rezervă automată* scrie o copie IFC înainte de prima modificare pe document. Dacă această copie de rezervă nu reușește, aplicația nu execută modificarea.
- *Panou de activitate* afișează fiecare apel, cu argumentele și răspunsul.

Pe lângă aceasta, aveți obișnuita *Anulare* (Ctrl+Z). Asistentul împarte acest istoric cu dumneavoastră și are singur `planner_undo` și `planner_redo`.

### Ce nu poate face asistentul

Puntea este intenționat mai îngustă decât aplicația. Ce nu poate face asistentul are de obicei unul din trei motive.

**Asistentul ajunge mai departe decât proiectul.** Asistentul nu poate modifica biblioteca de resurse. Biblioteca de resurse este comună tuturor proiectelor dumneavoastră și nu intră în istoricul de anulare; o singură modificare a tarifului ar avea efect atunci în proiecte care nici nu sunt deschise. Pentru o resursă din bibliotecă, numele, tipul, descrierea, tariful standard și unitatea sunt fixate, exact ca în panoul de resurse. Ce decide proiectul rămâne la asistent: capacitatea maximă, disponibilitatea în timp, calendarul și echipa. El nu poate nici alege care calendar este calendarul proiectului. Poate citi profilul de calcul și opțiunile de calcul, dar nu le poate modifica; poate doar stabili modul de progres și valoarea implicită a proiectului pentru regula de lucru. Nu există instrumente pentru setări, temă, limbă, extensii sau actualizări.

**Nu se pretează la o validare sigură.** Asistentul nu poate seta un hamac, nu poate planifica manual o activitate, nu poate seta o a doua restricție, nu poate completa note, culori, coduri de activitate, câmpuri particularizate sau legături între proiecte și nu poate seta manual o întârziere prin redistribuire. Nici nu alege un cod WBS; aplicația îl derivă singură.

**Asistentul atinge ceva ce trebuie să decideți singur.** Asistentul înregistrează progres doar dacă există o dată a raportului de stare. El nu o alege singur: este data de referință a dumneavoastră. Dacă o activitate care nu a început are un început planificat după data raportului de stare, trebuie să furnizeze începutul efectiv. Citește și scrie fișiere doar în folderul dumneavoastră de utilizator și suprascrie un fișier existent doar dacă cere explicit acest lucru. Un export nu este o *Salvare*: proiectul rămâne nesalvat în aplicație.

### Cum află asistentul cum să planifice

Un asistent care cunoaște instrumentele poate totuși construi o planificare care nu îi folosește niciunui planificator: activități fără dependențe, o dată fixă la fiecare activitate sau o defalcare mult prea fină. De aceea aplicația îi oferă trei lucruri.

**Regulile principale la conectare.** La conectare, puntea trimite un text scurt în câmpul `instructions` al conectării MCP. Mulți clienți pun acest text în promptul lor de sistem; dacă al dumneavoastră o face, depinde de client. Regulile: asistentul începe cu jaloanele și cu data de livrare, construiește activități de circa o zi până la două săptămâni, conduce planificarea prin dependențe în loc de date fixe, folosește restricții doar pentru termene externe ferme, repară întâi un calcul eșuat, folosește `planner_batch` pentru o serie coerentă, înregistrează progresul doar cu data raportului de stare și cu datele reale pe care le furnizează, și spune la final ce a presupus și ce a lăsat intenționat deoparte.

**Ghidul pentru asistenți.** Instrumentul `planner_get_planning_guide` returnează un ghid scris special pentru asistenți. Ghidul urmează aceleași principii ca [Planificarea corectă](docs://gids-goed-plannen), dar asistentul lucrează altfel decât dumneavoastră: nu apasă F5 și nu dă clic în panglică, ci apelează instrumente, iar aplicația recalculează pentru el. Așadar, ghidul numește pentru fiecare principiu instrumentele pe care asistentul le folosește și explică ce face asistentul cu *Datele înregistrate* sau cu un calcul eșuat. Ghidul este în engleză, ca tot ce citește asistentul prin legătură; instrumentul acceptă totuși o alegere de limbă pentru asistenții mai vechi, dar aceasta nu schimbă textul. Îl puteți citi și dumneavoastră la adresa `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Promptul de conectare din fereastra *Date de conectare* cere asistentului să citească mai întâi ghidul. Instrumentul funcționează și cât timp este deschisă o fereastră de dialog, în pauză și în modul doar în citire, pentru că nu citește planificarea dumneavoastră.

**Două skill-uri.** Un skill este un fișier mic cu instrucțiuni pe care asistentul îl citește în fiecare sesiune. Sunt două, pentru că sunt două feluri de lucru. Configurarea unei planificări ține de logică; actualizarea progresului ține de fapte pe care le cunoașteți doar dumneavoastră. Skill-ul *goed-plannen* este pentru configurarea sau reorganizarea unei planificări: ordinea în care se folosesc instrumentele, regula de recalculare, `planner_batch` și obligația de a raporta presupunerile. Skill-ul *progress-update* este pentru actualizarea săptămânală a progresului: mai întâi data raportului de stare, apoi datele efective de început și de sfârșit și procentul de finalizare, iar după aceea un raport al varianței față de referință, al drumului critic și al noii date de sfârșit. Principiile de planificare se află în ghid. Ambele skill-uri sunt în engleză. Instrumentul le returnează pe amândouă, cu locul unde aparțin. Cum le instalați, este descris în [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen).

## Un exemplu

Cereți unui asistent: construiți o anexă cu fundație, zidărie și acoperiș, în această ordine. Proiectul dumneavoastră începe luni, 2 martie 2026. Asistentul citește mai întâi ghidul și trimite apoi un singur script:

1. începutul proiectului la 2 martie 2026;
2. trei activități: Foundation cu o durată de 5 zile lucrătoare, Brickwork de 10 și Roof de 4;
3. două dependențe sfârșit-început: de la Foundation la Brickwork, de la Brickwork la Roof.

Aplicația execută cei trei pași și recalculează. Dacă asistentul citește apoi datele înapoi, constată: sfârșitul proiectului joi, 26 martie 2026, durata proiectului 19 zile lucrătoare, toate cele trei activități critice. Aceasta se potrivește cu suma: 5 + 10 + 4 fac 19 zile lucrătoare, iar 19 zile lucrătoare după luni, 2 martie, se încheie joi, 26 martie. Întregul script este un singur pas în istoricul dumneavoastră. O *Anulare* elimină cele trei activități, cele două dependențe și noul început al proiectului.

Acum o variantă ipotetică. Apoi cereți asistentului să actualizeze progresul, iar pentru aceasta el setează data raportului de stare la luni, 16 martie. Data raportului de stare nu este o simplă etichetă: activitățile care nu au început nu pot fi înaintea acestei date și se mută până la ea. Fără nicio înregistrare de progres, întreaga planificare se deplasează astfel: Foundation din 16 până în 20 martie, Brickwork din 23 martie până în 7 aprilie și Roof din 8 până în 13 aprilie. Sfârșitul proiectului sare de la 26 martie la 13 aprilie. Planificarea avansează cu două săptămâni lucrătoare, iar calendarul din acest exemplu, *Bouwkalender NL*, are Vinerea Mare (3 aprilie) și Paștele (5 și 6 aprilie). Aceste două zile libere din timpul săptămânii împing sfârșitul cu încă două zile. De aceea asistentul setează data raportului de stare doar la cererea dumneavoastră și doar când există progres real de înregistrat.

## Consecințe pentru planificarea dumneavoastră și idei greșite frecvente

**Asistentul nu are o copie proprie.** Ce modifică, modifică proiectul dumneavoastră. Cu *Copia de rezervă automată* activată, aveți o copie de rezervă IFC înainte de prima modificare. Cu *Doar în citire*, asistentul poate analiza fără să modifice nimic.

**Un token nou întrerupe toate conexiunile.** Tokenul este parola punții. Un token nou invalidează pe cel vechi, chiar și pe o punte care rulează, iar asistentului trebuie să i se dea cel nou.

**Faptul că asistentul spune că a reușit nu este dovadă.** Panoul de activitate arată ce instrument a apelat el de fapt și ce a revenit. Un refuz numește aproape întotdeauna câmpul greșit și calea care funcționează.

**Asistentul nu poate face o variantă ipotetică cu anulare.** Istoricul de anulare îl împarte cu dumneavoastră, așa că pentru variante dublează documentul cu `planner_duplicate_document`. Copia este detașată, nu are cale de fișier și apare ca nesalvată. Asistentul nu închide variantele; hotărâți dumneavoastră asta.

**Un export al asistentului nu este o salvare.** Scrie un fișier IFC la o cale pe care o alege singur, în folderul dumneavoastră de utilizator, și suprascrie un fișier existent doar dacă cere explicit acest lucru. Proiectul dumneavoastră rămâne nesalvat în aplicație și își păstrează propria destinație de salvare. Dacă importă un fișier, acesta se deschide într-o filă nouă sau într-o filă goală, nemodificată.

## Vezi și

- [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen): pașii pentru a porni puntea, a conecta un asistent și a instala skill-ul.
- [Instrumentele AI](docs://ref-ai-tools): toate instrumentele pe grupe, ce refuză și cât timp se păstrează copiile de rezervă.
- [Planificarea corectă](docs://gids-goed-plannen): principiile de planificare; asistentul le primește într-o versiune în engleză, cu instrumentele adăugate.
- [Progres, data raportului de stare și referința](docs://uitleg-voortgang): ce face data raportului de stare cu planificarea dumneavoastră.
