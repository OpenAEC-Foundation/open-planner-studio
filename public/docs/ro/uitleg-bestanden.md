# Fișiere și formate

Ce se află de fapt în fișierul pe care îl salvați? Și ce se întâmplă cu planificarea dumneavoastră când o exportați într-o altă aplicație? În acest articol citiți cum tratează aplicația fișierele: IFC ca format propriu, celelalte formate ca traducători, ce lasă în urmă un export și cum se deosebesc salvarea, AutoSave și refacerea în urma unei căderi. Exemplul de la final arată cu cifre ce face un export.

## Conceptul

Open Planner Studio are un singur format de fișier propriu: **IFC**, un format deschis de schimb pentru informații de construcție de la buildingSMART. Aplicația scrie IFC 4.3; în lista de export se numește *IFC 4x3*. Nu există un al doilea fișier de proiect, proprietar. *Salvare* scrie întregul proiect într-un fișier IFC (`.ifc`), iar *Deschidere* citește înapoi un astfel de fișier. Doriți să vedeți ce intră în fișier? Fila *IFC* arată textul IFC al proiectului dumneavoastră; *Generare IFC* reîmprospătează acest text.

Toate celelalte formate sunt **adaptoare**: traducători între modelul unei alte aplicații și cel al aplicației dumneavoastră. Aplicația citește CSV, MS Project XML, Primavera P6 XML, fișiere MS Project (`.mpp`) și fișiere Primavera (`.xer`). Ea scrie CSV, MS Project XML, Primavera P6 XML și două foi de progres. Nu puteți exporta în `.mpp` sau `.xer`.

De ce contează această deosebire? Un traducător poate duce mai departe doar ce știu ambele părți. Fișierul IFC al aplicației păstrează tot ce ține de proiectul dumneavoastră. Fiecare alt format nu cunoaște o parte din el, iar acea parte rămâne în urmă.

## Cum tratează aplicația fișierele

### Ce face deschiderea

Aplicația alege cititorul după extensia fișierului: `.ifc`, `.csv`, `.xml`, `.mpp` sau `.xer`. La un fișier `.xml` se uită în fișier pentru a vedea dacă este MS Project XML sau Primavera P6 XML. Extensia necunoscută a fișierului se tratează ca IFC. Dacă fișierul nu este IFC, aplicația afișează *Deschiderea fișierului a eșuat*, cu motivul.

Fiecare fișier se deschide într-o filă proprie. Excepția este o filă care este încă goală și nemodificată: această filă preia fișierul. Un singur fișier Primavera poate produce mai multe file, câte una pentru fiecare proiect care are activități.

După deschidere, aplicația recalculează întotdeauna. Dacă fișierul vine de la altă aplicație, datele pot fi diferite de ce spunea fișierul. Acest lucru este descris în [Datele cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen).

Numai un fișier IFC devine **ținta salvării**: fișierul în care *Salvare* scrie înapoi. Un fișier CSV, XML, `.mpp` sau `.xer` nu devine. Un astfel de proiect nu are fișier după deschidere; *Salvare* întreabă atunci unde trebuie să fie noul fișier IFC. Așa, apăsarea combinației Ctrl+S nu suprascrie niciodată fișierul dumneavoastră original cu text IFC.

### Ce scrie salvarea

*Salvare* scrie întotdeauna întregul proiect. Acestea intră în fișier:

- activități cu structură, durată, date și progres;
- dependențe cu decalaj, restricții și termene limită;
- calendare, resurse și atribuiri, inclusiv curbele;
- referințe, coduri de activitate, câmpuri particularizate și note;
- legăturile între proiecte;
- setările proiectului, cum sunt data raportului de stare, profilul de calcul și opțiunile de calcul;
- legătura către o bibliotecă de resurse.

Ce setați pe ecran nu ține de proiect și nu merge în fișier: zoom-ul, poziția de derulare, activitatea selectată și fazele restrânse. Setările dumneavoastră pentru aplicație, cum sunt limba și tema, nu se află nici ele în fișier. Aplicația le păstrează singură, în aplicație sau în browserul dumneavoastră.

Un export într-un alt format nu modifică proiectul dumneavoastră. După un export, proiectul are în continuare aceeași țintă a salvării și rămâne marcat *Nesalvat*, dacă era marcat înainte.

### Ce pierde un export

Fiecare adaptor duce mai departe ce știe formatul său.

**MS Project XML** duce mai departe activități, dependențe, calendare, resurse, atribuiri, restricții, termene limită și data raportului de stare. Din referințele dumneavoastră merge doar cea activă. Codurile de activitate, câmpurile particularizate, notele și legăturile între proiecte nu merg mai departe. A doua restricție a unei activități nu merge mai departe. O restricție *Trebuie să înceapă la (MSO)* sau *Trebuie să se termine la (MFO)* fără opțiunea *Obligatoriu (logica de fixare)* revine ca *Nu începe înainte de (SNET)* sau *Nu se termină mai devreme de (FNET)*. *Planificat manual* și *Întârziere prin redistribuire* ale unei activități nu revin. Un hamac devine o activitate obișnuită cu date calculate.

