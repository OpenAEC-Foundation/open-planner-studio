# Postup, dátum kontroly stavu a pôvodný plán

Plán je predpoveď. Keď práca prebieha, chcete vedieť, čo je hotové, čo ešte treba urobiť a čo to znamená pre odovzdanie. Tento článok vysvetľuje, ako aplikácia spracúva postup: čo robí dátum kontroly stavu, ako aplikácia počíta zostávajúcu prácu, prečo úloha, ktorá sa už začala, niekedy stále čaká na svoju predchádzajúcu úlohu, a ako porovnáte aktuálny stav s pôvodnou dohodou. Pracovný príklad ukáže čísla.

## Pojmy

**Postup** je to, čo sa skutočne stalo. Pri každej úlohe aplikácia zapisuje tri údaje: percento, **skutočný začiatok** a **skutočné dokončenie**. Predpoveď plánu zostáva vedľa nich. Skutočnosť je to, čo sa naozaj stalo.

**Dátum kontroly stavu** je deň, keď si urobíte prehľad. Všetko, čo sa stalo pred týmto dňom, je skutočnosť. Všetko, čo ešte treba urobiť, aplikácia naplánuje od začiatku tohto dňa. Skutočný dátum môže pripadnúť na dátum kontroly stavu, ale nikdy nie po ňom.

**Zostávajúca práca** je to, čo treba na úlohe ešte urobiť. Úloha, ktorá trvá 4 pracovné dni a je hotová na 25%, má 3 pracovné dni zostávajúcej práce.

**Pôvodný plán** je uložená kópia plánu v určitom okamihu, zvyčajne v čase schválenia dohody. Neskôr položíte súčasný plán vedľa neho a vidíte, ako ďaleko sa realizácia odchyľuje.

## Ako aplikácia počíta

Príklad nižšie používa profil výpočtu *Open Planner Studio*, s ktorým počíta nový projekt. Ďalej si môžete prečítať, čo sa líši v profiloch Primavera P6 a Microsoft Project.

Aplikácia sa sama neprepočítava. Po každej zmene postupu alebo dátumu kontroly stavu stavový riadok zobrazí *Zastaralé — prepočítajte (F5)*. Stlačte **Prepočítať** (F5), napríklad cez *Plán › Plán › Prepočítať*. Ak je *Automatický prepočet* zapnutý (v *Nastavenia › Projekt › Nastavenia*, karta *Plán*, oddiel *Prepočítanie*), aplikácia to urobí sama.

### Dátum kontroly stavu

Dátum kontroly stavu robí tri veci.

Po prvé, aplikácia odmietne skutočný dátum po dátume kontroly stavu. Dátum, ktorý je rovný dátumu kontroly stavu, je v poriadku.

Po druhé, práca, ktorá sa ešte nezačala, nemôže ležať v minulosti. Ak je takáto úloha naplánovaná pred dátumom kontroly stavu, aplikácia ju presunie na dátum kontroly stavu. Platí to aj pre úlohy po nej, ktoré sa posunú podľa svojich závislostí. Účinok uvidíte v príklade nižšie. V profile Microsoft Project to aplikácia nerobí.

Po tretie, zostávajúca práca úlohy, ktorá už prebieha, začína priamo na dátume kontroly stavu. Aplikácia berie dátum kontroly stavu ako začiatok tohto dňa. Ak si v piatok urobíte prehľad po skončení pracovnej doby, nastavte dátum kontroly stavu na pondelok. Ak ho nastavíte na piatok, aplikácia zostávajúcu prácu naplánuje aj na tento piatok.

Ak ešte nemáte dátum kontroly stavu a zadáte postup, aplikácia nastaví dátum kontroly stavu na dnešný deň a oznámi vám to. Bez dátumu kontroly stavu aplikácia počíta prebiehajúcu úlohu dopredu so zostávajúcim trvaním, ale dozadu s celým trvaním. Časová rezerva potom vyjde záporná a úloha vyzerá kritická bez dôvodu.

### Percento, skutočné dátumy a zostávajúce trvanie

Polia na sebe závisia. Ak vyplníte jedno, aplikácia vyplní ostatné.

