# Panglica, filă cu filă

Panglica din partea de sus a ecranului are file. Fiecare filă are grupuri de butoane. Acest articol spune, pentru fiecare buton, ce face și unde vedeți rezultatul. Cum faceți pas cu pas o acțiune se află în ghidurile practice. Aici căutați ce face un buton. Un buton care există sau funcționează doar sub o condiție are condiția lângă el.

## Cum se comportă panglica

- **Filele** — *Fișier* este în stânga, apoi *Acasă*, *Planificare*, *Resurse*, *Vizualizare*, *Setări*, *Tabel*, *IFC*, *Raport* și, doar cu modul AI activat, *AI*.
- **Fereastră îngustă** — când panglica nu încape, butoanele se micșorează la o pictogramă, de la dreapta spre stânga. Numele apare atunci ca text de ajutor pe buton. Fiecare buton fără propriul text de ajutor arată numele său.
- **Restrângerea panglicii** — săgeata mică din dreapta jos a panglicii o transformă într-o bară plată cu doar pictograme. Zona *Referințe și progres* și zona *Conexiune* din fila *AI* dispar atunci în spatele unui singur buton cu fereastră pop-up. Implicit: extinsă. Alegerea dumneavoastră este reținută.
- **Butoane de extensie** — o extensie poate adăuga propria zonă la sfârșitul unei file. Un astfel de buton face ce i-a dat extensia.

## Fișier

Când faceți clic pe *Fișier*, un ecran propriu (Backstage) ocupă spațiul de lucru. Acest ecran nu are panglică. *Înapoi* închide ecranul. Dacă ați schimbat ceva la *Informații proiect* și nu ați aplicat, aplicația vă întreabă mai întâi ce să faceți cu modificarea.

