# Conectarea unui client MCP

Scop: lăsați un client MCP să urmărească planificarea dumneavoastră și să lucreze la ea, cu o imagine clară asupra a ceea ce face și cu limite pe care le stabiliți dumneavoastră.

## Rapid: lăsați pe Claude să o facă

Lucrați cu Claude Desktop sau cu Claude Code? Atunci Claude poate instala singur conexiunea:

1. Faceți clic pe *Copiere prompt* de mai jos.
2. Lipiți promptul într-o conversație nouă cu Claude și trimiteți-l.

Apoi Claude instalează extensia pentru Open Planner Studio și explică pe parcurs ce face. Dacă trebuie să faceți ceva singur, de exemplu să faceți clic pe *Instalare* în Claude Desktop, Claude vă spune exact ce clic trebuie să faceți. Pentru asta nu aveți nevoie de un token.

```prompt
Instalați pentru mine extensia Open Planner Studio, ca să puteți citi și modifica planificările mele de construcție în Open Planner Studio. Faceți tot ce puteți singur. Înaintea fiecărui pas, spuneți într-o propoziție simplă ce veți face și de ce. Dacă aveți nevoie de mine, întrebați câte un lucru pe rând și așteptați răspunsul meu. Dacă trebuie să fac eu ceva, spuneți-mi exact ce clic sau ce acțiune trebuie să fac și unde.

Ce trebuie să știți:
- Extensia este un singur fișier, open-planner-studio-<versiune>.mcpb, din cea mai nouă versiune publicată: https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest. Linkul direct se află în https://api.github.com/repos/OpenAEC-Foundation/open-planner-studio/releases/latest (fișierul al cărui nume se termină în .mcpb). Fișierul este un fișier ZIP.
- Extensia funcționează cu aplicația desktop Open Planner Studio și fără aplicație. Când aplicația este deschisă și puntea MCP rulează, lucrați în planificarea deschisă în aplicație. Când aplicația este închisă, lucrați cu fișierele de planificare dintr-un dosar de lucru pe care îl aleg eu.
- Instalarea nu necesită token și nici parolă. Nu-mi cereți unul și nu citiți și nu afișați unul.

Dacă lucrați în Claude Desktop:
1. Dacă puteți descărca un fișier și îl puteți deschide pe computerul meu, faceți asta cu fișierul .mcpb. Dacă nu puteți, dați-mi linkul direct de descărcare și spuneți-mi să fac dublu clic pe fișier, când descărcarea este terminată.
2. Claude Desktop afișează apoi extensia Open Planner Studio. Spuneți-mi să fac clic pe Install. Apoi spuneți-mi să aleg, la Working folder, dosarul cu fișierele mele de planificare.
3. Spuneți-mi să deschid o conversație nouă și să vă întreb acolo ce instrumente Open Planner Studio vedeți.

Dacă lucrați în Claude Code:
1. Verificați că Node.js 22 sau o versiune mai nouă este instalat. Dacă nu este, spuneți-mi cum îl instalez și opriți-vă.
2. Întrebați-mă ce dosar conține fișierele mele de planificare. Acesta este dosarul de lucru.
3. Descărcați fișierul .mcpb și dezarhivați-l într-un dosar nou, propriu, în dosarul meu de utilizator. Citiți acolo manifest.json: server.mcp_config spune cum pornește serverul. Înlocuiți ${__dirname} cu dosarul dezarhivat și ${user_config.workdir} cu dosarul de lucru.
4. Rulați claude mcp list. Dacă există deja un server cu numele open-planner-studio, întrebați-mă dacă îl puteți înlocui. Nu afișați setările lui, pentru că pot conține un token.
5. Adăugați serverul pentru contul meu de utilizator, de exemplu: claude mcp add open-planner-studio --scope user -e OPS_MCP_ROOT=<dosar de lucru> -- node <dosar dezarhivat>/server/index.mjs
6. Spuneți-mi să deschid o sesiune nouă în Claude Code și că /mcp arată acolo dacă open-planner-studio este conectat.

Dacă lucrați altundeva, de exemplu claude.ai în browser, spuneți-mi că pentru asta este nevoie de Claude Desktop sau Claude Code. Dacă nu știți unde lucrați, întrebați-mă.

Când instalarea este terminată, explicați în câteva propoziții:
- cum vă permit să lucrați în aplicația deschisă: în Open Planner Studio, alegeți Setări › Proiect › Setări aplicație, fila Avansat, și activați Permiteți conexiunea MCP. Apoi faceți clic pe Pornire bridge în fila MCP.
- că, fără aplicație, o modificare ajunge în fișier numai după ce o salvați și că nu suprascrieți un fișier existent cât timp aplicația este deschisă.
Dacă un pas eșuează, spuneți-mi într-o propoziție ce nu a mers și ce pot face. Nu ghiciți.
```