- Percento nad 0 znamená, že úloha sa začala. Ak nezadáte skutočný začiatok, aplikácia použije plánovaný začiatok. Ak je úloha naplánovaná na začiatok po dátume kontroly stavu, aplikácia sa najprv opýta, kedy sa skutočne začala.
- Percento 100 znamená dokončené. Ak nezadáte skutočné dokončenie, stane sa dátumom kontroly stavu, aj keď práca bola v skutočnosti hotová skôr.
- Skutočné dokončenie urobí úlohu na 100%. Ak dokončenú úlohu upravíte na menej ako 100%, skutočné dokončenie sa odstráni. Ak vymažete skutočné dokončenie, percento sa vráti na 0 a úloha zostáva *Prebieha*, kým nevymažete aj skutočný začiatok.
- **Zostávajúce trvanie** je trvanie vynásobené tým, čo ešte treba urobiť, zaokrúhlené na celé pracovné dni. Pri úlohe s 2 pracovnými dňami dávajú 0% aj 25% zostávajúcu prácu 2 pracovné dni, a 50% aj 75% zostávajúcu prácu 1 pracovný deň. Pri 90% aplikácia zaokrúhli na 0: zostávajúca práca je potom hotová na dátume kontroly stavu. Úloha v hodinách sa počíta v celých minútach: úloha s 5 hodinami pri 40% má 3 hodiny zostávajúcej práce.
- Medzník má len jeden skutočný dátum.
- Fáza (súhrnná úloha) nemá vlastný postup. Po výpočte sa jej percento odvodí od úloh pod ňou: vážený priemer ich percent, pričom váhou je trvanie v pracovných dňoch. Medzník má váhu 0.

Ak zmeníte trvanie úlohy, ktorá už prebieha, hotová práca zostáva hotová. Percento sa upraví: úloha s 5 pracovnými dňami na 60%, ktorú nastavíte na 10 pracovných dní, skončí na 30%. Aplikácia odmietne trvanie kratšie, než je už hotová práca.

### Dokončené a prebiehajúce úlohy

Dokončená úloha je pevná na svojich skutočných dátumoch. Už sa neposúva a pri dátume kontroly stavu nikdy nie je kritická. Bez dátumu kontroly stavu môže byť dokončená úloha stále kritická.

Prebiehajúca úloha si zachová svoj skutočný začiatok. Posúva sa len zostávajúca práca. Kde zostávajúca práca začína, závisí od režimu postupu.

### Retained Logic a Progress Override

Čo urobí aplikácia, ak sa úloha už začala, kým jej predchádzajúca úloha ešte prebieha? Takáto závislosť sa nazýva **postup mimo poradia**: postup odporuje poradiu. Predstavte si maliara, ktorý už začne v miestnosti, ktorá je omietnutá, kým omietkár je ešte zaneprázdnený inde.

Dva režimy postupu určujú, ako aplikácia to počíta:

- **Retained Logic** (predvolené): závislosť zostáva v platnosti. Zostávajúca práca nasledujúcej úlohy sa riadi závislosťou: pri závislosti dokončenie-začiatok sa začne až po dokončení predchádzajúcej úlohy a nezačne sa skôr ako dátum kontroly stavu.
- **Progress Override**: rozhoduje skutočnosť. Zostávajúca práca nasledujúcej úlohy začína na dátume kontroly stavu, bez čakania na predchádzajúcu úlohu.

V tomto profile je rozdiel len v zostávajúcej práci úloh, ktoré sa už začali, kým ich predchádzajúca úloha ešte nie je dokončená. Ostatné úlohy sa počítajú v oboch režimoch rovnako. Aplikácia takúto závislosť hlási v oboch režimoch: v stavovom riadku ako *Závislosti mimo poradia: 1* a v paneli *Upozornenia*.

### Pôvodné plány a odchýlka

Pri uložení aplikácia zapíše pre každú úlohu bez čiastkových úloh skorý začiatok, skoré dokončenie, trvanie a typ medzníka. Fázy sa do neho nezapisujú. Čo zmeníte neskôr, pôvodný plán nezmení. Môžete mať viac pôvodných plánov; presne jeden je **aktívny**. Diagram Gantt, zostava odchýlok a zostava postupu používajú aktívny pôvodný plán.

