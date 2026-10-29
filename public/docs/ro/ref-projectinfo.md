# Creare proiect nou și Setări proiect

Câmpurile ferestrei *Creare proiect nou* și ale *Setări proiect*: ce face fiecare câmp, care este implicitul și unde are efect. Sunt două fețe ale aceluiași formular. *Creare proiect nou* creează un proiect nou și are câteva câmpuri în plus. *Setări proiect* modifică proiectul pe care îl aveți deschis.

## Deschidere

**Creare proiect nou** — *Fișier › Nou*, Ctrl+N, sau semnul plus din dreapta filelor de document (*Pornire proiect*, apoi *Creare proiect nou*). Fereastra se deschide cu cursorul în câmpul *Numele proiectului*.

**Setări proiect** — *Setări › Proiect › Setări proiect* deschide formularul ca fereastră cu titlul *Setări proiect*. *Fișier › Setări proiect* afișează același formular în ecranul *Fișier*. Blocul *Profil de calcul și opțiuni de calcul* se află jos, în ambele locuri; ce conține acesta este descris în [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies).

## Creare, Aplicare și renunțare

**Creare** (în fereastra *Creare proiect nou*) creează proiectul. Dacă fila curentă este goală și nemodificată, aplicația folosește acea filă; altfel proiectul se deschide într-o filă nouă. **Aplicare** (în fereastra *Setări proiect*) scrie modificările dumneavoastră în proiect.

