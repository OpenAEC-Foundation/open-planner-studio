# Creare proiect nou și Informații proiect

Câmpurile ferestrei *Creare proiect nou* și ale *Informații proiect*: ce face fiecare câmp, care este valoarea implicită și unde își face efectul. Ele sunt două ferestre cu același formular. *Creare proiect nou* creează un proiect nou și are câteva câmpuri în plus. *Informații proiect* modifică proiectul pe care îl aveți deschis.

## Deschidere

**Creare proiect nou** — *Fișier › Nou*, Ctrl+N sau semnul plus din dreapta filelor documentelor deschise (*Pornire proiect*, apoi *Creare proiect nou*). Fereastra se deschide cu cursorul în câmpul *Numele proiectului*.

**Informații proiect** — *Setări › Proiect › Informații proiect* deschide formularul ca fereastră cu titlul *Informații despre proiect*. *Fișier › Informații proiect* afișează același formular în ecranul *Fișier*. Blocul *Profil de calcul și opțiuni de calcul* se află jos, în ambele locuri. Ce conține el este descris în [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies).

## Creare, Aplicare și renunțare

**Creare** (în *Creare proiect nou*) creează proiectul și îl deschide într-o filă proprie. **Aplicare** (în *Informații proiect*) scrie modificările dumneavoastră în proiect.