**Odchýlka** je rozdiel v pracovných dňoch medzi pôvodným plánom a súčasným plánom. Plus znamená neskôr, mínus skôr. Aplikácia počíta podľa kalendára projektu. Zostava odchýlok uvádza odchýlku začiatku a dokončenia pre každú úlohu. Stav vychádza len z dokončenia: *Neskoro* pri plus, *Skôr* pri mínus, inak *Podľa plánu*. Úloha pridaná po pôvodnom pláne sa nazýva *Nová*; úloha, ktorá už neexistuje, je *Vypustená*.

Dve poznámky. Odchýlka trvania je v tabuľke úloh (stĺpec *Odchýlka trvania*), nie v zostave odchýlok. Porovnáva plánované trvanie úlohy teraz s trvaním v pôvodnom pláne. Postup toto plánované trvanie nemení: úloha, ktorá bola naplánovaná na dva dni a trvala tri dni, má preto odchýlku dokončenia +1, ale odchýlku trvania 0. A ak uložíte pôvodný plán až po zadaní postupu, zapíše sa stav s týmito skutočnými dátumami; odchýlka je potom nula.

Zostava postupu dáva plánovaný postup vedľa skutočného postupu. Obidva sú vážené pracovnými dňami. Plánovaný je podiel každej úlohy, ktorý mal byť podľa pôvodného plánu hotový na dátume kontroly stavu. Skutočný je zadané percento.

### Kde to vidíte

V diagrame Gantt označuje prerušovaná čiara dátum kontroly stavu a dátum je v hlavičke. Pri každej prebiehajúcej úlohe sa čiara vyklenie do bodu v pruhu, ktorý zodpovedá percentu. To je **čiara postupu**. Ak vypnete *Čiara postupu* a necháte zapnutú *Čiara dátumu kontroly stavu*, zostane rovná čiara; ak vypnete obe, čiara aj popisok zmiznú. Tlačidlá *Prekrytie smerného plánu*, *Čiara postupu* a *Čiara dátumu kontroly stavu* sú v *Zobrazenie › Smerné plány a postup* a nič nemenia vo výpočte. Pôvodný plán sa zobrazuje ako tenký pruh pod každým pruhom úlohy. Tabuľka úloh má stĺpce pre postup a pre odchýlku pri každom pôvodnom pláne. Na karte *Zostava* nájdete typy zostáv *Odchýlky* a *Zostava postupu*.

## Pracovný príklad: prístavba po troch týždňoch

Príkladom je cvičný projekt *House extension* z návodov, v stave po pridaní všetkých závislostí: bez stavebnej dovolenky, zdrojov a údajov o hodinách práce. V návode 6 to urobíte sami v cvičnom projekte. Ten projekt má vtedy viac údajov, takže čísla sa tam líšia. Tu si prečítate, prečo sú čísla také, aké sú.

Prístavba začína v pondelok 7. júna 2027. Pri prepočítanom pláne aplikácia uloží pôvodný plán s názvom *Pôvodný plán*: odovzdanie v piatok 6. augusta 2027, 45 pracovných dní.

### Stav v pondelok 28. júna

Dátum kontroly stavu je pondelok 28. júna 2027. Stalo sa toto:

- *Start of construction*, *Set up site*, *Clear garden and paving* a *Set out the extension* sú hotové podľa plánu, od 7. do 10. júna.
- *Excavate foundation trench* bola naplánovaná na 2 pracovné dni (piatok 11. a pondelok 14. júna) a trvala 3 pracovné dni: od 11. do 15. júna.
- *Foundation formwork and reinforcement* trvá od 16. do 18. júna. *Reinforcement inspection* je 18. júna, *Pour foundation* v pondelok 21. júna.
- Práca na *Foundation brickwork* (2 pracovné dni) sa začala v piatok 25. júna a je hotová na 50%.

Po stlačení **Prepočítať** aplikácia vypočíta toto:

