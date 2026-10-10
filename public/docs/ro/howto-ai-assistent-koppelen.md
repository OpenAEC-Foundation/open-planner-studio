# Conectarea unui asistent de inteligență artificială (MCP)

Scop: lăsați un asistent de inteligență artificială să urmărească și să lucreze la planificarea dumneavoastră, cu vizibilitate asupra a ceea ce face și cu limite pe care le stabiliți dumneavoastră.

## Când aveți nevoie de aceasta

Doriți ca un asistent de inteligență artificială să citească, să analizeze sau să modifice planificarea dumneavoastră. De exemplu, să pregătească un prim WBS, să corecteze activități sau să explice drumul critic. Aceasta funcționează prin **Model Context Protocol** (MCP): un standard care permite unui asistent de inteligență artificială să folosească instrumentele unui program. Pentru aceasta, Open Planner Studio pornește un server mic pe computerul dumneavoastră, **puntea**. Puntea oferă un set de instrumente, toate cu un nume care începe cu `planner_`: citirea și modificarea activităților, dependențelor, resurselor, calendarelor, referințelor, documentelor și fișierelor. Ce instrumente există și ce nu permit ele este descris în [Instrumente AI](docs://ref-ai-tools). De ce funcționează legătura așa este descris în [Cum funcționează legătura AI](docs://uitleg-ai-koppeling).

Puntea funcționează doar în aplicația desktop. Dacă activați modul AI în browser, vedeți fila *AI*, dar butonul *Pornire bridge* este gri, cu textul *Puntea funcționează doar în aplicația desktop.* Restul acestui articol se referă la aplicația desktop. În browser, *Creare backup* și *Deschidere dosar backup* sunt tot gri.

## Pași

### 1. Activați modul AI

1. Alegeți *Setări › Proiect › Setări*. Puteți alege și *Fișier › Setări*, sau pictograma roată dințată din partea de sus.
2. Alegeți fila *Avansat* și activați *Activare mod AI*. Fila *AI* apare în panglică.
3. Dacă doriți ca puntea să fie activă de cum pornește aplicația, activați și *Pornire automată bridge*. Aceasta se activează doar când modul AI este activat și funcționează doar în aplicația desktop. Implicit este dezactivată, deoarece deschiderea unui port este o alegere deliberată.

Dacă dezactivați modul AI, puntea se oprește și fila *AI* dispare.

### 2. Porniți puntea

1. Mergeți la fila *AI* și faceți clic pe *Pornire bridge* sub *Server*.
2. Uitați-vă la starea de lângă buton. Ea arată *Oprit*, *Activ pe portul 3877*, *Portul 3877 este ocupat* sau *Eroare*. Dacă pornirea reușește, starea arată *Activ pe portul 3877*, iar butonul se numește *Oprire bridge*. Cu *Portul 3877 este ocupat* sau *Eroare*, butonul rămâne *Pornire bridge*; vedeți capcanele.

Puntea ascultă doar pe computerul dumneavoastră, pe un singur port. Implicit acest port este 3877. În grupul *Conexiune* puteți alege alt port sub *Port*, dar doar cât timp puntea este oprită.

### 3. Conectați asistentul

1. Faceți clic pe *Conectare* sub *Conexiune*. Se deschide fereastra *Date de conectare*.
2. Alegeți ce are nevoie clientul dumneavoastră, vedeți mai jos.
3. Tokenul este ascuns. Cu pictograma ochi îl afișați. Butoanele de copiere copiază mereu valoarea reală, chiar dacă ecranul ascunde tokenul.
4. Cereți asistentului să ceară lista instrumentelor. Această verificare este și în promptul de conectare: asistentul trebuie să vadă instrumentele cu prefixul `planner_`. Numărul așteptat este în promptul de conectare.

Fereastra oferă trei moduri de conectare:

- *Fragment de configurare*: o bucată de configurare pe care o lipiți în setările MCP ale clientului dumneavoastră.
- *Prompt de conectare*: un text pe care îl lipiți în asistentul de inteligență artificială. După aceea asistentul se conectează singur.
- *Endpoint* și *Autentificare*: detaliile separate. Endpoint-ul este `http://localhost:3877/mcp`, cu transport *streamable HTTP*. Fiecare cerere are nevoie de un antet `Authorization: Bearer`, urmat de tokenul dumneavoastră.

În grupul *Conexiune* există și câmpul *Token*. Este un cod lung și aleatoriu. Aplicația îl creează pentru dumneavoastră și îl salvează pe acest computer. În fereastră scrie *Acest token oferă acces la planul deschis. Nu-l distribuiți altora.* Cu pictograma *Creare token nou* creați un token nou. Aplicația întreabă mai întâi *Crearea unui token nou încheie toate conexiunile existente. Continuați?* Dacă puntea rulează, ea se repornește cu noul token. Vechiul token nu mai funcționează.

### 4. Vedeți ce face AI-ul

1. Faceți clic pe *Panou de activitate* sub *Activitate*. În bara laterală se deschide panoul *Activitate AI*.
2. Fiecare apel către punte apare pe câte un rând, cel mai nou sus: ora, ce s-a întâmplat, cât a durat și dacă a reușit sau nu. Faceți clic pe un rând ca să extindeți *Argumente* și *Răspuns*.
3. Cu *Ștergere* goliți lista. Panoul păstrează ultimele 500 de apeluri. Cât timp nu s-a întâmplat nimic, apare *Încă nu există activitate AI. Apelurile către bridge apar aici.*

Când modul AI este activat, în colțul din dreapta jos, în bara de stare, apare un punct cu *AI*. Culoarea arată starea punții. Un clic pe punct vă duce la fila *AI*.

### 5. Setați limite

Sub *Siguranță* sunt butoanele cu care limitați AI-ul:

- *Pauzare*: AI nu are voie să modifice nimic temporar, dar citirea rămâne permisă. Puntea rămâne activă. Butonul devine *Reluare*.
- *Doar în citire*: toate instrumentele care modifică ceva sunt refuzate cât timp este activat.
- *Backup automat: activat*: înainte de prima modificare a AI-ului într-un document, aplicația scrie un backup IFC. Este activat implicit. Cu butonul îl dezactivați, apoi apare *Backup automat: oprit*. Aceasta se întâmplă o dată pentru fiecare document, la fiecare pornire a punții.
- *Creare backup*: face imediat un backup al documentului activ. Apoi apare *Backup creat:* cu numele fișierului.
- *Deschidere dosar backup*: deschide dosarul cu backup-urile.

Backup-urile se află în dosarul `ai-backups` din dosarul de date al aplicației. Aplicația păstrează backup-urile recente și rărește pe cele mai vechi. Cum exact, este descris în [Instrumente AI](docs://ref-ai-tools).

### 6. Faceți ca asistentul să planifice bine

Un asistent care cunoaște instrumentele poate totuși construi o planificare inutilă: activități fără dependențe, o dată fixă la fiecare activitate sau o descompunere mult prea fină. De aceea asistentul primește regulile de planificare în trei moduri. Pentru primele două nu trebuie să faceți nimic.

1. **Regulile fundamentale vin singure.** Când se conectează, puntea trimite un text scurt cu regulile fundamentale. Mulți clienți pun acest text în promptul de sistem. Dacă al dumneavoastră o face, depinde de client. Textul spune, printre altele, că asistentul trebuie să înceapă de la jaloane, să creeze activități de aproximativ o zi până la două săptămâni, să conducă planificarea cu dependențe în loc de date fixe și să spună la final ce a presupus.
2. **Promptul de conectare trimite spre ghidul complet.** Promptul de conectare din fereastra *Date de conectare* cere asistentului să citească mai întâi ghidul de planificare, cu instrumentul `planner_get_planning_guide`. Acesta returnează un ghid în engleză pentru asistenți, cu aceleași principii ca în [Planificare bună](docs://gids-goed-plannen). Pentru fiecare principiu, ghidul arată instrumentele pe care asistentul le folosește. Îl puteți citi și dumneavoastră la `https://open-planner-studio.open-aec.com/agent/planning-guide.md`. Dacă nu folosiți promptul, cereți asistentului singur: *Citește mai întâi ghidul de planificare cu planner_get_planning_guide, înainte să modifici ceva.*
3. **Opțional: skill-urile.** Un skill este un fișier mic cu instrucțiuni. Asistentul îl citește în fiecare sesiune, ca să știe și într-o conversație ulterioară cum trebuie să lucreze. Sunt două skill-uri, ambele în engleză: *goed-plannen* pentru a configura sau a reorganiza o planificare și *progress-update* pentru actualizarea săptămânală a progresului. Funcționează doar cu un asistent care acceptă skill-uri. Skill-urile însele menționează Claude Code și asistenți înrudiți. Fiecare skill este un fișier `SKILL.md` într-un dosar cu numele skill-ului: `.claude/skills/goed-plannen/SKILL.md` și `.claude/skills/progress-update/SKILL.md` în dosarul proiectului în care lucrează asistentul. Sau aceleași dosare sub `~/.claude/skills/`, ca să le aveți în fiecare proiect.

Fișierele le obțineți în două moduri. Cereți asistentului să apeleze instrumentul `planner_get_planning_guide` cu `part` pus pe `skill`: răspunsul conține ambele texte și, pentru fiecare skill, locurile unde trebuie să ajungă. Sau descărcați-le de la `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` și `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Dacă *goed-plannen* mai există dintr-o versiune mai veche a aplicației, înlocuiți-l. Acel text vechi este în neerlandeză și trimite la articolul de ajutor, nu la ghidul pentru asistenți.

Ca să vedeți dacă asistentul a citit ghidul într-adevăr, uitați-vă în *Panou de activitate*. Acolo apare un apel al `planner_get_planning_guide`. Răspunsul final trebuie să conțină o listă de presupuneri: duratele estimate, descompunerea aleasă, dependențele pe care le-a creat singur și fiecare restricție pe care a setat-o. Dacă lista lipsește, cereți-o. După o actualizare de progres făcută cu *progress-update*, răspunsul trebuie să numească data raportului de stare, noua dată de sfârșit și varianța față de referință.

## Capcane și ce face aplicația atunci

**AI modifică ceva ce doriți să anulați.** Fiecare modificare făcută de AI este un pas pe care îl anulați cu *Anulare* (Ctrl+Z). O serie de modificări pe care AI le transmite ca un întreg este un singur pas. După aceea, proiectul apare ca nesalvat. După o modificare, planificarea se calculează din nou, deci nu trebuie să apăsați singur F5.

**Aplicația refuză un apel al AI-ului.** Cu *Pauzare* și *Doar în citire*, aplicația refuză toate modificările, iar citirea rămâne posibilă, inclusiv recalcularea unei planificări învechite. Dacă sunteți în mijlocul unei editări, de exemplu trageți o bară sau scrieți într-un câmp, AI primește datele de dinaintea editării dumneavoastră, cu o notificare că sunt învechite. Dacă aveți o fereastră deschisă, de exemplu setările, fereastra unei activități sau fereastra de bun venit, ori dacă modul prezentare este activat, aplicația refuză toate apelurile, inclusiv citirea, până închideți fereastra. AI primește atunci un mesaj de eroare cu numele intern al ceea ce este deschis, de exemplu `showTaskDialog`. Doar `planner_get_planning_guide` funcționează în continuare, pentru că nu citește planificarea dumneavoastră.

**Schimbați fila cât timp AI lucrează.** AI lucrează la documentul în care a ajuns prima sa modificare. Dacă schimbați fila între timp, aplicația refuză următoarea modificare a AI-ului până când acesta confirmă că vrea să lucreze la cealaltă filă. Astfel nimic nu ajunge în proiectul greșit.

**AI scrie sau deschide un fișier.** AI poate scrie o planificare ca fișier IFC și poate deschide un fișier de planificare ca filă nouă. Poate face asta doar în dosarul dumneavoastră de utilizator. Suprascrie un fișier existent doar dacă cere explicit acest lucru.

**Starea este *Portul 3877 este ocupat*.** Alt program folosește portul. Mesajul aplicației apare sub starea. Câmpul de port rămâne atunci blocat (*Editabil doar cât serverul este oprit.*), chiar dacă puntea nu rulează, și nu există buton de oprire. Aceasta este o limitare cunoscută. Până se remediază: dezactivați *Activare mod AI* și activați-l din nou. Starea revine atunci la *Oprit*, iar puteți alege alt port. Apoi copiați din nou datele de conectare, pentru că endpoint-ul conține portul.

**Clientul nu se poate conecta după un token nou.** Un token nou întrerupe toate conexiunile existente. Dați clientului noul token sau lipiți din nou fragmentul de configurare.

**Ați oprit puntea singur și nu pornește de la sine.** *Pornire automată bridge* funcționează o dată la fiecare pornire a aplicației. Dacă opriți puntea singur, aplicația nu o mai pornește din nou singură.

**Fila *AI* a dispărut.** Modul AI este dezactivat. Activați-l la pasul 1.

**O pagină web din browser nu poate comunica cu puntea.** Puntea refuză orice cerere care vine dintr-un browser și orice cerere fără tokenul corect.

## Vezi și

- [Trimiterea de feedback](docs://howto-feedback-geven): dacă legătura funcționează altfel decât este descris aici, raportați-o.
- [Cum funcționează legătura AI](docs://uitleg-ai-koppeling): ce este legătura, de ce asistentul lucrează în proiectul dumneavoastră deschis și ce nu are voie să facă.
- [Instrumente AI](docs://ref-ai-tools): toate instrumentele `planner_*` pe grupe, codurile de eroare și cât timp se păstrează backup-urile.
- [Planificare bună](docs://gids-goed-plannen): principiile de planificare; asistentul le primește într-o versiune în engleză, cu instrumentele adăugate.
- [Setări](docs://ref-instellingen): setările AI.
