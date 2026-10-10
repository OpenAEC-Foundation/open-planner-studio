# Planificarea bună

Ce face o planificare bună? Nu cât de ordonată arată, ci dacă răspunde la întrebarea care contează odată ce lucrările au început: dacă aceasta întârzie, ce se întâmplă cu predarea? Acest articol explică principiile din spatele unei planificări fiabile și de ce cântăresc atât de mult în Open Planner Studio: aplicația calculează cu ce introduceți și cu nimic altceva.

Exemplele provin din construcții — lucrări de structură, meserii de finisaje, termene de livrare, întârziere cauzată de vreme, subantreprenori, o dată contractuală de predare — dar principiile în sine nu sunt specifice construcțiilor.

## Conceptul

O planificare bună nu este o imagine a ceea ce sperați, ci un **model de planificare**: activități cu o durată, legate prin dependențe, într-un calendar. Aplicația calculează datele pe baza acestui model. Când ceva se schimbă, modelul se recalculează și vedeți imediat ce înseamnă aceasta pentru restul activităților.

Un planificator lucrează într-o ordine fixă:

1. Scopul: jaloane și data de predare.
2. Descompunerea: faze, pachete de lucru, activități.
3. Durata fiecărei activități.
4. Dependențele.
5. Restricții și date fixe.
6. Calendarele.
7. Resursele.
8. Drumul critic și marja.
9. Referința și progresul.
10. Revizuirea.

Ordinea nu este o simplă convenție. Dacă ignorați un pas, acesta revine ca o surpriză: activitățile fără dependențe nu se mută odată cu restul, duratele fără calendar sunt greșite, iar o referință salvată abia ulterior fixează întârzierea în loc de acord.

## Cum calculează aplicația cu planificarea

Fiecare principiu de mai jos este legat de ceva ce face aplicația. De aceea, această parte urmează aceeași ordine.

### Pornind de la obiectiv, nu de la activități

Întâi notați momentele fixe și abia apoi lucrările care trebuie să încapă între ele: începerea pregătirii șantierului, autorizația finală, clădirea protejată de intemperii, începerea finisajelor, predarea. Acestea sunt **jaloane**: puncte fără durată, pe care le introduceți cu adevărat ca jalon (*Acasă › Activități › Jalon ▾*) și nu ca o activitate de durată zero cu un nume care seamănă cu un jalon.

De ce această ordine: o planificare care pornește de la o listă de activități devine o simplă sumă, iar o sumă nimerește rareori data din contract. Porniți de la jaloane și întrebarea este corectă de la început — nu „cât durează toate acestea împreună”, ci „încape lucrul între aceste două momente și, dacă nu, ce trebuie modificat”. Lucrați înapoi de la data de predare cerută până la momentul cel mai târziu în care clădirea trebuie să fie protejată de intemperii, și de acolo până la început.

O predare fixată prin contract primește caseta de bifare *Obligatoriu (prin contract)*, astfel încât oricine deschide fișierul vede că acest moment nu este nici negociabil, nici mutabil. Caseta de bifare este un marcaj pentru diagrama Gantt și pentru rapoarte; ea nu protejează o dată. Pentru aceasta folosiți un termen limită sau o restricție (vezi mai jos).

### Descompunerea: faze, pachete de lucru, activități

Sub jaloane construiți structura: faze, sub ele pachete de lucru, sub acestea activități. Faceți aceasta indentând. O activitate cu subactivități devine automat o **activitate rezumat**: aplicația derivă bara și durata din activitățile de sub ea. Așadar, nu introduceți niciodată singur o durată pentru o activitate rezumat.

Regula orientativă pentru granularitate: **o activitate durează între aproximativ o zi și două săptămâni**. O activitate mai scurtă de o zi înseamnă că planificați atelierul în loc de proiect; aceasta ține de planul săptămânal al conducătorului de șantier, nu de un model care trebuie să țină luni de zile. Mai lungă de două săptămâni înseamnă o activitate pe care nu o puteți estima corect și nu o puteți urmări în timpul execuției: „finisarea parterului, 40 de zile, 45% finalizat” nu spune nimănui dacă lucrurile merg bine. De aceea, analizele planificării numără adesea câte activități durează mai mult de aproximativ două luni; peste câteva procente, aceasta înseamnă lipsă de detaliu.

