# Scindarea unei activități

Obiectiv: întrerupeți o activitate, astfel încât lucrul să se oprească și să continue mai târziu, fără să o transformați în două activități.

## Când aveți nevoie de acest lucru

Montarea armăturii durează opt zile lucrătoare, dar după patru zile macaraua trebuie să plece la alt șantier, iar lucrul continuă cu două zile mai târziu. Două activități separate înseamnă că trebuie să mențineți dependențele și atribuirile de două ori. Cu o **întrerupere** rămâne o singură activitate, cu o bară care are un gol. Aplicația mai folosește și numele *întrerupere*.

Lucrul rămâne la fel de lung, dar activitatea durează mai mult în calendar. Un exemplu: o activitate de 8 zile lucrătoare care începe marți, 29 septembrie 2026, se termină joi, 8 octombrie. Dacă puneți o întrerupere de 2 zile lucrătoare după 4 zile lucrătoare, se termină luni, 12 octombrie. Durata rămâne de 8 zile lucrătoare; se mută doar sfârșitul, cu două zile lucrătoare.

## Pași

### Scindarea în diagrama Gantt

1. Alegeți *Acasă › Activități › Scindare activitate* (sau *Planificare › Dependențe › Scindare activitate*). Deasupra planificării apare anunțul *Faceți clic pe o bară în ziua în care începe întreruperea și trageți spre dreapta pentru durată. Apăsați Esc pentru a opri.* Butonul se află și pe fila *Tabel* (*Tabel › Activități › Scindare activitate*), dar acolo este dezactivat.
2. Mutați mouse-ul peste bară. O linie punctată și o etichetă cu data arată unde ar începe întreruperea. Apăsați pe bară, în ziua în care începe întreruperea.
3. Trageți spre dreapta. Eticheta arată lungimea, de exemplu *întrerupere de 2 zile lucrătoare*: distanța, în zile lucrătoare, până la ziua de sub mouse. Eliberați.

Dacă faceți doar clic, fără să trageți, întreruperea devine de o zi lucrătoare. Trăgând înapoi spre stânga, întreruperea devine din nou mai scurtă, până la un minim de o zi lucrătoare. Pentru o activitate pe ore, funcționează în ore.

Modul rămâne activ, ca să puteți scinda mai multe activități. Ieșiți cu Esc sau cu butonul *Oprire* din anunț. Dacă apăsați Esc în timp ce trageți, aplicația anulează întreruperea și modul se oprește. Fiecare gest se poate anula într-un singur pas cu *Anulare*.

După o scindare, planificarea nu mai este actualizată. Apăsați **Calculare** (F5) pentru datele finale.

### Tragerea unei întreruperi existente în diagrama Gantt

Acest lucru funcționează fără modul de scindare, direct pe o bară care are o întrerupere.

- Trageți bucata **după** întrerupere spre dreapta sau spre stânga. Întreruperea devine mai lungă sau mai scurtă, cu eticheta *întrerupere de 3 zile lucrătoare*. Dacă o trageți înapoi până când întreruperea este 0, eticheta arată *Combinare*, iar cele două bucăți sunt din nou una singură.
- Trageți marginea dreaptă a bucății **dinaintea** întreruperii. Bucata devine mai lungă sau mai scurtă, cu eticheta *Bucată: 5 zile lucrătoare*. Durata activității se schimbă împreună cu ea.
- Dacă trageți prima bucată, mutați întreaga activitate, la fel ca la orice bară.

### Scindarea și ajustarea în panoul de proprietăți

Selectați activitatea. În panoul *Proprietăți*, blocul *Întreruperi* se află sub *Dependențe* și deasupra *Atribuiri*. Derulați până acolo, dacă este nevoie.

- *Adăugare întrerupere* pune o întrerupere de o zi lucrătoare la jumătatea celei mai lungi bucăți.
- Fiecare întrerupere are două casete: *după* (câte zile lucrătoare de lucru sunt înainte de întrerupere) și *întrerupere* (lungimea întreruperii). Lângă ele sunt datele bucății de după întrerupere. Pentru o activitate pe ore, acestea arată ore.
- Dacă setați *întrerupere* la 0, întreruperea dispare. Coșul mic (*Eliminare întrerupere*) face același lucru.

Aveți grijă cu *după*: această casetă lungește sau scurtează bucata de lucru dinaintea întreruperii și, odată cu ea, durata întregii activități. Cu *întrerupere* se modifică doar sfârșitul.

### Eliminarea unei întreruperi