- Zostávajúca práca na foundation brickwork je 2 × (1 − 0,5) = 1 pracovný deň. Začína na dátume kontroly stavu, takže sa dokončí v pondelok 28. júna.
- *Lay hollow-core floor* nasleduje v utorok 29. júna. Výsledkom je, že *Build inner cavity leaf* sa začína v stredu 30. júna namiesto v utorok 29. júna. Odovzdanie je v pondelok 9. augusta: o jeden pracovný deň neskôr ako pôvodný plán. Ten jeden navyše deň pri výkope je preto dôvodom, prečo celý projekt mešká, pretože táto úloha bola na kritickej ceste.
- Stavový riadok zobrazí *Kritická cesta: 13 úloh, 46 pracovných dní*. Pred zadaním postupu to bolo 21 úloh a 45 pracovných dní. Osem dokončených úloh, ktoré boli na kritickej ceste, sa už nepočítajú.
- Fáza *Foundations* má 77,8%. Úlohy v nej majú váhu 2 + 3 + 1 + 2 + 1 = 9 pracovných dní. Hotové sú 2 + 3 + 1 pracovné dni, plus polovica z 2: spolu 7. A 7 z 9 je 77,8%. Medzník *Reinforcement inspection* má váhu 0.

Zostava odchýlok to uvádza vedľa pôvodného plánu:

- *Excavate foundation trench*: začiatok 0, dokončenie +1 (dokončenie v pôvodnom pláne 14. júna, teraz 15. júna).
- *Foundation brickwork*: začiatok +1 (24. júna sa zmenil na 25. júna), dokončenie +1.
- *Build outer cavity leaf*: +1, +1. Táto úloha ešte nie je kritická: mala 2 pracovné dni časovej rezervy a zachováva ich.
- *Handover*: +1. Dokončenie projektu sa odchyľuje o 1 pracovný deň.
- Spolu 19 úloh má stav *Neskoro* a 4 majú stav *Podľa plánu*; žiadna úloha nemá stav *Skôr*.

Zostava postupu ukazuje *Plánované* 28,3% a *Skutočné* 23,9%. Úlohy majú spolu váhu 46 pracovných dní. Podľa pôvodného plánu malo byť hotových 13: 4 pracovné dni na prípravu, 2 na výkop, 3 na výstuž, 1 na betonáž, 2 na foundation brickwork a 1 na hollow-core floor. Skutočne je hotových 11: 4 + 2 + 3 + 1, plus polovica dňa na *Foundation brickwork*.

### Čo ak posuniete dátum kontroly stavu?

Rovnaký postup, iný dátum kontroly stavu. Zostávajúca práca na foundation brickwork vždy začína na dátume kontroly stavu, takže sa odovzdanie posúva spolu s ním:

- Dátum kontroly stavu piatok 25. júna: zostávajúca práca pripadne na piatok 25. júna, odovzdanie zostáva v piatok 6. augusta.
- Pondelok 28. júna: odovzdanie v pondelok 9. augusta.
- Utorok 29. júna: odovzdanie v utorok 10. augusta, o 2 pracovné dni neskôr ako pôvodný plán.

### Čo ak zmeníte percento?

Foundation brickwork má 2 pracovné dni. Pri 0% alebo 25% je zostávajúca práca 2 pracovné dni: skončí v utorok 29. júna a odovzdanie je v utorok 10. augusta. Pri 50% alebo 75% je to 1 pracovný deň: skončí v pondelok 28. júna, odovzdanie v pondelok 9. augusta. Pri 90% je zostávajúca práca 0 a úloha sa skončí na dátume kontroly stavu.

### Čo ak nastavíte dátum kontroly stavu bez zadania postupu?

Ak nastavíte len dátum kontroly stavu na pondelok 28. júna a nezadáte nič, podľa plánu sa zatiaľ nič nestalo. Práca, ktorá sa ešte nezačala, nemôže ležať v minulosti. Aplikácia preto presunie všetko na 28. júna: *Start of construction* je potom v tento deň a odovzdanie je v piatok 27. augusta, o 15 pracovných dní neskôr ako pôvodný plán. Preto najprv zadajte existujúci postup.

## Praktický príklad: omietkár a maliar

