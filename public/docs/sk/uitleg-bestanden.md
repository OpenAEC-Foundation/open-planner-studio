# Súbory a formáty

Čo je naozaj v súbore, ktorý uložíte? A čo sa stane s vaším plánom, keď ho exportujete do iného programu? V tomto článku sa dozviete, ako aplikácia pracuje so súbormi: IFC ako vlastný formát, ostatné formáty ako prekladače, čo export vynechá a ako sa uloženie, automatické ukladanie a zotavenie zo zlyhania líšia. Príklad na konci ukazuje číslami, čo export robí.

## Koncept

Open Planner Studio má jeden vlastný formát súborov: **IFC**, otvorený výmenný formát pre stavebné informácie od buildingSMART. Aplikácia zapisuje IFC 4.3; v zozname exportu sa volá *IFC 4x3*. Žiadny druhý, vlastný projektový súbor neexistuje. *Uložiť* zapíše celý projekt ako súbor IFC (`.ifc`) a *Otvoriť* ho zase načíta. Chcete vidieť, čo je v súbore? Karta *IFC* zobrazuje IFC text vášho projektu. *Generovať IFC* tento text obnoví.

Všetky ostatné formáty sú **prekladače**: prekladajú medzi modelom iného programu a modelom aplikácie. Aplikácia číta CSV, MS Project XML, Primavera P6 XML, súbory MS Project (`.mpp`) a súbory Primavera (`.xer`). Zapisuje CSV, MS Project XML, Primavera P6 XML a dva prehľady postupu. Do formátov `.mpp` a `.xer` exportovať nemôžete.

Prečo na tomto rozdiele záleží? Prekladač prenesie len to, čo obe strany poznajú. Súbor IFC aplikácie uchová všetko, čo patrí k vášmu projektu. Každému inému formátu chýba časť z toho a táto časť sa stratí.

## Ako aplikácia pracuje so súbormi

### Čo robí otvorenie

Aplikácia vyberie čítač podľa koncovky: `.ifc`, `.csv`, `.xml`, `.mpp` alebo `.xer`. Pri súbore `.xml` pozrie dovnútra, či ide o MS Project XML alebo Primavera P6 XML. Neznáma koncovka sa berie ako IFC. Ak súbor nie je IFC, aplikácia zobrazí *Otvorenie súboru zlyhalo* a uvedie dôvod.

Každý súbor sa otvorí na vlastnej karte. Výnimkou je karta, ktorá je ešte prázdna a nezmenená: tá karta prevezme súbor. Jeden súbor Primavera môže vytvoriť viac kariet, jednu pre každý projekt s úlohami.