Prea detaliată este la fel de dăunătoare ca prea generală. Fiecare activitate necesită întreținere: dependențe de trasat, progres de înregistrat, o nouă evaluare după fiecare modificare. O planificare cu două mii de activități pentru un proiect de șase luni nu devine mai exactă, ci devine neîntreținută — iar o planificare pe care nu o actualizează nimeni devine ficțiune în trei săptămâni. Alegeți nivelul la care puteți raporta progresul cu onestitate, în fiecare săptămână.

În practică: „3. Finishing” este o fază, „Finishing house 4” un pachet de lucru, „Plastering house 4 ground floor” o activitate de cinci zile. Puteți depăși intenționat limita superioară pentru termenele de livrare și pentru supraveghere: livrarea ramelor de ferestre, pe zece săptămâni, este cu adevărat un bloc indivizibil de așteptare, iar supravegherea continuă aparține unui hamac, nu unei serii de segmente artificiale.

### Estimarea duratei

O durată este o estimare a timpului necesar pentru lucru, nu a cât de repede ar putea merge. Estimați pentru o zi normală, cu echipa pe care o veți avea în realitate, nu pentru cea mai bună zi, cu cea mai bună echipă. Optimismul se acumulează de-a lungul lanțului: o planificare în care fiecare activitate presupune cea mai bună zi aproape niciodată nu respectă data de predare.

Zilele sau orele sunt o alegere reală, nu o chestiune de formatare. Alegeți **zile** pentru lucrările care dau ritmul pe șantier — zidărie, tencuială, placare cu gresie: durează cinci zile, indiferent dacă o zi are opt sau nouă ore. Alegeți **ore** atunci când orele înseamnă chiar unitatea și restul zilei contează: o inspecție de trei ore, o turnare de beton de paisprezece ore întinsă pe două zile, lucrul în ture. Aplicația reține această alegere pentru fiecare activitate.

Nu ascundeți riscul în duratele individuale. Adăugarea unei zile peste tot îngroapă rezerva, astfel încât nimeni nu o mai poate vedea sau conduce — iar acolo unde rezerva era cu adevărat necesară, se dovedește prea mică. Faceți rezerva vizibilă: o activitate tampon explicită înainte de data predării sau o rezervă separată pentru vreme. Atenție la dublarea numărării: cele aproximativ 180 de zile lucrătoare pe an cu care socotește construcția din Țările de Jos sunt o cifră anuală contractuală (UAV), din care au fost deja scăzute sărbătorile legale, concediul colectiv din construcții *și* zilele pierdute. Dacă sărbătorile și concediul colectiv sunt deja în calendarul proiectului, rămâne separat doar întârzierea din cauza vremii. Întârzierile din cauza gerului și a furtunii urmează propriile reguli din convenția colectivă Onwerkbaar weer Bouw & Infra. Introduceți zilele pierdute preconizate în calendar sau într-o activitate separată, nu ascunse în durata zidăriei.

### Dependențe: fără o rețea nu există planificare

Aplicația calculează datele de-a lungul **dependențelor**: o activitate începe doar când îi permit predecesorii ei. O activitate fără dependențe nu este legată de nimic. Dacă lucrările de structură întârzie cu două săptămâni, o activitate de finisaje nelegată nu urmează, iar planificarea induce în eroare fără ca ceva să devină roșu.

De aceea, fiecare activitate primește cel puțin un predecesor și cel puțin un succesor. Doar prima activitate a proiectului și ultimul jalon fac excepție. La analiza planificării, aceasta este prima verificare: cel mult câteva procente din activități pot avea logica lipsă.

**Sfârșit-început este implicit**, și așa trebuie să rămână: fundația finalizată, apoi lucrările de structură. Într-o planificare sănătoasă de construcție, aproximativ nouă din zece dependențe sunt sfârșit-început. Aceasta este o cerință de claritate: sfârșit-început este singurul tip pe care îl înțelege oricine de pe șantier fără explicații și care se comportă previzibil în timpul execuției.