Teraz príklad pre režim postupu. Je to tá istá prístavba, ale v inom stave. Je streda 21. júla 2027. Všetko až po *Install building services* vrátane je podľa plánu hotové. *Plastering* (4 pracovné dni) sa začalo v utorok 20. júla a je na 25%. *Painting* (3 pracovné dni) nasleduje po omietaní, ale maliar už dnes začal a je na 33%.

Bez postupu sa omietanie plánovalo od utorka 20. do piatku 23. júla a maľovanie od pondelka 26. do stredy 28. júla. Stavový riadok teraz zobrazuje *Závislosti mimo poradia: 1*: maľovanie sa začalo, kým omietanie ešte nie je dokončené. V paneli *Upozornenia* sa zobrazí: *Mimo poradia: postup nasledujúcej úlohy je v rozpore so závislosťou*.

Omietanie má 4 × (1 − 0,25) = 3 pracovné dni zostávajúcej práce: 21., 22. a 23. júla. Maľovanie má 3 × (1 − 0,33) = 2 pracovné dni zostávajúcej práce.

- Pri **Retained Logic** môže táto zostávajúca práca začať až po dokončení omietania. To je piatok 23. júla, takže maľovanie sa začne v pondelok 26. júla a skončí v utorok 27. júla. Pruh beží od skutočného začiatku 21. júla do 27. júla. Celková časová rezerva je 7 pracovných dní.
- Pri **Progress Override** zostávajúca práca začína na dátume kontroly stavu. Maľovanie skončí vo štvrtok 22. júla, skôr ako sa dokončí omietanie. Celková časová rezerva je 10 pracovných dní.

Predanie zostáva v oboch prípadoch v piatok 6. augusta: maľovanie malo aj tak časovú rezervu.

### Ďalšie profily výpočtu

V profiloch Primavera P6 a Microsoft Project sa maľovanie v tomto príklade skončí v rovnakých dátumoch (27. a 22. júla). Líšia sa v týchto bodoch. Sú to pravidlá výpočtu daného profilu. Nájdete ich pod *Nastavenia › Projekt › Info o projekte*, v bloku *Profil výpočtu a možnosti výpočtu*.

- V profile Microsoft Project sa úloha, ktorá ešte nezačala, nepresúva na dátum kontroly stavu (pravidlo výpočtu *Nepresúvať nezačaté úlohy na dátum kontroly stavu*). Ak v uvedenom príklade nastavíte len dátum kontroly stavu a nezadáte nič, predanie v tomto profile zostane v piatok 6. augusta.
- V profile Microsoft Project zostávajúca práca tiež nezačne skôr ako skutočný začiatok plus trvanie, ktoré už uplynulo (pravidlo výpočtu *Zostávajúca práca pokračuje po uplynulom trvaní*). Je to ďalšia spodná hranica popri dátume kontroly stavu: počíta sa neskorší z oboch. Vezmite si úlohu *Build inner cavity leaf* (5 pracovných dní), začatú v utorok 29. júna a na 40% v stredu 30. júna, teda na dátume kontroly stavu (dve partie murujú súčasne, takže práca je už po jednom dni hotová na 40%). Všetko pred ňou je podľa plánu hotové. Open Planner Studio a Primavera P6 nechajú úlohu dokončiť v piatok 2. júla; Microsoft Project v pondelok 5. júla, lebo utorok 29. júna plus 2 uplynulé pracovné dni je štvrtok 1. júla, čo je po dátume kontroly stavu.
- Primavera P6 ako skorý začiatok bežiacej úlohy zobrazuje začiatok zostávajúcej práce, nie skutočný začiatok (v príklade vnútorného muriva je to streda 30. júna).
- V profile Primavera P6 sa pri Progress Override závislosť na nasledujúcej úlohe, ktorá už začala, pre predchádzajúcu úlohu tiež nepočíta: už neobmedzuje jej neskoré dátumy ani jej voľnú časovú rezervu (pravidlo výpočtu *Progress Override ignoruje začatú nasledujúcu úlohu aj pri spätnom výpočte*). V príklade omietkára a maliara to nevidno, lebo omietanie je aj tak kritické cez poter podlahy: jeho neskoré dátumy a voľná časová rezerva sú rovnaké pri Retained Logic aj pri Progress Override.
- Keď otvoríte súbor xer file, aplikácia prevezme režim postupu zo súboru. Režim Actual Dates, tretí režim P6, aplikácia nepozná; takýto súbor počíta v režime Retained Logic.