**Primavera P6 XML** duce mai departe activități, dependențe, calendare, resurse, atribuiri, restricții și data raportului de stare. Referințele și termenele limită nu merg mai departe, la fel nu merg codurile de activitate, câmpurile particularizate, notele și legăturile între proiecte. Un hamac devine și aici o activitate obișnuită. P6 nu are decalaj în procente: aplicația convertește un astfel de decalaj într-un număr fix de zile. Un decalaj în zile calendaristice devine un decalaj în zile lucrătoare.

**CSV** este o listă de activități. Fișierul are pentru fiecare activitate aceste coloane: task id, WBS, level, name, duration, start, finish, predecessors, type, id-ul unui tip de activitate particularizat (`OPS Custom Task Type ID`), status, completion, actual start and finish, critical, total float și description. Resursele, atribuirile, calendarele, restricțiile, termenele limită, referințele și data raportului de stare nu se află în el. Denumirile coloanelor sunt întotdeauna în engleză.

**Numai IFC păstrează profilul de calcul și opțiunile de calcul.** Dacă exportați în CSV, MS Project XML sau Primavera P6 XML, profilul nu se află în fișier; din opțiunile de calcul, MS Project XML scrie cel mult pragul critic. Un astfel de fișier se redeschide ca *Open Planner Studio*. Dacă proiectul dumneavoastră a fost calculat cu *Primavera P6* sau *Microsoft Project*, de exemplu pentru că a venit dintr-un `.xer` sau `.mpp`, datele se pot deplasa din cauza aceasta. Ce este un profil de calcul este explicat în [Profiluri de calcul și convenții](docs://uitleg-rekenprofielen).

Dacă proiectul dumneavoastră provine dintr-un fișier Primavera (`.xer`), chiar dacă l-ați salvat între timp ca IFC, aplicația afișează după un export în CSV, MS Project XML sau P6 XML: *La exportul în CSV se pierd informațiile sursă din XER.* Pentru MS Project XML apare *MSPDI* în loc de *CSV*, pentru P6 XML apare *P6*. Pentru IFC nu primiți acest mesaj: fișierul IFC păstrează și fișierul sursă Primavera. Vedeți [Deschiderea unui fișier Primavera P6 (.xer)](docs://howto-xer-openen).

Aplicația mai face două lucruri la un export. Dacă planificarea nu este actualizată, aplicația recalculează mai întâi și exportă după aceea. Și nu exportă o planificare cu o dependență circulară: primiți un mesaj care arată bucla, de exemplu *Dependență circulară între activități: Set up site → Demolish existing extension → Set up site*.

### Salvare, AutoSave și refacerea în urma unei căderi

Acestea sunt trei lucruri diferite. Arată asemănător, dar scriu în alt loc.

**Salvarea** este ceva ce faceți dumneavoastră. Aplicația scrie proiectul în fișierul dumneavoastră și elimină marcajul *Nesalvat*.

**AutoSave** este dezactivat implicit, iar îl activați singur pentru fiecare proiect. Aplicația scrie apoi, fără fereastră, în același fișier ori de câte ori există modificări, cel mult o dată la zece secunde. Funcționează doar dacă proiectul are deja un fișier. Vedeți [Activarea AutoSave](docs://howto-automatisch-opslaan).

**Refacerea în urma unei căderi** este mereu activată. De îndată ce apare o modificare oriunde, aplicația păstrează și ea, cel mult o dată la zece secunde, o copie de refacere a tuturor proiectelor deschise, inclusiv a proiectelor pe care nu le-ați modificat singur. Copia nu se află în fișierul proiectului: în aplicația desktop se află în folderul de date al aplicației, iar în browser se află în spațiul de stocare al browserului. La următoarea pornire aplicația oferă această copie. Despre aceasta citiți în [Refacerea după o cădere](docs://howto-herstellen-na-een-crash). Refacerea în urma unei căderi nu scrie niciodată în fișierul proiectului dumneavoastră.

Pentru că o copie se păstrează cel mult o dată la zece secunde, puteți pierde ultimele secunde de lucru într-o cădere.

### Desktop și browser

Aplicația desktop și versiunea din browser fac același lucru cu proiectul dumneavoastră, dar scriu fișierele în mod diferit.

Pe desktop, aplicația lucrează cu căi reale. *Salvare* scrie direct în fișierul dumneavoastră. De obicei, aplicația scrie mai întâi într-un fișier temporar de lângă el (`.ops-save.tmp`) și abia apoi îl înlocuiește pe al dumneavoastră, astfel încât o cădere la jumătatea scrierii nu strică fișierul vechi. Dacă închideți aplicația cu modificări, aceasta întreabă pentru fiecare proiect dacă doriți să salvați. La o ieșire normală, aplicația șterge copiile sale de refacere.

Într-un browser care poate păstra fișiere oriunde doriți (cum sunt Chrome și Edge) primiți o fereastră obișnuită de deschidere și salvare. După aceea, *Salvare* scrie direct în fișier; pentru un fișier pe care l-ați deschis, browserul cere permisiunea o singură dată. Lista *Recente* funcționează, doar cu numele fișierelor.

Într-un browser fără această posibilitate (cum este Firefox) aplicația deschide un fișier prin selectorul de fișiere și salvează printr-o descărcare. Cu *Salvare*, mesajul *Salvat ca descărcare: „name.ifc” se află în folderul de descărcări. …* explică acest lucru o dată pe sesiune; cu *Salvare ca* și la exporturi vedeți *Salvat ca descărcare: „name.ifc” se află acum în folderul de descărcări. Acest mediu nu permite aplicației să scrie direct în locația aleasă.* Dacă browserul poate afișa o fereastră de salvare, dar nu poate scrie înapoi în fișierul proiectului, *Salvare* cere din nou un loc de fiecare dată. Un mesaj explică și acest lucru o dată pe sesiune. *Fișier › Recente* există, dar deschide o pagină goală, iar AutoSave nu este disponibil. Primiți același mesaj în orice mediu care nu permite aplicației să scrie în locația aleasă.

## Exemplu: exportul proiectului de exemplu

Luați exemplul *Refurbishment & Extension of a Family Home* (*Fișier › Exemple*). Are 20 de activități, din care 4 faze și 2 jaloane, și 16 dependențe. Sunt 6 resurse cu 8 atribuiri, 1 referință și o legătură către *Demo resource library*. Activitatea *Demolish existing extension* are restricția *Nu începe înainte de (SNET)* la 14 mai 2027, iar *Handover inspection* are un termen limită la 29 iulie 2027. Planificarea se încheie la 7 iulie 2027.

Așa revine proiectul din fiecare format, măsurat după ce fișierul exportat este deschis din nou:

- Fișierul IFC redă totul: 20 de activități, 16 dependențe, 6 resurse, 8 atribuiri, referința, restricția, termenul limită și legătura către bibliotecă. Planificarea se încheie din nou la 7 iulie 2027.
- Fișierul MS Project XML redă de asemenea totul, în afară de legătura către bibliotecă. Planificarea se încheie la 7 iulie 2027.
- Fișierul P6 XML redă activitățile, dependențele, resursele, atribuirile și restricția. Referința și termenul limită lipsesc. Planificarea se încheie în continuare la 7 iulie 2027, pentru că restricția este încă în ea.
- Fișierul CSV redă 20 de activități și 16 dependențe. Resursele, atribuirile, referința, restricția și termenul limită lipsesc, iar proiectul se numește *CSV Import*. Fără restricție, activitățile se mută înainte: planificarea se încheie la 2 iulie 2027, cu cinci zile calendaristice mai devreme.

Fără această restricție, și exemplul în sine se încheie la 2 iulie 2027. Deci diferența vine din restricția pe care fișierul CSV nu o păstrează.

## Consecințe și neînțelegeri

**Un export nu este o copie de rezervă.** Numai IFC păstrează totul. Dacă doriți să păstrați proiectul, salvați-l ca IFC. Exportați doar pentru cineva care are nevoie de celălalt format.

**Redeschiderea unui export nu dă întotdeauna aceeași planificare.** Aplicația recalculează întotdeauna la deschidere, cu profilul de calcul care aparține formatului. Dacă lipsește logica, ca restricția din exemplul CSV, sau profilul calculează altfel, rezultatul se schimbă.

**Un export apare și în *Recente*.** Pe desktop și în browserele cu acces la fișiere, un export ajunge în *Recente*, la fel ca un proiect salvat (foile de progres nu). Dacă îl deschideți de acolo, se deschide ca import al acelui format.

**Salvarea nu este același lucru ca refacerea în urma unei căderi.** Refacerea în urma unei căderi ajută după o cădere, dar nu înlocuiește salvarea. Salvați deci înainte să închideți o filă sau aplicația.

## Vezi și

- [Deschiderea și salvarea unui fișier](docs://howto-bestand-openen-en-opslaan): pașii pentru deschidere, salvare și salvare ca.
- [Exportul](docs://howto-exporteren): alegerea unui format și ce primiți.
- [Datele cum au fost înregistrate](docs://uitleg-datums-zoals-opgeslagen): de ce o planificare importată poate afișa alte date.
- [Restricții și termene limită](docs://uitleg-constraints): ce face o restricție și, deci, ce dispare dacă lipsește.
- [Dependențe și decalaj](docs://uitleg-relaties): ce este un decalaj și cum îl calculează aplicația.
- [Crearea unui hamac](docs://howto-hammock): ce este un hamac, pe care un export îl scrie ca activitate obișnuită.
- [Coduri și câmpuri particularizate](docs://howto-codes-en-velden): codurile de activitate și câmpurile particularizate, pe care le păstrează doar IFC.
- [Legăturile între proiecte](docs://howto-externe-relaties): legăturile pe care MS Project XML și P6 XML nu le duc mai departe.
- [Salvarea și gestionarea unei referințe](docs://howto-baseline-opslaan-en-beheren): referințe, din care MS Project XML duce mai departe doar pe cea activă.
- [Formate de import și export](docs://ref-import-exportformaten): pentru fiecare format, ce se duce mai departe și ce nu.