**Început-început cu decalaj** se folosește pentru lucrările care chiar merg în paralel, în loc să aștepte. Cazul clasic este un rând de case sau un turn cu etaje: montatorul urmează cu trei zile în urma zidăriei. Aceasta este o dependență început-început cu decalaj de trei zile, nu o dependență sfârșit-început pe o activitate tăiată artificial în bucăți. Adăugați alături o dependență sfârșit-sfârșit, altfel succesorul ar putea, în teorie, să se termine înainte de predecesor. În construcții, aproape niciodată nu folosiți început-sfârșit.

De preferat, trasați acea dependență început-început între activități, nu între faze. Dacă predecesorul unei dependențe început-început sau început-sfârșit este o fază, aplicația face ca succesorul să aștepte activitatea din acea fază care începe **ultima**, nu prima. Astfel, nu planifică niciodată prea devreme, dar uneori mai târziu decât ați vrut. Sfârșit-început și sfârșit-sfârșit cu o fază drept predecesor așteaptă ca ultima activitate din ea să se termine, iar aceasta este de obicei exact ce doriți.

Folosiți cu economie decalajele, mai ales pe cele negative. Un decalaj este timp de așteptare fără un motiv vizibil: mai târziu nimeni nu poate spune de ce sunt șapte zile între ele. Dacă este vorba de întărirea betonului, faceți-l decalaj în zile calendaristice (betonul se întărește și în weekend) sau, și mai bine, o activitate reală de „întărire” pe care toți o pot vedea și urmări. Un decalaj negativ — un devans, o suprapunere — nu ar trebui să existe deloc; la analiza planificării, norma este zero. Dacă doriți suprapunere, împărțiți predecesorul sau folosiți o dependență început-început.

### Restricții și date fixe: cât mai puține

Fiecare activitate pornește cu „cât mai devreme posibil”, iar în marea majoritate a cazurilor ar trebui să rămână așa. O **restricție** este o limită de dată alături de dependențe. Cu cât adăugați mai multe, cu atât planificarea se calculează mai puțin și devine mai mult un desen. O planificare plină de date fixe pare stabilă și tocmai din această cauză ascunde riscul: nu se mai mișcă, deci nu mai avertizează.

Folosiți o restricție doar pentru o dată externă fermă, asupra căreia planificarea nu are nicio influență: autorizația care nu va fi definitivă înainte de 1 martie (*Nu începe înainte de*), fereastra de închidere acordată de municipalitate, data de racordare a companiei de utilități. „Vreau această activitate în mai” nu este un fapt extern; rezolvați asta cu logică sau cu o altă durată. Ca regulă generală, cel mult câteva procente din activitățile rămase au o limită fermă de dată.

Nu introduceți niciodată o dată de început ca să puneți o activitate la locul ei. Pentru o activitate cu predecesor, aplicația transformă un început introdus (sau tras cu mouse-ul) într-o restricție *Nu începe înainte de (SNET)*. Atunci activitatea este unde doriți, iar acolo rămâne chiar dacă întregul lanț dinaintea ei întârzie.

Dacă vreți să urmăriți o dată fără să influențați calculul, folosiți un **termen limită**. Nu mută nimic, dar dă marjă negativă și un avertisment imediat ce activitatea nu o mai respectă — exact semnalul pe care vreți să-l vedeți. Păstrați o fixare fermă (*Obligatoriu (logica de fixare)*) pentru cazul extrem, și atunci trebuie să știți că dă marjă negativă în lanțul dinaintea ei: planificarea spune că nu încape, nu că ceva este stricat.

### Calendare: mai întâi proiectul, apoi excepțiile

Toate duratele se numără în zile lucrătoare sau ore de lucru ale unui calendar. Așadar, configurați corect calendarul proiectului înainte să introduceți durate: zilele lucrătoare, timpul de lucru, sărbătorile legale și concediul colectiv din construcții. Un calendar pe care îl corectați pe la jumătate deplasează întreaga planificare. Adăugați imediat închiderile previzibile: perioada de ger în care nu turnați beton, oprirea firmei între Crăciun și Anul Nou.