Faceți clic dreapta pe întrerupere în diagrama Gantt, sau pe bucata de după ea, și alegeți *Eliminare întrerupere*. *Eliminare tuturor întreruperilor* se află în meniul cu clic dreapta al fiecărei bare care are o întrerupere. Sau folosiți blocul *Întreruperi* din panoul *Proprietăți*, ca mai sus.

### Cu un asistent de inteligență artificială

Un asistent de inteligență artificială conectat setează întreruperi cu instrumentul `planner_set_task_splits`, în aceeași formă ca în panou: după câte zile lucrătoare (sau ore de lucru) de lucru, și câte zile lucrătoare (sau ore de lucru) de întrerupere. Asistentul trimite întotdeauna întreaga listă; o listă goală elimină toate întreruperile. El le citește cu `planner_get_task`. Se aplică aceleași reguli ca mai jos: nu puteți scinda o activitate, iar nici asistentul nu o poate scinda. Spre deosebire de o scindare pe care o faceți dumneavoastră, aplicația recalculează singură planificarea după aceea. Cum conectați un asistent este descris în [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen).

## Capcane și ce face aplicația

**Nu fiecare activitate poate fi scindată.** Nu puteți scinda un jalon, o activitate rezumat, o activitate cu *Hamac (durată derivată)* activat (vezi [Crearea unui hamac](docs://howto-hammock)), o activitate cu tipul de durată *Timp scurs*, o activitate *Planificat manual* sau o activitate mai scurtă de două zile lucrătoare. În modul de scindare, cursorul mouse-ului arată un cursor de interzicere și nu se întâmplă nimic. Pentru o astfel de activitate, blocul *Întreruperi* lipsește și din panoul *Proprietăți*.

**Pe fila Tabel butonul nu funcționează.** *Scindare activitate* este dezactivat acolo, cu textul de ajutor *Disponibil doar când diagrama Gantt este vizibilă*. Gestul are nevoie de o bară. Modul de scindare și modul de legare se opresc reciproc.

**Un clic fără efect.** O întrerupere nu poate începe în prima zi a activității și nici în interiorul unei întreruperi existente. Fiecare bucată de lucru trebuie, de asemenea, să rămână cel puțin o zi lucrătoare. Dacă faceți clic într-un astfel de loc, nu se întâmplă nimic, fără niciun mesaj.

**O activitate cu progres.** Dacă activitatea are progres, o întrerupere poate începe doar după lucrul deja efectuat. La 50% din 8 zile lucrătoare, cel mai devreme este a cincea zi lucrătoare. Un clic în partea deja finalizată nu face nimic, iar o activitate cu procent de finalizare de 100% nu mai poate fi scindată. În panou, *Adăugare întrerupere* este atunci dezactivat. Asta se aplică și dacă mijlocul celei mai lungi bucăți cade în lucrul deja efectuat, de exemplu la 75% din 8 zile lucrătoare.

**Redistribuirea creează și întreruperi.** Acestea apar în blocul *Întreruperi* cu eticheta *redistribuire*. *Resurse › Redistribuire › Ștergere redistribuire* le elimină din nou. Dacă editați singur întreruperile unei astfel de activități, toate întreruperile de redistribuire devin ale dumneavoastră, iar *Ștergere redistribuire* nu le mai elimină.

**Întreruperile nu ajung în MS Project sau Primavera.** Dacă exportați în *MS Project XML* sau *Primavera P6 XML*, acel program cunoaște o întrerupere doar ca distribuție a lucrului unei atribuiri. Fără o astfel de distribuție, activitatea ajunge fără întrerupere, iar aplicația arată câte activități sunt: *1 activitate cu întreruperi a fost exportată fără întreruperile ei: MS Project și P6 cunosc întreruperile doar ca distribuție a lucrului.* În fișierul IFC al aplicației, întreruperile se păstrează.

**Un fișier cu întreruperi pe care aplicația nu le poate edita.** Întreruperile dintr-un fișier sursă care nu se potrivesc cu formularul aplicației afișează în panou mesajul *Aceste întreruperi provin din fișierul sursă, într-o formă care nu poate fi editată aici*, cu doar *Eliminare tuturor întreruperilor*.

## Vezi și

- [Drum critic și marjă](docs://uitleg-kritiek-pad): cum numără planificarea în zile lucrătoare și de ce se mută sfârșitul.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): un alt mod în diagrama Gantt, pe care îl folosiți trăgând o bară.
- [Fereastra activității și panoul de proprietăți](docs://ref-taak-eigenschappen): secțiunea *Întreruperi* din panoul *Proprietăți*.