- **Doar la Aplicare.** Scrieți într-o ciornă. Proiectul se modifică numai când faceți clic pe *Aplicare*. *Aplicare* scrie doar ce ați modificat de fapt, într-un singur pas în *Anulare*. Dacă faceți clic pe *Aplicare* fără să modificați nimic, nu se întâmplă nimic și nu se adaugă niciun pas.
- **Renunțare, crucea și Esc** închid fereastra fără să salveze nimic. Un clic lângă fereastră nu o închide: ce ați scris rămâne.
- **Enter** face același lucru ca *Creare* sau *Aplicare*, cu excepția câmpului *Descriere* și a unei liste derulante deschise.
- **În ecranul Fișier**, *Informații proiect* afișează *Modificările nu au fost aplicate — faceți clic pe Aplicare pentru a le păstra.* jos, cât timp ciorna dumneavoastră diferă. Dacă părăsiți apoi ecranul, aplicația întreabă dacă doriți să aplicați, să renunțați sau să rămâneți pe ecran. Vezi [Panglica, filă cu filă](docs://ref-lint).
- **Un profil de calcul particularizat fără nume** blochează *Aplicare* și *Creare*. Dați-i un nume sau renunțați la modificare.

## Câmpuri în ambele ferestre

**Numele proiectului** — numele proiectului din bara de titlu, pe filă și în numele fișierului la salvare. Implicit: gol. Un câmp gol este permis: proiectul se numește atunci *Planificare nouă*, afișat cu text gri în câmp. Unde: pe tot ecranul.

**Descriere** — text liber. Implicit: gol. Efect: se păstrează cu proiectul, în fișierul IFC și în exportul către Primavera P6 XML, și nu are nicio influență asupra planificării.

**Autor** — text liber. Implicit: gol. Efect: intră în fișierul IFC și apare ca *Autor:* în antetul unui raport, unde nu îl puteți modifica.

**Bibliotecă de resurse** — de care bibliotecă de resurse este legat proiectul. Alegeți dintre *fără bibliotecă (proiect independent)*, bibliotecile dumneavoastră existente și *+ Bibliotecă de resurse nouă…*. Implicit: în *Creare proiect nou* biblioteca implicită, în *Informații proiect* legătura actuală. Efect: vezi [Utilizarea bibliotecii de resurse](docs://howto-resourcebibliotheek-gebruiken). Cu *+ Bibliotecă de resurse nouă…* scrieți un nume într-un câmp de mai jos. Biblioteca se creează abia la *Creare* sau *Aplicare*, deci renunțarea nu lasă nimic în urmă. O legătură din *Informații proiect* se modifică numai dacă atingeți dumneavoastră acest câmp.

**Client/organizație** — text liber. Implicit: gol. Efect: intră în fișierul IFC și apare ca *Companie:* în antetul unui raport.

**Data de început** — începutul proiectului. Implicit: în *Creare proiect nou* data de azi. Ce face câmpul este descris mai jos, la *Ce face data de început*.

**Data de sfârșit** — sfârșitul planificat al proiectului. Implicit: gol. Efect: o informație, nu o cerință: aplicația nu planifică spre această dată. Apare în antetul unui raport și în exporturi, și stabilește până la ce an se generează sărbătorile. Numai pentru un fișier Primavera, cu setarea *Marja se calculează până la sfârșitul proiectului* (vezi [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies)), calculul marjei merge până la această dată.

**Unitate implicită pentru activități noi** — vizibil numai când *Activare planificare pe ore* este activată. Alegeți dintre *Zile* și *Ore*. Implicit: *Zile*. Efect și condiții: vezi [Activarea planificării pe ore](docs://howto-urenplanning-aanzetten).

**Profil de calcul și opțiuni de calcul** — în *Informații proiect* tot blocul. În *Creare proiect nou* doar lista derulantă *Profil de calcul*, cu *Primavera P6*, *Microsoft Project* și *Open Planner Studio*. Implicit: *Open Planner Studio*. Alegerea unui profil setează și opțiunile implicite ale acelui profil. Vezi [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies).

## Doar în fereastra Creare proiect nou

**Șablon de faze** — cu ce faze începe proiectul. Alegeți dintre *Gol*, *Construcție de locuințe* și *Clădiri nerezidențiale / renovare*. Implicit: *Gol*. Efect: *Gol* dă un proiect fără activități. Celelalte două pregătesc opt activități de fază, fiecare cu o durată de 5 în unitatea implicită a proiectului (5 zile lucrătoare, sau 5 ore dacă alegeți *Ore* la *Unitate implicită pentru activități noi*), și fără dependențe. Le redenumiți, le mutați și le prelungiți dumneavoastră. Pentru *Construcție de locuințe* acestea sunt: Bouwplaats & grondwerk, Fundering, Ruwbouw / casco, Dak, Gevel & afbouw, Installaties (W/E), Afwerking și Oplevering. Pentru *Clădiri nerezidențiale / renovare*: Sloop & strip-out, Grondwerk & fundering, Hoofddraagconstructie, Gevel & dak, Installaties (W/E), Afbouw, Inregelen & testen și Oplevering. Numele sunt date ale proiectului dumneavoastră și rămân în neerlandeză, chiar și într-o altă limbă a interfeței. Dacă *Activare mod construcții* este dezactivată, există numai *Gol*. Vezi [Setări](docs://ref-instellingen).

**Tură** — vizibil numai când *Activare planificare pe ore* este activată. Alegeți dintre *Tură de zi*, *2 ture*, *3 ture* și *24/7*. Implicit: *Tură de zi*. Efect: *Tură de zi* lasă calendarul standard cum este, un calendar obișnuit de zile de la luni până vineri. Celelalte trei adaugă intervale de lucru în calendarul proiectului, ca butoanele cu același nume din fereastra *Calendare*. Ce ore sunt acelea este descris în [Stabilirea timpului de lucru](docs://howto-werktijden-instellen). Cu *Tură de zi*, *Ore* nu se poate alege la *Unitate implicită pentru activități noi*, pentru că un calendar de zile nu are intervale de lucru.

**Set de sărbători** — ce zile nelucrătoare primește calendarul proiectului. La *Țară* alegeți *Țările de Jos* (implicit), *Germania*, *Belgia*, *Franța*, *Regatul Unit*, *Austria*, *Elveția*, *Fără sărbători* sau *Particularizat…*. Dacă țara are regiuni, se adaugă lista derulantă *Regiune*. Pentru Țările de Jos alegeți și, dacă *Activare mod construcții* este activată, *Concediu colectiv din construcții*: *Niciuna* (implicit), *Nord*, *Centru* sau *Sud*. Sub acestea se află un rând ca *36 de sărbători, 2025–2029*, pe care îl extindeți pentru listă. Anii merg de la anul dinaintea datei de început până la anul de după data de sfârșit, sau până la trei ani după anul de început dacă nu există dată de sfârșit. *Particularizat…* creează un calendar fără sărbători și deschide fereastra *Calendare* imediat după creare, ca să le completați dumneavoastră. Calendarul proiectului se numește *Bouwkalender NL*, sau *Standaardkalender* dacă *Activare mod construcții* este dezactivată. Atunci există și alegerea *Fără sărbători*. Cum funcționează generatorul este descris în [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren).

## Ce face data de început

Data de început este punctul de referință al proiectului. Trei reguli:

- **Activitățile noi încep la data de început.** O activitate pe care o adăugați primește începutul proiectului ca început planificat.
- **O activitate cu un predecesor nu începe niciodată înainte de data de început.** Dacă sfârșitul predecesorului este mai devreme, activitatea așteaptă până la data de început. O activitate *fără* predecesor își păstrează propria dată, chiar dacă aceasta este înainte de data de început. Acest lucru este necesar pentru a arăta o planificare din MS Project sau Primavera așa cum o arată programul sursă. O restricție *Trebuie să înceapă la (MSO)* sau *Trebuie să se termine la (MFO)* încalcă ambele reguli: o astfel de activitate rămâne pe data ei, chiar dacă aceasta cade înainte de data de început.
- **O dată de început mai târzie mută activitățile libere.** Dacă mutați data de început mai târziu în *Informații proiect* și faceți clic pe *Aplicare*, activitățile fără predecesor și fără o restricție care impune o limită inferioară (*Nu începe înainte de*, *Trebuie să înceapă la*, *Nu se termină mai devreme de* sau *Trebuie să se termine la*) care ar cădea înainte de noua dată se mută la acea dată, într-un singur pas în *Anulare*. Aplicația arată câte activități au fost mutate. Acest lucru se întâmplă numai când schimbați singur data de început, niciodată la deschiderea unui fișier. Mutarea datei de început mai târziu nu mută restul planificării. *Mutare proiect* face asta, vezi [Mutarea unui proiect](docs://howto-project-verplaatsen).

## Vezi și

- [Opțiuni de calcul și convenții](docs://ref-rekenopties-en-conventies): blocul *Profil de calcul și opțiuni de calcul*.
- [Profiluri de calcul și convenții](docs://uitleg-rekenprofielen): de ce un profil schimbă rezultatul.
- [Mutarea unui proiect](docs://howto-project-verplaatsen): întreaga planificare la un alt început.
- [Adăugarea activităților și a jaloanelor](docs://howto-taken-en-mijlpalen-toevoegen): începutul cu primele activități.
- [Generarea sărbătorilor și a concediului colectiv din construcții](docs://howto-feestdagen-genereren): setul de sărbători în detaliu.