Dați unei resurse un calendar propriu doar dacă diferă cu adevărat: constructorul de fațade care vine patru zile pe săptămână, echipa care își ia alt concediu de vară. Un calendar de resursă nu modifică nicio dată a unei activități; aceasta rămâne pe calendarul activității sau al proiectului. Arată doar că resursa nu lucrează într-una dintre zilele lucrătoare ale activității, sub forma unei supraalocări în histogramă. Această diferență este greu de observat dacă nu știți că ați creat-o chiar dumneavoastră.

### Resurse: cine execută și dacă este posibil

O planificare fără resurse răspunde doar la jumătate din întrebare. Din momentul în care atribuiți echipele și utilajele, histograma arată ce nu poate arăta singură o linie a timpului: că pe 14 iunie aveți nevoie de trei echipe de tencuială, deși aveți două.

Începeți cu resursele care limitează. Nu trebuie inclus fiecare șurub. Trebuie incluse macaraua turn, echipele proprii, subcontractanții cu plafon de capacitate și termenele lungi de livrare. Dați fiecărei resurse o capacitate corectă: doi tencuitori înseamnă doi, nu „doi, dar trei în caz de urgență”.

Citiți histograma ca pe o întrebare, nu ca pe o eroare. Roșu peste linie înseamnă că planificarea cere mai mult decât aveți în ziua respectivă. Uneori răspunsul este: mutați. Adesea răspunsul este: asta nu va merge, și exact asta voiați să aflați. **Redistribuirea** mută activitățile până când cererea se încadrează în capacitate. Dacă data de sfârșit poate avea joc, permiteți acest lucru; dacă data predării este fixă, redistribuiți doar în marjă (caseta de bifare *Redistribuire numai în limita marjei — data de sfârșit a proiectului rămâne fixă*). Data de sfârșit rămâne atunci nemodificată, iar la final rămâne un conflict raportat, care este un rezultat mai onest decât o planificare care doar pare rezolvată.

*Nu* redistribuiți când cererea este structural mai mare decât capacitatea. Redistribuirea rearanjează lucrul existent în timp; nu angajează tencuitori în plus și nu construiește o a doua macara. Trei turnuri care au nevoie de aceeași echipă în același timp rămân trei turnuri care au nevoie de aceeași echipă și după redistribuire; singurul lucru care se modifică este că predarea se mută mai târziu. Ce ajută în loc de asta este etapizarea, capacitatea suplimentară sau alt tip de lucru. Nu redistribuiți nici înainte ca logica și duratele să fie stabilite: ar însemna să redistribuiți o planificare care mâine va arăta altfel.

### Drumul critic și marja: unde este vulnerabilă planificarea

Aplicația nu recalculează la fiecare modificare. Calculați cu **Calculare** (F5) și abia apoi citiți. Dacă bara de stare spune *Învechit — recalculați (F5)*, vedeți calculul anterior, nu pe cel curent. Cu setarea *Calculare automată*, aplicația face singură acest lucru.

**Drumul critic** este lanțul fără marjă: fiecare zi pierdută acolo înseamnă o predare cu o zi mai târziu. Acolo trebuie să mergă supravegherea și cei mai buni oameni ai dumneavoastră. Nu vă uitați doar la roșu. **Marja totală** arată cât poate întârzia o activitate fără să afecteze predarea; **marja liberă** arată cât poate întârzia fără să mute succesorul. Diferența nu afectează data de sfârșit a nimănui, dar îi stă în cale cuiva — util atunci când lucrați cu subcontractanți pe care nu îi puteți reprograma de două ori.

Urmăriți trei semnale. O activitate cu câteva zile de marjă nu este sigură, ci aproape critică; cu *Marcare activități aproape critice* astfel de activități primesc o culoare proprie. O activitate cu o marjă extrem de mare — la analizele planificării mai mult de 44 de zile lucrătoare, aproximativ două luni — lipsește aproape întotdeauna un succesor; aceasta vă indică direct golurile din rețeaua dumneavoastră. Iar marja negativă nu este niciodată o eroare de calcul: planificarea spune că un termen limită sau o dată fixă nu încape.