- **Numai la Aplicare.** Scrieți într-o ciornă. Proiectul se modifică numai când faceți clic pe *Aplicare*. *Aplicare* scrie doar ce ați modificat, într-un singur pas în *Anulare*. Dacă faceți clic pe *Aplicare* fără să modificați ceva, nu se întâmplă nimic și nu se adaugă niciun pas.
- **Renunțare, crucea și Esc** închid fereastra și nu salvează nimic. Un clic lângă fereastră nu o închide: ce ați scris rămâne.
- **Enter** face același lucru ca *Creare* sau *Aplicare*, cu excepția câmpului *Descriere* și a unei liste derulante deschise.
- **În ecranul Fișier**, *Setări proiect* afișează la sfârșit *Modificările nu au fost aplicate — faceți clic pe Aplicare pentru a le păstra.* cât timp ciorna dumneavoastră diferă. Dacă apoi părăsiți ecranul, aplicația vă întreabă dacă doriți să aplicați modificările, să le eliminați sau să rămâneți pe ecran. Vedeți [Panglica, filă cu filă](docs://ref-lint).
- **Un profil de calcul particularizat fără nume** blochează *Aplicare* și *Creare*. Dați-i un nume sau eliminați modificarea.

## Câmpuri în ambele ferestre

**Numele proiectului** — numele proiectului din bara de titlu, pe filă și în numele fișierului la salvare. Implicit: gol. Un câmp gol este permis: proiectul se numește atunci *Planificare nouă*, afișat cu text gri în câmp. Unde: pe întregul ecran.

**Descriere** — text liber. Implicit: gol. Efect: se salvează cu proiectul, în fișierul IFC și în exportul către Primavera P6 XML, și nu influențează planificarea.

**Autor** — text liber. Implicit: gol. Efect: intră în fișierul IFC și apare ca *Autor:* în antetul unui raport, unde nu îl puteți scrie din nou.

**Bibliotecă de resurse** — de care bibliotecă de resurse este legat proiectul. Alegeți din *fără bibliotecă (proiect independent)*, din bibliotecile dumneavoastră existente și din *+ Bibliotecă de resurse nouă…*. Implicit: în *Creare proiect nou* biblioteca implicită, în *Setări proiect* legătura actuală. Efect: vedeți [Folosirea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken). Cu *+ Bibliotecă de resurse nouă…* scrieți un nume într-un câmp de mai jos; biblioteca se creează numai la *Creare* sau *Aplicare*, deci renunțarea nu lasă nimic în urmă. Legătura din *Setări proiect* se schimbă numai dacă modificați acest câmp.

**Client/organizație** — text liber. Implicit: gol. Efect: intră în fișierul IFC și apare ca *Companie:* în antetul unui raport.

**Data de început** — începutul proiectului. Implicit: în *Creare proiect nou* data de astăzi. Ce face câmpul este explicat mai jos, la *Ce face data de început*.

**Data de sfârșit** — sfârșitul planificat al proiectului. Implicit: gol. Efect: o informație, nu o cerință: aplicația nu planifică spre această dată. Apare în antetul unui raport și în exporturi, și stabilește până la ce an se generează sărbătorile. Numai pentru un fișier Primavera cu setarea *Marja se calculează până la sfârșitul proiectului* (vedeți [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies)) calculul marjei rulează până la această dată.

**Unitate implicită pentru activități noi** — vizibil numai când *Activare planificare pe ore* este activată. Alegeți din *Zile* și *Ore*. Implicit: *Zile*. Efect și condiții: vedeți [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).

**Profil de calcul și opțiuni de calcul** — în *Setări proiect* tot blocul, în *Creare proiect nou* doar lista derulantă *Profil de calcul* cu *Primavera P6*, *Microsoft Project* și *Open Planner Studio*. Implicit: *Open Planner Studio*. Alegerea unui profil setează și opțiunile implicite ale acelui profil. Vedeți [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies).

## Doar în Setări proiect

**Schema IFC la salvare** — care schemă IFC se află în antetul fișierului salvat. Alegere între *IFC 4.3 ADD2 (implicit)*, *IFC 4.3* și *IFC4*. Implicit: *IFC 4.3 ADD2 (implicit)*; pentru un fișier IFC deschis, schema acelui fișier. Efect: se modifică numai antetul fișierului, nu conținutul. Folosiți-o pentru a îmbina planificarea cu un model de clădire în aceeași schemă. Dacă un fișier deschis are altă schemă decât cea implicită, aplicația vă întreabă prima dată la salvare dacă păstrați acea schemă; o alegere de aici valorează drept răspuns. Altă alegere de aici nu este un pas în *Anulare*: schema aparține fișierului. Vedeți [Alegerea schemei IFC](docs://howto-ifc-schema-kiezen).

## Doar în fereastra Creare proiect nou

**Șablon de faze** — cu ce faze începe proiectul. Alegeți din *Gol*, *Construcție de locuințe* și *Clădiri nerezidențiale / renovare*. Implicit: *Gol*. Efect: *Gol* dă un proiect fără activități. Celelalte două adaugă opt activități de fază, fiecare cu o durată de 5 în unitatea implicită a proiectului (5 zile lucrătoare, sau 5 ore dacă alegeți *Ore* la *Unitate implicită pentru activități noi*) și fără dependențe; le redenumiți, le mutați și le extindeți dumneavoastră. Pentru *Construcție de locuințe* acestea sunt: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking și Oplevering. Pentru *Clădiri nerezidențiale / renovare*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen și Oplevering. Numele sunt date ale proiectului și rămân în neerlandeză, și într-o altă limbă a interfeței. Dacă *Activare mod construcții* este dezactivată, există numai *Gol*. Vedeți [Setările aplicației](docs://ref-instellingen).

**Tură** — vizibil numai când *Activare planificare pe ore* este activată. Alegeți din *Tură de zi*, *2 ture*, *3 ture* și *24/7*. Implicit: *Tură de zi*. Efect: *Tură de zi* lasă calendarul standard cum este, un calendar obișnuit de zi de la luni până vineri. Celelalte trei pun intervale de timp de lucru pe calendarul proiectului, ca butoanele cu același nume din fereastra *Calendare*. Ce ore sunt acelea este descris în [Stabilirea timpilor de lucru](docs://howto-werktijden-instellen). Cu *Tură de zi*, nu se poate alege *Ore* la *Unitate implicită pentru activități noi*, pentru că un calendar de zi nu are intervale de lucru.

**Set de sărbători** — ce zile libere primește calendarul proiectului. La *Țară* alegeți *Țările de Jos* (implicit), *Germania*, *Belgia*, *Franța*, *Regatul Unit*, *Austria*, *Elveția*, *Fără sărbători* sau *Particularizat…*. Dacă țara are regiuni, se adaugă o listă derulantă *Regiune*. Pentru Țările de Jos alegeți și, dacă *Activare mod construcții* este activată, *Concediu colectiv din construcții*: *Niciuna* (implicit), *Nord*, *Centru* sau *Sud*. Sub acestea se află o linie ca *36 sărbători, 2025–2029*, pe care o extindeți pentru listă. Anii merg de la anul dinaintea datei de început până la anul de după data de sfârșit, sau până la trei ani după anul de început dacă nu există dată de sfârșit. *Particularizat…* creează un calendar fără sărbători și deschide imediat după creare fereastra *Calendare*, ca să le completați dumneavoastră. Calendarul proiectului se numește *Bouwkalender NL*, sau *Standaardkalender* dacă *Activare mod construcții* este dezactivată; alegerea este atunci și *Fără sărbători*. Cum funcționează generatorul este descris în [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren).

## Ce face data de început

Data de început este punctul de referință al proiectului. Trei reguli:

- **Activitățile noi încep la data de început.** O activitate pe care o adăugați primește începutul proiectului ca început planificat.
- **O activitate cu un predecesor nu începe niciodată înainte de data de început.** Dacă sfârșitul predecesorului este mai devreme, activitatea așteaptă până la data de început. O activitate *fără* predecesor își păstrează data proprie, chiar dacă aceasta se află înaintea datei de început. Este necesar pentru a arăta o planificare din Microsoft Project sau Primavera așa cum o arată programul sursă. O restricție *Trebuie să înceapă la (MSO)* sau *Trebuie să se termine la (MFO)* încalcă ambele reguli: o asemenea activitate rămâne la data ei, chiar dacă aceasta cade înaintea datei de început.
- **O dată de început mai târzie mută activitățile fără predecesor.** Dacă modificați data de început mai târziu în *Setări proiect* și faceți clic pe *Aplicare*, activitățile fără predecesor și fără o restricție care impune o limită inferioară (*nu începe înainte de*, *Trebuie să înceapă la*, *nu se termină mai devreme de* sau *Trebuie să se termine la*) care ar cădea înaintea noii date se mută la acea dată, într-un singur pas în *Anulare*. Aplicația spune câte activități au fost mutate. Aceasta se întâmplă numai când modificați dumneavoastră data de început, niciodată când deschideți un fișier. Mutarea datei de început mai târziu nu mută restul planificării: *Mutare proiect* face asta, vedeți [Mutarea unui proiect](docs://howto-project-verplaatsen).

## Vezi și

- [Opțiuni de calcul și convenții de calcul](docs://ref-rekenopties-en-conventies): blocul *Profil de calcul și opțiuni de calcul*.
- [Profiluri de calcul și convenții de calcul](docs://uitleg-rekenprofielen): de ce un profil schimbă rezultatul.
- [Mutarea unui proiect](docs://howto-project-verplaatsen): întreaga planificare pe o altă dată de început.
- [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen): începerea cu primele activități.
- [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren): setul de sărbători în detaliu.
- [Alegerea schemei IFC](docs://howto-ifc-schema-kiezen): salvarea pentru un model de clădire în IFC4.