Po otvorení aplikácia vždy prepočíta plán. Ak súbor pochádza z iného programu, dátumy sa môžu líšiť od toho, čo súbor uvádzal. Popisuje to článok [Dátumy tak, ako boli uložené](docs://uitleg-datums-zoals-opgeslagen).

Len súbor IFC sa stane **cieľom uloženia**: súbor, do ktorého *Uložiť* zapisuje. Súbor CSV, XML, `.mpp` alebo `.xer` sa ním nestane. Taký projekt nemá po otvorení žiadny súbor; *Uložiť* sa potom spýta, kam sa má uložiť nový súbor IFC. Stlačením Ctrl+S tak nikdy neprepíšete váš pôvodný súbor textom IFC.

### Čo zapisuje uloženie

*Uložiť* vždy zapíše celý projekt. Zapíše sa toto:

- úlohy so štruktúrou, trvaním, dátumami a postupom;
- závislosti s oneskorením, obmedzeniami a termínmi;
- kalendáre, zdroje a priradenia vrátane kriviek;
- pôvodné plány, kódy aktivít, vlastné polia a poznámky;
- prepojenia medzi projektmi;
- nastavenia projektu, napríklad dátum kontroly stavu, profil výpočtu a možnosti výpočtu;
- prepojenie na knižnicu zdrojov.

Čo nastavíte na obrazovke, nepatrí k projektu a neprenesie sa: priblíženie, pozícia posúvania, vybraná úloha a zbalené fázy. Nastavenia aplikácie, napríklad jazyk a téma, nie sú ani v súbore. Aplikácia si ich uchováva sama, v aplikácii alebo vo vašom prehliadači.

Export do iného formátu váš projekt nezmení. Po exporte má projekt stále rovnaký cieľ uloženia. Ak bol pred exportom označený ako *Neuložené*, zostane tak označený aj potom.

### Čo export stráca

Každý prekladač prenesie to, čo jeho formát pozná.

**MS Project XML** prenesie úlohy, závislosti, kalendáre, zdroje, priradenia, obmedzenia, termíny a dátum kontroly stavu. Z pôvodných plánov sa prenesie len ten aktívny. Kódy aktivít, vlastné polia, poznámky a prepojenia medzi projektmi sa neprenesú. Druhé obmedzenie úlohy sa neprenesie. Obmedzenie *Musí začať dňa (MSO)* alebo *Musí skončiť dňa (MFO)* bez voľby *Povinné (ukotvenie logiky)* sa vráti ako *Začiatok nie skôr ako (SNET)* alebo *Dokončiť nie skôr ako (FNET)*. *Manuálne plánovaná* a *Oneskorenie pri vyvažovaní* úlohy sa nevrátia. Hamak sa stane obyčajnou úlohou s vypočítanými dátumami.

**Primavera P6 XML** prenesie úlohy, závislosti, kalendáre, zdroje, priradenia, obmedzenia a dátum kontroly stavu. Pôvodné plány a termíny sa neprenesú, rovnako ako kódy aktivít, vlastné polia, poznámky a prepojenia medzi projektmi. Aj tu sa hamak stane obyčajnou úlohou. P6 nepozná oneskorenie v percentách: aplikácia takéto oneskorenie prevedie na pevný počet dní. Oneskorenie v kalendárnych dňoch sa prevedie na pracovné dni.

**CSV** je zoznam úloh. Súbor má pre každú úlohu tieto stĺpce: task id, WBS, level, name, duration, start, finish, predecessors, type, id vlastného typu úlohy (`OPS Custom Task Type ID`), status, completion, actual start a finish, critical, total float a description. Zdroje, priradenia, kalendáre, obmedzenia, termíny, pôvodné plány a dátum kontroly stavu v ňom nie sú. Nadpisy stĺpcov sú vždy v angličtine.

**Iba IFC obsahuje profil výpočtu aj možnosti výpočtu.** Ak exportujete do CSV, MS Project XML alebo Primavera P6 XML, profil nie je v súbore. Z možností výpočtu zapíše MS Project XML najviac prahovú hodnotu pre kritické úlohy. Taký súbor sa znovu otvorí ako *Open Planner Studio*. Ak váš projekt používal výpočet podľa *Primavera P6* alebo *Microsoft Project*, napríklad preto, že pochádzal zo súboru `.xer` alebo `.mpp`, dátumy sa kvôli tomu môžu posunúť. Čo je profil výpočtu, vysvetľuje článok [Profily výpočtu a pravidlá výpočtu](docs://uitleg-rekenprofielen).

Ak váš projekt pochádza zo súboru Primavera (`.xer`), aj keď ste ho medzitým uložili ako IFC, aplikácia po exporte do CSV, MS Project XML alebo P6 XML zobrazí: *Pri exporte do CSV sa stratia údaje o pôvode XER.* Pri MS Project XML hovorí *MSPDI* namiesto *CSV*, pri P6 XML hovorí *P6*. Pri IFC sa toto hlásenie nezobrazí: súbor IFC prenesie aj zdrojový súbor Primavera. Pozri [Otvorenie súboru Primavera P6 (.xer)](docs://howto-xer-openen).

Aplikácia pri exporte urobí ešte dve veci. Ak plán nie je prepočítaný po poslednej zmene, aplikácia ho najprv prepočíta a potom exportuje. Plán s kruhovou závislosťou neexportuje: zobrazí hlásenie s cyklom, napríklad *Kruhová závislosť medzi úlohami: Set up site → Demolish existing extension → Set up site*.

### Uložiť, automatické ukladanie a zotavenie zo zlyhania

Sú to tri rôzne veci. Vyzerajú podobne, ale zapisujú na iné miesto.

**Uloženie** robíte vy sami. Aplikácia zapíše váš projekt do vášho súboru a odstráni značku *Neuložené*.

**Automatické ukladanie** je predvolene vypnuté, zapnete ho sami pre každý projekt. Aplikácia potom bez okna zapisuje do toho istého súboru pri každej zmene, najviac raz za desať sekúnd. Funguje len vtedy, ak projekt už má súbor. Pozri [Zapnutie automatického ukladania](docs://howto-automatisch-opslaan).

**Zotavenie zo zlyhania** je vždy zapnuté. Hneď ako sa niečo zmení, aplikácia uchová aj najviac raz za desať sekúnd záložnú kópiu všetkých otvorených projektov, vrátane projektov, ktoré ste sami nezmenili. Táto kópia nie je v súbore projektu: v desktopovej aplikácii je v dátovom priečinku aplikácie, v prehliadači je v úložisku prehliadača. Pri ďalšom spustení aplikácia túto kópiu ponúkne. Viac sa o tom dozviete v článku [Obnovenie po páde](docs://howto-herstellen-na-een-crash). Zotavenie zo zlyhania nikdy nezapisuje do súboru projektu.

Keďže sa kópia ukladá najviac raz za desať sekúnd, pri páde môžete prísť o posledné sekundy práce.

### Desktop a prehliadač

Desktopová aplikácia a verzia pre prehliadač robia s vaším projektom to isté, ale súbory zapisujú inak.

Na desktope aplikácia pracuje so skutočnými cestami k súborom. *Uložiť* zapisuje priamo do vášho súboru. Aplikácia zvyčajne najprv zapíše do dočasného súboru vedľa neho (`.ops-save.tmp`) a až potom nahradí váš súbor, takže ak sa pád stane uprostred zápisu, váš starý súbor zostane zachovaný. Ak aplikáciu zatvoríte so zmenami, pri každom projekte sa spýta, či chcete uložiť. Pri riadnom ukončení vymaže svoje záložné kópie.

V prehliadači, ktorý môže ukladať súbory kamkoľvek (napríklad Chrome a Edge), dostanete bežné okno na otvorenie a uloženie. Potom *Uložiť* zapisuje priamo do súboru; pri súbore, ktorý ste otvorili, sa prehliadač raz opýta na povolenie. Zoznam *Nedávne* funguje, ale zobrazuje len názvy súborov.

V prehliadači bez tejto schopnosti (napríklad Firefox) aplikácia otvorí súbor cez výber súboru a ukladá cez sťahovanie. Pri príkaze *Uložiť* hlásenie *Uložené ako stiahnutý súbor: „name.ifc“ je v priečinku pre sťahovanie. …* vysvetlí toto raz za reláciu; pri *Uložiť ako* a exportoch uvidíte *Uložené ako stiahnutý súbor: „name.ifc“ je teraz v priečinku pre sťahovanie. Toto prostredie neumožňuje aplikácii zapisovať priamo na zvolené miesto.* Ak prehliadač dokáže zobraziť okno na uloženie, ale nedokáže zapísať späť do súboru projektu, *Uložiť* sa pri každom uložení znovu spýta na miesto. Aj to vysvetlí hlásenie raz za reláciu. *Súbor › Nedávne* tam je, ale otvorí prázdnu stránku a automatické ukladanie nie je dostupné. Dostanete rovnaké hlásenie v každom prostredí, ktoré aplikácii nedovolí zapisovať na miesto, ktoré ste vybrali.

## Príklad: export príkladového projektu

Vezmite si príklad *Refurbishment & Extension of a Family Home* (*Súbor › Príklady*). Má 20 úloh, z toho 4 fázy a 2 medzníky, a 16 závislostí. Je v ňom 6 zdrojov s 8 priradeniami, 1 pôvodný plán a prepojenie na *Demo resource library*. Úloha *Demolish existing extension* má obmedzenie *Začiatok nie skôr ako (SNET)* na 14. mája 2027 a úloha *Handover inspection* má termín 29. júla 2027. Plán končí 7. júla 2027.

Takto sa projekt vráti z každého formátu. Merané je to po opätovnom otvorení exportovaného súboru:

- Súbor IFC vráti všetko: 20 úloh, 16 závislostí, 6 zdrojov, 8 priradení, pôvodný plán, obmedzenie, termín a prepojenie na knižnicu. Plán znovu končí 7. júla 2027.
- Súbor MS Project XML vráti tiež všetko okrem prepojenia na knižnicu. Plán končí 7. júla 2027.
- Súbor P6 XML vráti úlohy, závislosti, zdroje, priradenia a obmedzenie. Pôvodný plán a termín chýbajú. Plán stále končí 7. júla 2027, lebo obmedzenie v ňom ešte je.
- Súbor CSV vráti 20 úloh a 16 závislostí. Zdroje, priradenia, pôvodný plán, obmedzenie a termín chýbajú a projekt sa volá *CSV Import*. Bez obmedzenia sa úlohy posunú skôr: plán končí 2. júla 2027, o päť kalendárnych dní skôr.

Bez tohto obmedzenia končí aj samotný príklad 2. júla 2027. Rozdiel teda pochádza z obmedzenia, ktoré súbor CSV neprenesie.

## Dôsledky a nedorozumenia

**Export nie je záloha.** Iba IFC uchová všetko. Ak chcete projekt zachovať, uložte ho ako IFC. Exportujte len pre niekoho, kto potrebuje iný formát.

**Opätovné otvorenie exportu nevždy dá rovnaký plán.** Aplikácia pri otvorení vždy prepočíta plán s profilom výpočtu, ktorý patrí k formátu. Ak chýba logika, ako obmedzenie v príklade CSV, alebo profil počíta inak, výsledok sa zmení.

**Export je aj v zozname *Nedávne*.** Na desktope a v prehliadačoch so prístupom k súborom sa export dostane do zoznamu *Nedávne* rovnako ako uložený projekt (prehľady postupu nie). Ak ho tam otvoríte, otvorí sa ako import tohto formátu.

**Uloženie nie je to isté ako zotavenie zo zlyhania.** Zotavenie zo zlyhania pomôže po páde, ale neslúži namiesto uloženia. Preto uložte pred zatvorením karty alebo aplikácie.

## Pozri aj

- [Otvorenie a uloženie súboru](docs://howto-bestand-openen-en-opslaan): kroky pre otvorenie, uloženie a uloženie ako.
- [Exportovanie](docs://howto-exporteren): výber formátu a čo dostanete.
- [Dátumy tak, ako boli uložené](docs://uitleg-datums-zoals-opgeslagen): prečo importovaný plán môže ukazovať iné dátumy.
- [Obmedzenia a termíny](docs://uitleg-constraints): čo obmedzenie robí, a teda čo zmizne, ak chýba.
- [Závislosti a oneskorenie](docs://uitleg-relaties): čo je oneskorenie a ako ho aplikácia počíta.
- [Vytvorenie hamaka](docs://howto-hammock): čo je hamak, ktorý export zapíše ako obyčajnú úlohu.
- [Kódy a vlastné polia](docs://howto-codes-en-velden): kódy aktivít a vlastné polia, ktoré uchováva iba IFC.
- [Prepojenia medzi projektmi](docs://howto-externe-relaties): prepojenia, ktoré MS Project XML a P6 XML neprenesú.
- [Uloženie a spravovanie pôvodného plánu](docs://howto-baseline-opslaan-en-beheren): pôvodné plány, z ktorých MS Project XML prenesie len aktívny.
- [Formáty importu a exportu](docs://ref-import-exportformaten): pre každý formát, čo sa prenesie a čo nie.