### Referință înainte de început, apoi menținere la zi

Creați o **referință** imediat ce planificarea este aprobată și înainte ca lopata să intre în pământ (*Planificare › Referințe și progres › Gestionare referințe…*). Calculați mai întâi: referința reține datele ultimului calcul. Fără această referință, mai târziu puteți spune doar *că* lucrurile merg altfel, nu cu cât sau de când — iar exact asta aveți nevoie la o ședință de șantier, pentru lucrări suplimentare și atunci când se discută întârzierea.

O referință reține datele, dar nu presupunerile din spatele lor, iar acestea sunt exact ce se întreabă imediat ce se discută întârzierea. Așadar, când o creați, notați pe scurt pe ce se bazează această planificare (în practica planificării: *baza planificării*): ce cifre de productivitate ați folosit, ce calendar și de ce este configurat așa, ce ați lăsat intenționat în afara planificării, cine a furnizat termenele de livrare presupuse și cine a aprobat planificarea. O jumătate de pagină este suficientă.

După aceea, menținerea la zi este un ritm, nu un proiect. Actualizați săptămânal, în aceeași ordine: setați **data raportului de stare** la data la care raportați, introduceți datele de început efectiv și de sfârșit efectiv pentru ce a început și s-a terminat, corectați durata rămasă a lucrărilor în curs și calculați. Un procent singur nu ajunge: datele efective sunt înregistrarea faptică ce va fi analizată mai târziu.

Știți ce face data raportului de stare: lucrările care nu au început încă sunt mutate de aplicație la această dată, iar activitățile de după ele se mută odată cu ele (cu excepția profilului de calcul Microsoft Project). Așadar, dacă uitați să confirmați o activitate sau un jalon terminat, acesta se mută singur spre dreapta. Aceasta nu este o defecțiune, ci modelul refuză să pretindă că ceva din trecut mai poate avea loc. Dacă primiți avertismentul *În afara secvenței*, lucrul s-a făcut într-o altă ordine decât prescrie logica; de obicei acesta este un motiv să revizuiți secvența, nu să închideți avertismentul. Creați o referință nouă doar pentru o modificare reală a domeniului, și atunci alături de prima, nu peste ea.

În final: o planificare este fiabilă doar dacă oamenii care fac lucrul cred în ea. Lăsați conducătorul de șantier și subcontractanții să compare planul săptămânal cu acest model. Dacă săptămână de săptămână realizați doar jumătate din ce s-a convenit, problema ține mai des de planificare decât de execuție.

## Exemplu lucrat: trei alegeri care fac planificarea să înșele discret

Cifrele provin din două exemple elaborate în altă parte din Ajutor: proiectul de exercițiu *House extension* din tutoriale și o rețea mică pentru o extindere. Aici contează ce face fiecare alegere cu planificarea. Încercați singur în tutorialul 2 (dependențe și drumul critic) și în tutorialul 3 (o restricție și un termen limită).

### O dependență uitată

În extindere, lucrările încep luni, 7 iunie 2027, iar predarea are loc vineri, 6 august. *Build outer cavity leaf* (6 zile lucrătoare) are succesorul *Install window frames*, deoarece tâmplăriile se află în fațadă. Cu această dependență, stratul exterior are 2 zile lucrătoare de marjă.

Dacă uitați această dependență, stratul exterior are brusc 23 de zile lucrătoare de marjă, până la predare. Pe hârtie, stratul exterior poate întârzia săptămâni fără ca cineva să aștepte. Nimic nu devine roșu și nu apare nicio avertizare. Doar cu opțiunea de calcul *Activități cu sfârșit deschis, critice* devine critică o astfel de activitate fără succesor, astfel încât golul să iasă în evidență.

### O dată introdusă în loc de o dependență

Rețeaua mică: *Groundwork* (3 zile lucrătoare), *Pour foundation* (2), *Brickwork* (5) și *Roofing* (3), unul după altul, de luni, 7 iunie 2027. Proiectul se termină miercuri, 23 iunie.