Preferați să faceți singur, sau folosiți un alt client MCP? Atunci urmați pașii de mai jos.

## Când aveți nevoie de asta

Doriți ca un client MCP să citească, să analizeze sau să modifice planificarea dumneavoastră. De exemplu, să schițeze un prim WBS, să corecteze activități sau să explice drumul critic. Acest lucru se face prin **Model Context Protocol** (MCP): un standard care permite unui program de inteligență artificială, **clientul MCP**, să folosească instrumentele altui program. Pentru asta, Open Planner Studio rulează pe propriul computer un server mic, **puntea**. Acesta oferă un set de instrumente, toate cu un nume care începe cu `planner_`: citirea și modificarea activităților, dependențelor, resurselor, calendarelor, referințelor, documentelor și fișierelor. Ce instrumente există și ce nu permit este descris în [Instrumentele MCP](docs://ref-ai-tools). Clientul MCP lucrează în proiectul deschis, nu într-o copie: o activitate adăugată de el apare imediat în Gantt. El folosește același calcul și același istoric de *Anulare* ca dumneavoastră.

Puntea funcționează doar în aplicația desktop. Dacă permiteți conexiunea MCP în browser, vedeți fila *MCP*, dar butonul *Pornire bridge* este cenușiu, cu textul *Puntea funcționează doar în aplicația desktop.* Restul acestui articol se referă la aplicația desktop. În browser, *Creare backup* și *Deschidere dosar backup* sunt și ele cenușii.

## Pași

### 1. Permiteți conexiunea MCP

1. Alegeți *Setări › Proiect › Setări aplicație*. Puteți alege și *Fișier › Setări aplicație*, sau pictograma roată dințată din partea de sus.
2. Alegeți fila *Avansat* și activați *Permite conexiunea MCP*. Fila *MCP* apare în panglică.
3. Dacă doriți ca bridge-ul să fie activ imediat ce pornește aplicația, activați și *Pornire automată bridge*. Aceasta pornește bridge-ul doar când conexiunea MCP este activată. Funcționează doar în aplicația desktop. În mod implicit este dezactivată, pentru că deschiderea unui port este o alegere deliberată.

Dacă opriți conexiunea MCP, bridge-ul se oprește și fila *MCP* dispare.

### 2. Porniți bridge-ul

1. Mergeți la fila *MCP* și faceți clic pe *Pornire bridge* sub *Server*.
2. Uitați-vă la starea de lângă buton. Starea arată *Oprit*, *Activ pe portul 3877*, *Portul 3877 este ocupat* sau *Eroare*. Dacă pornirea reușește, starea arată *Activ pe portul 3877*, iar butonul se numește *Oprire bridge*. Cu *Portul 3877 este ocupat* sau *Eroare*, butonul rămâne *Pornire bridge*; consultați capcanele de mai jos.

Bridge-ul ascultă doar pe calculatorul dumneavoastră, pe un singur port. În mod implicit, acesta este portul 3877. În grupul *Conexiune* puteți alege alt port sub *Port*, dar doar cât timp bridge-ul este oprit. Conexiunea este HTTP simplu, pe calculatorul dumneavoastră. Aplicația în sine nu trimite nimic în afară. Ce face clientul MCP cu planificarea dumneavoastră, de exemplu ce face furnizorul lui cu ea, este în afara aplicației.

### 3. Conectați clientul MCP

1. Faceți clic pe *Conectare* sub *Conexiune*. Se deschide fereastra *Date de conectare*.
2. Alegeți ce necesită clientul dumneavoastră, vedeți mai jos.
3. Tokenul este ascuns. Cu pictograma cu ochi îl afișați. Butoanele de copiere copiază întotdeauna valoarea reală, chiar dacă ecranul ascunde tokenul.
4. Cereți clientului MCP să solicite lista cu instrumente. Această verificare apare și în promptul de conectare: clientul trebuie să vadă instrumentele cu prefixul `planner_`; numărul așteptat este în promptul de conectare.

Fereastra oferă patru moduri de conectare:

- *Configurare prin Claude*: același prompt ca cel din partea de sus a acestui articol, cu butonul *Copiere prompt*. Este pentru Claude Desktop și Claude Code. Pentru aceasta nu aveți nevoie de token.
- *Fragment de configurare*: o bucată de configurare pe care o lipiți în setările MCP ale clientului dumneavoastră.
- *Prompt de conectare*: un text pe care îl lipiți în clientul dumneavoastră MCP, după care acesta se conectează singur.
- *Endpoint* și *Autentificare*: detaliile separate. Endpointul este `http://localhost:3877/mcp`, cu transportul *streamable HTTP*. Fiecare cerere are nevoie de antetul `Authorization: Bearer`, urmat de tokenul dumneavoastră. Clientul trebuie să accepte și sesiuni MCP: când se conectează, bridge-ul transmite un cod de sesiune în antetul `Mcp-Session-Id` și refuză orice cerere ulterioară fără acest cod. Claude Code și `mcp-remote` fac asta singure.

**Reconectați-vă după o actualizare a aplicației.** Dacă clientul MCP era deja conectat la o versiune mai veche a aplicației, el nu trimite încă un cod de sesiune, iar bridge-ul refuză fiecare cerere. Reconectați-vă deci după actualizare: porniți o sesiune nouă în Claude Code și închideți complet Claude Desktop, apoi porniți-l din nou.

**Claude Code.** Fragmentul de configurare se potrivește direct cu Claude Code. Dați comanda următoare într-un terminal, cu tokenul dumneavoastră în locul `<token>`:

```
claude mcp add --transport http open-planner-studio http://localhost:3877/mcp --header "Authorization: Bearer <token>"
```

Puteți pune fragmentul și în fișierul `.mcp.json` din dosarul proiectului. Atunci nu puneți acest fișier în git, pentru că tokenul oferă acces la planul dumneavoastră. Un server din `.mcp.json` trebuie aprobat prima dată în Claude Code.

**Claude Desktop.** Pentru Claude Desktop există o extensie: fișierul `open-planner-studio-<version>.mcpb`. Claude Desktop îl instalează cu un dublu clic. Pentru aceasta nu aveți nevoie de Node.js. Extensia funcționează cu aplicația și fără aplicație. Este mai rapid cu promptul din partea de sus a acestui articol; mai jos sunt pașii manuali.

1. Descărcați fișierul `.mcpb` din cea mai recentă versiune: `https://github.com/OpenAEC-Foundation/open-planner-studio/releases/latest`.
2. Faceți dublu clic pe fișier. Claude Desktop se deschide și arată extensia *Open Planner Studio*. Instalați-o. Dacă dublul clic nu funcționează, deschideți *Setări › Extensii* în Claude Desktop și instalați fișierul acolo.
3. La *Dosar de lucru*, alegeți dosarul cu fișierele dumneavoastră de planificare. Claude folosește acest dosar doar când aplicația este închisă. Apoi Claude citește și scrie doar în acel dosar.
4. Activați extensia și porniți un chat nou. Întrebați Claude ce instrumente din Open Planner Studio vede.

Nu trebuie să introduceți nici tokenul, nici portul: cât timp rulează bridge-ul, extensia găsește singură aplicația. Pentru fiecare întrebare a lui Claude, extensia alege din nou:

- *Aplicația este deschisă și bridge-ul rulează*: Claude lucrează în planul care este deschis în aplicație. Vedeți fiecare modificare în aplicație imediat.
- *Aplicația este închisă sau bridge-ul este oprit*: Claude lucrează cu un fișier de planificare din dosarul de lucru. O modificare ajunge în fișier doar când Claude salvează fișierul. Nu există salvare automată. Cât timp aplicația este deschisă, Claude nu suprascrie un fișier existent, ci salvează sub un nume nou.

Dacă aplicația se deschide sau se închide cât timp lucrează Claude, extensia comută și îi spune lui Claude. Claude alege sau deschide din nou planul și abia apoi modifică ceva. Dacă Claude mai are modificări fără aplicație, care nu sunt salvate, extensia continuă să lucreze fără aplicație până când Claude le salvează. Astfel nu se pierde nimic. Dacă extensia nu poate ajunge la aplicație și nu există un dosar de lucru utilizabil, Claude vede doar instrumentul `open_planner_studio_status`, cu un mesaj care vă spune ce trebuie să faceți.

**Claude Desktop fără extensie.** Dacă nu puteți folosi extensia, conectați Claude Desktop cu instrumentul extern `mcp-remote`. Fragmentul de configurare nu se potrivește direct cu Claude Desktop: în fișierul `claude_desktop_config.json` trebuie să numiți o aplicație separată, pe care Claude Desktop o pornește singur, nu o adresă. `mcp-remote` are nevoie de Node.js. În Claude Desktop alegeți *Setări › Dezvoltator › Editare configurație*, puneți următorul text în fișier (cu tokenul dumneavoastră) și porniți din nou Claude Desktop:

```
{
  "mcpServers": {
    "open-planner-studio": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "http://localhost:3877/mcp", "--header", "Authorization:${AUTH_HEADER}"],
      "env": { "AUTH_HEADER": "Bearer <token>" }
    }
  }
}
```

Tokenul se află în `env` și nu în `args`, intenționat: pe Windows, Claude Desktop strică un argument care conține un spațiu. Un *conector personalizat* în Claude (*Personalizare › Conectori*) nu funcționează cu bridge-ul. Claude se conectează atunci din cloud-ul Anthropic, iar cloud-ul nu poate ajunge la bridge-ul de pe calculatorul dumneavoastră.

În grupul *Conexiune* există și câmpul *Token*. Este un cod lung și aleatoriu, pe care aplicația îl creează pentru dumneavoastră și îl stochează pe acest calculator. În fereastră scrie *Acest token oferă acces la planul deschis. Nu-l distribuiți altora*. Cu pictograma *Creare token nou* creați un token nou. Aplicația întreabă mai întâi *Crearea unui token nou încheie toate conexiunile existente. Continuați?* Dacă bridge-ul rulează, se repornește cu noul token, iar cel vechi nu mai funcționează.

**Cum găsește extensia aplicația.** Cât timp rulează bridge-ul, aplicația desktop scrie portul și tokenul în fișierul `mcp/runtime.json` din dosarul de date al aplicației. Extensia pentru Claude Desktop citește fișierul la fiecare întrebare. Pe Linux și macOS, doar contul dumneavoastră de utilizator poate citi fișierul. Pe Windows, permisiunile implicite ale dosarului de profil protejează fișierul; aplicația nu verifică separat acest lucru. Când opriți bridge-ul sau dezactivați conexiunea MCP, aplicația șterge fișierul. Aplicația ține și o listă cu fișierele deschise, în `mcp/open-files.json`, chiar și când conexiunea MCP este oprită. Cât timp există acest fișier, extensia și serverul MCP fără interfață nu suprascriu niciun fișier existent, nici unul pe care tocmai l-ați deschis și care nu este încă în listă. Un fișier nou este permis. Citirea este permisă și ea: Claude vede atunci versiunea de pe disc, fără modificările dumneavoastră care nu sunt salvate încă.

### 4. Vedeți ce face clientul MCP

1. Faceți clic pe *Panou de activitate* sub *Activitate*. În partea laterală se deschide panoul *Jurnal MCP*.
2. Fiecare apel al bridge-ului apare pe câte o linie, cel mai nou sus: ora, ce s-a întâmplat, cât a durat și dacă a reușit sau nu. Faceți clic pe o linie ca să extindeți *Argumente* și *Răspuns*.
3. Cu *Golire* goliți lista. Panoul păstrează ultimele 500 de apeluri. Cât timp nu s-a întâmplat nimic, panoul scrie *Încă nu există nicio intrare în Jurnal MCP. Apelurile către punte apar aici*.

Când conexiunea MCP este activată, pe bara de stare apare în dreapta jos un punct cu *MCP*. Culoarea lui arată starea bridge-ului, iar un clic pe el vă duce la fila *MCP*.

### 5. Setați limite

Sub *Siguranță* sunt butoanele cu care limitați clientul MCP:

- *Pauzare*: clientul MCP nu are voie să modifice nimic temporar, citirea rămâne permisă. Bridge-ul rămâne activ. Butonul devine *Reluare*.
- *Doar în citire*: toate instrumentele care modifică ceva sunt refuzate cât timp este activată această opțiune.
- *Backup automat: activat*: înainte de prima modificare a clientului MCP într-un document, aplicația scrie un backup IFC. Este activată în mod implicit. Cu butonul o dezactivați, și atunci scrie *Backup automat: oprit*. Acest lucru se întâmplă o dată pe document, de fiecare dată când porniți bridge-ul.
- *Creare backup*: face imediat un backup al documentului activ. După aceea scrie *Backup creat:* cu numele fișierului.
- *Deschidere dosar backup*: deschide dosarul cu backupurile.

Backupurile se află în dosarul `ai-backups` din dosarul de date al aplicației. Aplicația păstrează backupurile recente și le rărește pe cele mai vechi; detaliile exacte sunt în [Instrumente MCP](docs://ref-ai-tools).

### 6. Faceți ca clientul MCP să planifice bine

Un client MCP planifică bine doar dacă cunoaște regulile de planificare. Iată ce trebuie să faceți dumneavoastră:

1. **Nu faceți nimic pentru regulile principale.** Ele vin odată cu conectarea: bridge-ul le trimite în câmpul `instructions` din inițializarea MCP. Dacă clientul le pune în promptul său de sistem, depinde de client.
2. **Lăsați clientul să citească ghidul.** Promptul de conectare din fereastra *Date de conectare* cere clientului MCP să citească ghidul cu instrumentul `planner_get_planning_guide`. Dacă nu folosiți promptul, spuneți clientului: *Citiți ghidul de planificare cu planner_get_planning_guide mai întâi, înainte să modificați ceva.* Puteți citi ghidul și dumneavoastră la `https://open-planner-studio.open-aec.com/agent/planning-guide.md`.
3. **Opțional: instalați skill-urile.** Asta funcționează doar cu un client MCP care acceptă skill-uri. Puneți `SKILL.md` din *goed-plannen* și din *progress-update* în `.claude/skills/goed-plannen/SKILL.md` și `.claude/skills/progress-update/SKILL.md` în dosarul proiectului în care lucrează clientul MCP, sau sub `~/.claude/skills/` pentru fiecare proiect.

Fișierele le obțineți în două moduri. Cereți clientului MCP să apeleze instrumentul `planner_get_planning_guide` cu `part` setat la `skill`: răspunsul conține ambele texte și, pentru fiecare skill, locurile unde trebuie să fie. Sau descărcați-le de la `https://open-planner-studio.open-aec.com/skills/goed-plannen/SKILL.md` și `https://open-planner-studio.open-aec.com/skills/progress-update/SKILL.md`. Dacă *goed-plannen* mai există de la o versiune veche a aplicației, înlocuiți-l: acel text vechi este în neerlandeză și trimite la articolul de ajutor, în loc de ghidul pentru clienții MCP.

Dacă clientul MCP a citit cu adevărat ghidul, puteți vedea acest lucru în *Panou de activitate*: apare atunci un apel către `planner_get_planning_guide`. Răspunsul final ar trebui să conțină o listă cu presupuneri: durate estimate, descompunerea aleasă, dependențele pe care le-a creat singur și fiecare restricție pe care a stabilit-o. Dacă lipsește lista, cereți-o. După o actualizare a progresului conform *progress-update*, răspunsul trebuie să indice data raportului de stare, noua dată de sfârșit și varianța față de referință.

## Capcane și ce face aplicația atunci

**Clientul MCP modifică ceva ce doriți să anulați.** Fiecare modificare a clientului MCP este un pas pe care îl anulați cu *Anulare* (Ctrl+Z). O serie de modificări pe care clientul MCP le transmite ca un tot este un singur pas. După aceea proiectul apare ca nesalvat. După o modificare, planificarea se calculează din nou, deci nu trebuie să apăsați singur F5.

**Aplicația refuză un apel al clientului MCP.** Cu *Pauzare* și *Doar în citire*, aplicația refuză toate modificările, iar citirea rămâne posibilă, inclusiv recalcularea unei planificări învechite. Dacă sunteți chiar acum în mijlocul unei editări, de exemplu trăgând o bară sau scriind într-un câmp, clientul MCP primește datele de dinaintea editării dumneavoastră, cu un avertisment că sunt învechite. Dacă aveți deschisă o fereastră de dialog, de exemplu setările, dialogul unei activități sau fereastra de bun venit, ori dacă este activat modul prezentare, aplicația refuză toate apelurile, inclusiv citirea, până când închideți dialogul. Clientul MCP primește atunci un mesaj de eroare cu numele intern al ceea ce este deschis, de exemplu `showTaskDialog`. Doar `planner_get_planning_guide` continuă să funcționeze, pentru că nu citește planificarea dumneavoastră.

**Schimbați documentul cât timp clientul MCP lucrează.** Clientul MCP lucrează în documentul în care a ajuns prima sa modificare. Dacă între timp schimbați fila documentului, aplicația refuză următoarea modificare a clientului până când acesta confirmă că vrea să lucreze în celălalt document. Astfel nimic nu ajunge în proiectul greșit. Dacă clientul MCP deschide sau duplică singur un document, după aceea lucrează în documentul nou.

**Clientul MCP scrie sau deschide un fișier.** Clientul MCP poate scrie o planificare ca fișier IFC și poate deschide un fișier de planificare ca filă nouă. Poate face asta doar în dosarul dumneavoastră de utilizator. Suprascrie un fișier existent doar dacă cere explicit acest lucru.

**Starea este *Portul 3877 este ocupat*.** O altă aplicație folosește portul. Mesajul aplicației apare dedesubt. Câmpul pentru port rămâne atunci blocat (*Editabil doar cât timp serverul este oprit.*), chiar dacă bridge-ul nu rulează, și nu există buton de oprire. Aceasta este o deficiență cunoscută. Până la remediere: opriți și reactivați *Permite conexiunea MCP*. Starea revine atunci la *Oprit*, iar dumneavoastră puteți alege alt port. Apoi copiați din nou detaliile de conectare, pentru că endpointul conține portul.

**Clientul nu se poate conecta după un token nou.** Un token nou încheie toate conexiunile existente. Dați clientului noul token sau lipiți din nou fragmentul de configurare. Extensia din Claude Desktop citește singură noul token; acolo nu trebuie să faceți nimic.

**Ați oprit singur bridge-ul și el nu pornește de la sine.** *Pornire automată bridge* funcționează o singură dată la fiecare pornire a aplicației. Dacă opriți singur bridge-ul, aplicația nu îl repornește în tăcere.

**Fila *MCP* a dispărut.** Conexiunea MCP este oprită. Activați-o la pasul 1.

**O pagină web din browserul dumneavoastră nu poate vorbi cu bridge-ul.** Bridge-ul refuză fiecare cerere care vine din browser și fiecare cerere fără tokenul corect.

## Fără aplicația

Există și un server MCP care funcționează fără aplicația de desktop: **serverul MCP fără interfață grafică**. Acesta oferă aceleași instrumente `planner_*`, dar lucrează cu un fișier de planificare de pe disc, în loc de proiectul dumneavoastră deschis. Astfel, nu vedeți modificările în diagrama Gantt, iar *Anulare* din aplicație nu se aplică acestora. Folosiți-l când nu doriți ca aplicația să fie deschisă, sau pe un calculator fără ecran.

Extensia pentru Claude Desktop pornește singură acest server atunci când aplicația este închisă (consultați pasul 3). Pașii de mai jos sunt pentru un alt client MCP, cum ar fi Claude Code.

Lansarea nu include un server gata de descărcat. Îl construiți din codul sursă cu `npm run build:mcp-server`; pentru aceasta aveți nevoie de Node.js 22 sau de o versiune mai nouă. Rezultatul este un singur fișier, `server.mjs`.

1. Alegeți un dosar de lucru cu fișierele dumneavoastră de planificare. Serverul citește și scrie numai în acest dosar.
2. Conectați clientul MCP. Pentru Claude Code, comanda este mai jos, după pași.
3. Cereți clientului MCP să deschidă o planificare, de exemplu `~/plan.ifc`. În acest server, `~` înseamnă dosarul de lucru.
4. Cereți clientului MCP să salveze rezultatul. Nu există salvare automată: clientul MCP scrie fișierul cu `planner_export_ifc`. Ce nu se salvează se pierde atunci când serverul se oprește.

Pentru pasul 2 cu Claude Code, dați această comandă într-un terminal, cu propriile dumneavoastră căi:

```
claude mcp add open-planner -- node /path/to/server.mjs --root /path/to/working-folder
```

Înainte de prima modificare a fiecărui document, serverul face o copie de rezervă MCP, la fel ca aplicația. Un client MCP care alege o cale în afara dosarului de lucru, inclusiv printr-o scurtătură (legătură simbolică), primește un refuz. Cât timp aplicația este deschisă, serverul nu suprascrie un fișier existent.

## Consultați și

- [Trimiterea de opinii](docs://howto-feedback-geven): dacă conexiunea funcționează altfel decât este descris aici, semnalați-o.
- [Instrumente MCP](docs://ref-ai-tools): toate instrumentele `planner_*` pe grupe, codurile de eroare și cât timp se păstrează copiile de rezervă.
- [Setările aplicației](docs://ref-instellingen): setările MCP.