## Dôsledky a časté nedorozumenia

**„Len posuniem dátum kontroly stavu.“** Ak ho posuniete, zostávajúca práca bežiacich úloh začne na novom dátume. Úloha, ktorá ešte nezačala, nemôže nikdy ležať pred týmto dátumom. Dátum kontroly stavu preto posúvajte len spolu s aktualizáciou postupu.

**„Zadanie 100% zaznamená skutočné dokončenie.“** Iba ak zadáte aj skutočné dokončenie. Ak nastavíte úlohu na 100% bez skutočného dokončenia, jej dokončením sa stane dátum kontroly stavu. Ak bola úloha v skutočnosti dokončená skôr, vyplňte skutočné dokončenie.

**„0% znamená nezačaté.“** Ak má úloha skutočný začiatok, počíta sa ako začatá, aj pri 0%. Zostávajúca práca je potom celé trvanie a začína sa na dátume kontroly stavu. Ak chcete, aby sa úloha počítala znovu ako nezačatá, vymažte skutočný začiatok.

**„Progress Override rieši upozornenie.“** Hlásenie o postupe mimo poradia zostáva. Režim určuje len to, ako aplikácia počíta. Ak závislosť už nie je správna, zmeňte závislosť.

**„Prestávka v rozdelenej úlohe vypadne.“** Nie: prestávka v časti, ktorá ešte zostáva urobiť, zostane v zostávajúcej práci. Uvažujte o úlohe s trvaním 5 pracovných dní s 1-dňovou prestávkou po 2 pracovných dňoch práce, začatej v utorok 29. júna a pri dátume kontroly stavu v stredu 30. júna na 40%. Zostávajúca práca 3 pracovné dni začína na dátume kontroly stavu a beží aj cez prestávku: dokončenie je v pondelok 5. júla. Bez prestávky bolo dokončenie v piatok 2. júla.

**Hodiny a dátum kontroly stavu.** Na páse s nástrojmi nemôžete zadať čas: dátum kontroly stavu vyplníte ako dátum. Ak kontrolu stavu robíte mimo pracovnej doby, nastavte dátum kontroly stavu na najbližší pracovný deň. Úloha v hodinách počíta zostávajúcu prácu od začiatku dňa dátumu kontroly stavu. Uvažujte o *Lay hollow-core floor* v cvičnom projekte po návode 4: 5 hodín, v pondelok 28. júna, pracovný deň od 07:00. Ak je dátum kontroly stavu v pondelok 28. júna a úloha je na 40%, zostáva jej 3 hodiny práce, ktoré bežia od 07:00 do 10:00, aj keď sa toho rána práca už urobila. Ako aplikácia počíta hodiny, je vysvetlené v článku [Dni a hodiny](docs://uitleg-dagen-en-uren).

**Aktualizácia pôvodného plánu.** To nie je možné. Uložíte nový a starý odstránite. Ak presuniete projekt, skutočné dátumy a dátum kontroly stavu sa posunú spolu s ním, ale pôvodné plány sa predvolene neposunú: tak posun zostane viditeľný ako odchýlka. Pozrite si [Presun projektu](docs://howto-project-verplaatsen).

## Pozri tiež

- [Aktualizácia postupu](docs://howto-voortgang-bijwerken): nastavenie dátumu kontroly stavu a zadanie postupu.
- [Import postupu z tabuľky](docs://howto-voortgang-importeren): jednorazové načítanie postupu od pracovníkov na stavbe.
- [Výber režimu postupu](docs://howto-voortgangsmodus-kiezen): nastavenie Retained Logic alebo Progress Override.
- [Ukladanie a správa pôvodného plánu](docs://howto-baseline-opslaan-en-beheren): uloženie pôvodného plánu a jeho používanie.
- [Presun projektu](docs://howto-project-verplaatsen): čo sa stane so skutočnými dátumami, dátumom kontroly stavu a pôvodnými plánmi.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): prečo je úloha kritická a čo znamená časová rezerva.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): postup a dátum kontroly stavu v polovici projektu (20. mája 2027).