Dacă introduceți un început pe luni, 21 iunie, pentru *Brickwork*, deoarece cărămizile sosesc abia atunci, aceasta devine restricția *nu începe înainte de*. Brickwork se mută cu o săptămână, iar proiectul se termină miercuri, 30 iunie. *Groundwork* și *Pour foundation* primesc 5 zile lucrătoare de marjă și nu mai sunt critice. Dacă cărămizile sosesc totuși mai devreme, Brickwork rămâne pe 21 iunie: acum data conduce, nu logica.

Dacă introduceți în schimb miercuri, 9 iunie, înainte ca fundația să fie terminată, nu se întâmplă nimic: dependențele permit oricum ca Brickwork să înceapă abia luni, 14 iunie.

### Un termen limită în loc de o restricție

Dacă doriți ca *Roofing* să fie terminat vineri, 18 iunie, puneți acolo un termen limită. Nimic nu se mută: activitatea *Roofing* rămâne de luni, 21 iunie, până miercuri, 23 iunie. Dar lanțul primește −3 zile lucrătoare de marjă, iar aplicația afișează *Termen limită 18-06-2027 ratat — sfârșit cel mai devreme 23-06-2027*. Așadar vedeți imediat că acordul nu se potrivește, în loc să vedeți o bară la locul corect, cu un lanț în spate care nu o susține.

## Consecințe și idei greșite

- **Activități fără predecesor sau succesor.** Cea mai frecventă și cea mai dăunătoare: aceste activități nu se mișcă odată cu restul și primesc marjă falsă.
- **Introducerea datelor sau tragerea barelor în loc de trasarea logicii.** Asta setează discret o restricție.
- **Prea multe restricții și o fixare rigidă folosită ca semn de carte.** Planificarea nu mai calculează, ci doar desenează.
- **Activități de trei luni sau activități de o jumătate de zi.** Intervalul util este între aproximativ o zi și două săptămâni.
- **Durate optimiste și marjă ascunsă în fiecare activitate în parte**, în loc să fie vizibilă ca rezervă.
- **Întârzierea din cauza vremii și concediul colectiv din construcții nu sunt în calendar.** Oricum vor ajunge în calendar în ianuarie.
- **Decalaje în loc de activități.** Șapte zile de așteptare fără nume nu mai pot fi explicate peste trei luni.
- **Redistribuire înainte ca logica să fie stabilită**, sau continuarea redistribuirii în fața unei lipse structurale de capacitate.
- **Uitarea de a calcula.** *Neactualizat* în bara de stare înseamnă că vedeți calculul anterior.
- **Nicio referință, sau o referință salvată abia după început.**
- **Progres înregistrat doar ca procent**, fără date reale și fără data raportului de stare.
- **Ignorarea panoului *Avertismente* fără să-l citiți.** Acolo se adună termenele limită ratate, restricțiile încălcate, dependențele în afara secvenței și resursele cu supraalocare (*Planificare › Planificare › Avertismente*).

## Vezi și

- [Drumul critic și marja](docs://uitleg-kritiek-pad): cum calculează aplicația datele cel mai devreme și datele târzii, precum și marja.
- [Dependențe și decalaj](docs://uitleg-relaties): cele patru tipuri de dependență, decalajul și dependențele pe o fază.
- [Restricții și termene limită](docs://uitleg-constraints): ce face fiecare restricție și fiecare termen limită cu calculul.
- [Calendare și zile lucrătoare](docs://uitleg-kalenders): cum numără aplicația zilele lucrătoare și ce calendar are prioritate.
- [Zile și ore](docs://uitleg-dagen-en-uren): planificarea în zile, în ore sau mixtă.
- [Redistribuirea resurselor](docs://uitleg-nivelleren): ce mută redistribuirea și ce nu mută.
- [Progres, data raportului de stare și referință](docs://uitleg-voortgang): ce face data raportului de stare și cum citiți varianța.
- [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen): introducerea jaloanelor și a activităților.
- [Adăugarea dependențelor](docs://howto-relaties-leggen): să legați activitățile între ele.
- [Conectarea unui asistent de inteligență artificială (MCP)](docs://howto-ai-assistent-koppelen): un asistent care planifică după aceste principii.
- [Notificări și avertismente](docs://ref-meldingen): toate avertismentele la un loc.