- **Nou** — deschide fereastra *Creare proiect nou* și închide Backstage. Câmpurile sunt în [Proiect nou și Informații proiect](docs://ref-projectinfo).
- **Deschidere** — alegeți un fișier și îl deschideți ca document. Închide Backstage.
- **Recente** — listă cu proiectele deschise recent; un clic deschide unul. Este vizibil doar când mediul poate redeschide fișiere: în aplicația desktop și în browsere cu acces la fișiere, de exemplu Chrome și Edge. În alte browsere butonul există, dar pagina rămâne goală.
- **Exemple** — planificări de exemplu incluse în aplicație, împărțite în *Planificări complete de prezentare* (insigna *Toate funcțiile*) și *Exemple simple*. Un clic deschide una într-o filă nouă.
- **Salvare** — scrie proiectul în fișierul acestui document. Dacă documentul nu are încă un fișier, alegeți mai întâi un nume și un loc. Un fișier deschis într-un alt format decât IFC nu se suprascrie niciodată. Atunci *Salvare* cere un nume și un loc pentru un fișier IFC.
- **Salvare ca** — alegeți un nume nou sau un loc nou și salvați acolo ca IFC.
- **Export** — carduri pentru fiecare format de export, cu o descriere. Un clic convertește proiectul și îl salvează, apoi vă duce înapoi la *Acasă*. Dacă planificarea are un ciclu, eroarea apare în Backstage și rămâneți acolo. Dacă proiectul este legat de o bibliotecă de resurse, sub listă apare caseta *Salvare fișier bibliotecă alături*. Ea funcționează doar pentru cardul IFC.
- **Import** — sus cardul *Actualizare progres din foaie de calcul* (dezactivat fără activități), dedesubt importatorii pe care îi adaugă extensiile.
- **Tipărire** — butonul *Deschidere previzualizare la imprimare* vă duce la fila *Raport*.
- **Informații proiect** — metadatele și profilul de calcul al acestui proiect. Modificările au efect doar după *Aplicare*. Vezi [Proiect nou și Informații proiect](docs://ref-projectinfo) și [Profiluri de calcul și convenții de calcul](docs://uitleg-rekenprofielen).
- **Setări** — aceleași setări ca în fereastra *Setări*.
- **Extensii** — administrarea și instalarea extensiilor; vezi [Instalarea și administrarea unei extensii](docs://howto-extensie-installeren).
- **Bibliotecă** — administrarea bibliotecilor de resurse; vezi [Administrarea și partajarea bibliotecilor de resurse](docs://howto-bibliotheken-beheren).
- **Ajutor** — documentația încorporată, și cu F1. Câmpul de căutare caută în titluri, în subtitluri și în textul propriu-zis. Articolele sunt în patru secțiuni: *Tutoriale*, *Ghiduri practice*, *Explicație* și *Referință*. Sub *Limba documentației* alegeți *Urmează limba aplicației*, *Nederlands* sau *English*. Ajutorul există doar în neerlandeză și engleză. Dacă aplicația are altă limbă, citiți versiunea engleză, cu o notă. Alegerea este păstrată pe acest dispozitiv, separat de limba aplicației. Puteți ajunge la Ajutor și dintr-o fereastră sau un panou. Multe ferestre și panourile *Proprietăți*, *Resurse* și *Avertismente* au un semn de întrebare în dreapta sus (*Ajutor pentru acest element*). Acesta deschide Ajutor la articolul despre fereastra sau panoul respectiv. Dacă ați introdus ceva în fereastră și nu este salvat încă, aplicația întreabă mai întâi *Salvare*, *Anulare* (renunțați la ce ați introdus) sau *Înapoi* (rămâneți în fereastră). Apoi fereastra se închide și se deschide Ajutorul. Câteva ferestre, cum ar fi *Editare activitate* și *Redistribuire resurse*, întreabă mereu. Fără date introduse, Ajutorul se deschide imediat.
- **Pornire tur ghidat** — închide Backstage și pornește turul de la pasul 1.
- **Închidere proiect** — închide documentul activ. Dacă are modificări nesalvate, aplicația cere confirmare.

## Acasă

### Acasă › Fișier

- **Nou**, **Salvare**, **Deschidere** și **Salvare ca** — aceleași acțiuni ca în *Fișier*.
- **Recente** — listă derulantă cu proiectele recente; un clic deschide unul. Vizibilă doar în aceleași condiții ca *Fișier › Recente*. Fără fișiere recente scrie *Niciun fișier recent*.
- **Export** — listă derulantă cu formatele de export (nume scurte). Un clic convertește proiectul și îl salvează.

### Acasă › Editare

- **Anulare** — anulează ultima modificare. Dezactivat când nu este nimic de anulat.
- **Refacere** — restabilește ultima modificare anulată. Dezactivat când nu este nimic de refăcut.
- **Ștergere** — șterge activitățile selectate, împreună cu subactivitățile lor, ca un singur pas. Dezactivat fără selecție.

### Acasă › Activități

- **Activitate** — adaugă o activitate cu numele *Creare activitate*, cu o durată de 5 zile lucrătoare, care începe la începutul proiectului. (Dacă *Activare planificare pe ore* este activată și *Unitate implicită pentru activități noi* din *Informații proiect* este ore, durata este de 5 ore.) Dacă o activitate este selectată și vizualizarea este arborele simplu, noua activitate apare direct sub cea mai de jos activitate selectată (text de ajutor *Activitate nouă direct sub selecție*). Fără selecție, apare la sfârșitul listei (text de ajutor *Activitate nouă la sfârșitul listei*). Cu o selecție, dar în timpul filtrării, grupării sau sortării, apare tot la sfârșitul listei. Un rând de text spune atunci *Indisponibil la filtrare, grupare sau sortare*. Noua activitate devine singura selecție, diagrama Gantt se mută la ea, iar numele ei este gata de suprascris în panoul *Proprietăți*.
- **Jalon ▾** — listă derulantă care pune un jalon (durată 0) în același loc ca *Activitate*. *Jalon de început* și *Jalon de sfârșit* stabilesc tipul jalonului. Noul jalon se numește *Jalon nou* și primește tipul de activitate *Altele*. *Moment de inspecție (obligatoriu)* creează un jalon de sfârșit cu tipul de activitate *Inspecție* și marcajul *Obligatoriu (prin contract)*, cu numele *Moment de inspecție nou*.
- **Legare ▾** — listă derulantă cu patru acțiuni fixe. Butonul principal nu își schimbă niciodată sensul. Vezi *Planificare › Dependențe* pentru cele patru acțiuni.
- **Scindare activitate** — pornește sau oprește modul de scindare. Pornit: un rând de text sub panglică explică să faceți clic pe o bară unde începe golul și să trageți spre dreapta pentru lungimea lui. Dezactivat când diagrama Gantt nu este vizibilă (în filele *Tabel*, *IFC* și *Raport* și sub panoul complet de resurse). Textul de ajutor spune atunci *Disponibil doar când diagrama Gantt este vizibilă*. Vezi [Scindarea unei activități](docs://howto-taak-splitsen).

### Acasă › Planificare

- **Calculare** — calculează planificarea: date, marjă, drumul critic și încărcarea resurselor. Acest lucru nu se întâmplă niciodată singur, decât dacă activați *Calculare automată* (*Setări*, fila *Planificare*, rubrica *Calculare*). Cât timp planificarea este învechită, bara de stare scrie *Învechit — recalculați (F5)*.

### Acasă › Zoom

- **Zoom +** — mărește axa de timp cu 10 pixeli pe zi.
- **Zoom -** — micșorează axa de timp cu 10 pixeli pe zi.

## Planificare

### Planificare › Planificare

Butonul *Calculare* este același ca în *Acasă*.

- **Mutarea proiectului…** — deschide fereastra *Mutarea proiectului*. Dezactivat fără început proiect. Vezi [Mutarea unui proiect](docs://howto-project-verplaatsen).
- **Avertismente** — afișează sau ascunde panoul *Avertismente* din coloana din dreapta. Butonul se aprinde cât timp vedeți panoul. Când îl activați, o coloană restrânsă se extinde. Ce apare în panou este descris în [Notificări și avertismente](docs://ref-meldingen).

### Planificare › Dependențe

Zona are butonul *Legare ▾* cu patru acțiuni și butonul *Scindare activitate* (la fel ca în *Acasă*). Cele patru acțiuni:

- **Desenare dependență** — pornește sau oprește modul de legare. Când este pornit, apare un semn de bifare și butonul principal se aprinde. Pornit: trageți de la o bară la alta în diagrama Gantt ca să creați o dependență. Un rând de text sub panglică spune cum se oprește (*Oprire* sau Esc). Dezactivat când diagrama Gantt nu este vizibilă.
- **Legare activități selectate** — creează o dependență sfârșit-început fără decalaj între două activități. Prima activitate selectată devine predecesorul. Disponibil doar cu exact două activități selectate (altfel *Selectați exact două activități*). O dependență duplicată sau un ciclu este refuzat, cu un mesaj.
- **Adăugare legătură între proiecte…** — deschide o fereastră ca să adăugați un predecesor sau un succesor extern la activitatea selectată. Disponibil doar cu exact o activitate selectată (altfel *Selectați exact o activitate*).
- **Reîmprospătare a tuturor legăturilor între proiecte** — reîmprospătează ancorele tuturor legăturilor între proiecte. În meniu arată câte au fost actualizate sau lipsesc. Disponibil doar când proiectul are legături între proiecte (altfel *Acest proiect nu conține legături între proiecte*).

Pentru motivele din spatele dependențelor vezi [Crearea dependențelor](docs://howto-relaties-leggen) și [Dependențe și decalaj](docs://uitleg-relaties).

### Planificare › Urmărire traseu

- **Predecesori** — evidențiază în diagrama Gantt predecesorii activităților selectate, lanț cu lanț.
- **Succesori** — evidențiază succesorii activităților selectate.

Puteți avea ambele active în același timp. Un al doilea clic pe un buton oprește acea parte. Legăturile determinante primesc o nuanță mai intensă. Vezi [Urmărirea unui traseu](docs://howto-pad-traceren).

### Planificare › Calendar

- **Calendar** — deschide fereastra *Calendare* cu biblioteca de calendare a proiectului. Vezi [Ferestrele de calendar](docs://ref-kalenders).

### Planificare › Structură

- **Coduri și câmpuri** — deschide fereastra *Coduri și câmpuri* pentru codurile de activitate și câmpurile particularizate. Vezi [Coduri și câmpuri particularizate](docs://howto-codes-en-velden).
- **WBS automat** — pornește sau oprește numerotarea automată a codurilor WBS. Implicit: dezactivat. Pornit: întreaga structură se renumerotează deodată. Codurile urmează apoi fiecare modificare a structurii. Câmpul *Cod WBS* din panou și din fereastră este dezactivat.
- **Renumerotare WBS** — renumerotează o singură dată codurile WBS, după poziția din arbore (1.2.3). Dezactivat cât timp *WBS automat* este activat.
- **Șabloane** — listă derulantă cu șabloane WBS salvate. Fiecare arată numărul său de activități și de dependențe. Un clic inserează șablonul sub activitatea selectată, sau la nivelul de sus fără selecție. Pictograma coșului de gunoi șterge un șablon. Fără șabloane scrie cum salvați unul (clic dreapta pe o activitate rezumat, *Salvare ramură ca șablon*). Vezi [Salvarea și inserarea șabloanelor WBS](docs://howto-wbs-sjablonen).
- **Indenta** — face din activitățile selectate subactivități ale activității de dinaintea lor. Dezactivat fără selecție și de îndată ce filtrați, grupați sau sortați. Textul de ajutor spune atunci *Indisponibil la filtrare, grupare sau sortare*.
- **Indenta negativ** — mută activitățile selectate cu un nivel mai sus, direct după activitatea lor părinte actuală. Aceleași condiții ca *Indenta*.

### Planificare › Referințe și progres

- **Gestionare referințe…** — deschide fereastra referințelor. Vezi [Salvarea și gestionarea unei referințe](docs://howto-baseline-opslaan-en-beheren).
- **Data raportului de stare** — data până la care măsurați progresul. Scrieți o dată. Crucea (*Golire data raportului de stare*) o șterge. Efect: progresul se măsoară până la acea dată. Linia datei raportului de stare și linia de progres din diagrama Gantt se află pe ea. Vezi [Progres, data raportului de stare și referința](docs://uitleg-voortgang).
- **Mod de progres** — o alegere între *Retained Logic* și *Progress Override*. Implicit: *Retained Logic*. Efect: cu *Retained Logic*, lucrul rămas al unei succesoare începute urmează dependența. Cu *Progress Override*, lucrul rămas începe la data raportului de stare, fără să aștepte predecesorul. Vezi [Alegerea modului de progres](docs://howto-voortgangsmodus-kiezen).

Când panglica este restrânsă, aceste trei se află în spatele unui singur buton cu steag, cu titlul *Referințe și progres*.

### Planificare › Progres

- **Export foaie de progres** — creează o foaie `.xlsx` cu activitățile, ca să completați progresul în afara aplicației. Dezactivat fără activități.
- **Actualizare progres din tabel de calcul** — deschide fereastra de import pentru o foaie returnată. Dezactivat fără activități. Vezi [Importul progresului dintr-un tabel de calcul](docs://howto-voortgang-importeren).

Zona aceasta se află și în filele *Tabel* și *Raport*.

## Resurse

### Resurse › Gestionare

- **Resurse** — deschide panoul complet de resurse. Acesta ocupă spațiul de lucru. Butonul se aprinde cât timp vedeți acel panou. Vezi [Panoul de resurse](docs://ref-resourcepaneel).
- **Ancorare panou resurse** — ancorează panoul compact de resurse în coloana din dreapta, lângă diagrama Gantt. Butonul se aprinde cât timp ancorarea este vizibilă. Un al doilea clic o închide. Ancorarea arată doar numele, culoarea, un avertisment la supraalocare și *Capacitate maximă*. Cu o selecție de activități, arată doar resursele acelor activități.
- **Resursă nouă** — deschide panoul complet de resurse cu un rând gol de ciornă pentru o resursă nouă. Nu se creează nimic până nu introduceți un nume. Dacă faceți clic în altă parte, nu rămâne nimic. Resursa ajunge în bibliotecă de resurse sau în proiect, în funcție de vizualizare.

### Resurse › Atribuire

- **Atribuire ▾** — atribuie o resursă activității selectate. Disponibil doar cu exact o activitate selectată, care nu are subactivități și nu este un jalon. Altfel butonul este gri. În meniu setați mai întâi *Unit./zi* (implicit 1) și *Curbă* (implicit *Uniform*). Un clic pe o resursă o atribuie cu aceste valori. Meniul listează doar resursele care nu sunt încă pe activitate. Vezi [Atribuirea resurselor cu o curbă](docs://howto-resource-toewijzen).

### Resurse › Histogramă

- **Histogramă** — afișează sau ascunde rândul cu histograma de sub diagrama Gantt. Implicit: dezactivat. Alegerea dumneavoastră este reținută.
- **Anterior** și **Următor** — treceți prin resursele din selectorul rândului cu histograma. *Toate resursele* este un pas suplimentar în rotație. Dezactivate când histograma este dezactivată sau proiectul nu are resurse.

### Resurse › Redistribuire

- **Redistribuire…** — deschide fereastra *Redistribuire resurse*. Vezi [Redistribuirea](docs://uitleg-nivelleren).
- **Golire redistribuire** — elimină întârzierile și golurile pe care le-a aplicat redistribuirea. Dezactivat când nicio activitate nu are un rezultat de redistribuire.

### Resurse › Supraalocare

- **Supraalocare** — nu un buton, ci un contor: numărul resurselor cu cel puțin o zi supraalocată, sau *Niciuna*. Devine roșu, cu o pictogramă de avertisment, din momentul în care există una. Numărul se reîmprospătează după *Calculare* și după modificările resurselor și atribuirilor. Dacă modificați datele activităților, se numără abia după *Calculare*.

## Vizualizare

### Vizualizare › Scară de timp

- **Zoom +** și **Zoom -** — măresc sau micșorează axa timpului cu 10 pixeli pe zi.
- **Resetare** — setează zoom-ul înapoi la valoarea implicită de 30 de pixeli pe zi.
- **Încadrare în proiect** — setează zoom-ul și derularea astfel încât tot proiectul să fie vizibil.
- **Alegere scară** — o listă cu *An*, *Trimestru*, *Lună*, *Săptămână*, *Zi* și, numai dacă *Activare planificare pe ore* este activată, *Oră*. O alegere fixează un zoom. Valoarea afișată urmează zoom-ul curent, iar sub ea zoom-ul se afișează în pixeli pe zi.

### Vizualizare › Afișare

- **Coloane…**, **Filtrare…**, **Grupare…** și **Sortare…** — vizibile numai dacă *Afișare butoane clasice de vizualizare* este activată (*Setări*, fila *Avansat*, titlul *Funcții vechi*). Implicit: dezactivat. *Coloane…* vă duce la *Tabel* și deschide acolo selectorul de coloane. *Filtrare…* deschide imediat fereastra de filtrare, atât timp cât nu există un filtru salvat. Cu filtre salvate, deschide un meniu cu *Filtrare…*, *Ștergere* (numai când un filtru este activ) și filtrele salvate. *Grupare…* permite două niveluri. *Sortare…* permite mai multe niveluri. Un buton se evidențiază când această setare de vizualizare este activă. În panglica actuală faceți acest lucru cu butoanele de aspect; consultați [Crearea și utilizarea unui aspect](docs://howto-layouts-gebruiken).

### Vizualizare › Schiță

- **Restrângere** — restrânge activitățile rezumat selectate; fără selecție, pe toate. Într-o vizualizare grupată, restrânge toate grupurile, iar o selecție nu are efect.
- **Extindere** — operația inversă.

### Vizualizare › Aspect

- **Butoane de aspect** — fiecare aspect este un comutator cu o pictogramă și un nume. *Diagrama resurselor* este inclus. Un clic îl activează, un alt clic îl dezactivează și readuce vizualizarea de dinaintea clicului. Aspectele cu părți diferite pot fi active împreună. Faceți clic dreapta pe un aspect: *Editare…*, *Duplicare* și *Ștergere* (după confirmare). Un aspect inclus poate fi numai duplicat.
- **Creare aspect** — deschide fereastra de aspect pentru un aspect nou.

### Vizualizare › Prezentare

- **Prezentare** — activează sau dezactivează modul prezentare (F11 sau Esc pentru oprire): numai diagrama Gantt ocupă ecranul. Consultați [Prezentarea pe un ecran mare](docs://howto-presentatie).
- **Vizualizare împărțită** — împarte diagrama Gantt în două ferestre de timp. Ambele încep cu zoom-ul și poziția curentă (împărțire 50 la sută), sau revin la o singură fereastră. Implicit: dezactivat. Consultați [Utilizarea vizualizării împărțite și a mini-hărții](docs://howto-split-view-en-mini-map).
- **Mini-hartă** — afișează sau ascunde mini-harta. Implicit: dezactivat. Alegerea dumneavoastră se reține.

### Vizualizare › Panouri

- **Proprietăți** — afișează sau ascunde panoul *Proprietăți* din coloana din dreapta. Implicit: activat. Consultați [Fereastra activității și panoul de proprietăți](docs://ref-taak-eigenschappen).

Butoanele *Resurse*, *Andocare resurse* și *Histogramă* sunt la fel ca la *Resurse*, iar *Avertismente* este la fel ca la *Planificare*.

### Vizualizare › Referințe și progres

Acest grup are același nume ca cel de la *Planificare*, dar conține opțiunile de desenare ale diagramei Gantt.

- **Suprapunere referință** — afișează referința activă ca o bară subțire sub fiecare bară de activitate. Implicit: activat. Fără o referință activă nu este nimic de văzut.
- **Linie de progres** — desenează o linie la data raportului de stare, care se bombează pentru fiecare activitate în funcție de progresul ei. Implicit: activat. Fără data raportului de stare nu este nimic de văzut. Când linia de progres este activată, această linie marchează și data raportului de stare.
- **Linia datei raportului de stare** — desenează o linie punctată la data raportului de stare. Implicit: activat. O vedeți numai când linia de progres este dezactivată, pentru că altfel aceasta îi ia locul. Eticheta cu data din antet rămâne cât timp cel puțin una dintre cele două este activată.
- **Culori bare** — alege cum se colorează barele: *Drum critic* (implicit), *Per activitate — automat* sau *Pe categorie*, cu o alegere de câmp. Dacă acest câmp nu există în proiect, meniul indică faptul că se folosește temporar *Tip de activitate*. Când nu este selectat *Drum critic*, un contur roșu marchează drumul critic. Alegerea se aplică și raportului.
- **Accent resursă** — desenează o fâșie subțire în culoarea resursei sub fiecare bară de activitate fără subactivități, împărțită proporțional cu unitățile pe zi. Implicit: dezactivat.
- **Zonă de marjă** — desenează zona verde după o bară necritică, până la sfârșitul târziu al activității. Implicit: activat.
- **Linii de dependență** — afișează sau ascunde liniile de dependență dintre activități. Implicit: activat. Alegerea aparține documentului și aspectului.

## Setări

### Setări › Proiect

- **Informații proiect** — deschide fereastra *Informații proiect*: metadatele proiectului și, în secțiunea *Profil de calcul și opțiuni de calcul*, modul în care aplicația calculează. Consultați [Proiect nou și Informații proiect](docs://ref-projectinfo).
- **Setări** — deschide fereastra *Setări* cu filele *Afișare*, *Planificare* și *Avansat*. Aceleași setări se găsesc la *Fișier › Setări*.

### Setări › Calendar

Butonul *Calendar* este la fel ca la *Planificare*.

### Setări › Comenzi rapide

- **Comenzi rapide** — deschide fereastra *Comenzi rapide*.

## Tabel

Fila *Tabel* arată activitățile ca un tabel complet, în loc de diagrama Gantt. Grupurile *Fișier*, *Editare*, *Activități*, *Planificare* și *Urmărire traseu* sunt la fel ca la *Acasă* și *Planificare* și acționează asupra aceleiași selecții. Nu există grupul *Zoom*, pentru că zoom-ul scalează doar axa timpului din diagrama Gantt. Butoanele *Scindare activitate* și *Trasare dependență* sunt dezactivate aici: nu există diagramă Gantt.

### Tabel › Coloane

- **Coloane…** — deschide selectorul de coloane al acestui tabel. Același selector se deschide cu semnul plus din antetul tabelului. Textul de ajutor spune *Alegeți coloanele vizualizării Tabel*. Consultați [Ajustarea coloanelor tabelului](docs://howto-tabelkolommen-aanpassen) și [Coloanele tabelului](docs://ref-tabelkolommen).

## IFC

Fila afișează panoul IFC în spațiul de lucru. Panglica nu are aici butoane, doar rândul de text *IFC 4x3 - Industry Foundation Classes*.

## Raport

### Raport › Raport

- **Imprimare** — numai în această filă, unde nu face nimic, deoarece *Raport* este deja deschis; alegerile de raport se află pe ecranul raportului.

## AI

Fila *AI* există numai când *Activare mod AI* este activată (*Setări*, fila *Avansat*, titlul *Mod AI*). Implicit: dezactivat. Dezactivarea elimină fila și oprește puntea. Un asistent de inteligență artificială lucrează cu planificarea dumneavoastră prin puntea MCP pe care o porniți aici. Consultați [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen).

### AI › Server

- **Pornire punte** și **Oprire punte** — pornesc sau opresc puntea MCP. Lângă ele se află starea: *Oprit*, *Activ pe portul …*, *Portul … este ocupat* (cu motivul) sau *Eroare*. Dezactivate în versiunea web; textul de ajutor spune *Puntea funcționează doar în aplicația desktop.* Aceeași stare apare ca un punct cu *AI* în bara de stare.

### AI › Conexiune

- **Port** — portul punții. Implicit: 3877. Poate fi modificat numai când starea este *Oprit* (text de ajutor: *Poate fi modificat doar când serverul este oprit.*).
- **Token** — parola punții, afișată ascunsă. Butoane mici *Afișare token*/*Ascundere token*, *Copiere* și *Creare token nou*. *Creare token nou* cere mai întâi confirmare, pentru că un token nou întrerupe toate conexiunile existente. Dacă puntea rulează, se repornește cu noul token.
- **Conectare** — afișează detaliile conexiunii: punctul final, tokenul, un fragment de configurare și un prompt de conexiune pe care îl lipiți în asistentul dumneavoastră de inteligență artificială.

### AI › Siguranță

- **Suspendare** / **Reluare** — refuză temporar toate modificările făcute de AI; citirea rămâne permisă, iar puntea rămâne activă. Butonul se aprinde în roșu cât timp este suspendat.
- **Doar în citire** — refuză toate instrumentele care modifică date, cât timp această opțiune este activată.
- **Copie de rezervă automată: activată** / **Copie de rezervă automată: dezactivată** — scrie automat o copie de rezervă IFC înainte de prima modificare făcută de AI, pentru fiecare document. Implicit: activat.
- **Creare copie de rezervă** — scrie imediat o copie de rezervă și afișează numele fișierului. Numai în aplicația desktop.
- **Deschidere dosar cu copii de rezervă** — deschide dosarul cu copiile de rezervă. Numai în aplicația desktop.

### AI › Activitate

- **Panou de activitate** — afișează sau ascunde panoul *Activitate AI* cu apelurile către punte, cu argumentele și răspunsul lor.
