# Dobré plánovanie

Čo robí plán dobrým? Nie to, ako úhľadne vyzerá, ale to, či odpovie na otázku, ktorá je dôležitá, keď realizácia už prebieha: ak sa toto oneskorí, čo to znamená pre odovzdanie? Tento článok vysvetľuje zásady spoľahlivého plánu a to, prečo majú v aplikácii Open Planner Studio taký veľký význam: aplikácia počíta s tým, čo zadáte, a s ničím iným.

Príklady pochádzajú zo stavebníctva: konštrukčné stavebné činnosti, dokončovacie stavebné remeslá, doby dodania, meškanie kvôli počasiu, subdodávatelia a zmluvný dátum odovzdania. Samotné zásady však nie sú špecifické pre stavebníctvo.

## Koncept

Dobrý plán nie je obrázok toho, čo dúfate, ale **výpočtový model**: úlohy s trvaním, závislosti medzi nimi a kalendár. Aplikácia vypočíta dátumy z tohto modelu. Keď sa niečo zmení, model sa prepočíta a hneď uvidíte, čo to znamená pre ostatné úlohy.

Plánovač pracuje v pevnom poradí:

1. Cieľ: medzníky a dátum odovzdania.
2. Rozpad na časti: fázy, pracovné balíky, úlohy.
3. Trvanie každej úlohy.
4. Závislosti.
5. Obmedzenia a pevné dátumy.
6. Kalendáre.
7. Zdroje.
8. Kritická cesta a časová rezerva.
9. Pôvodný plán a postup.
10. Kontrola.

Toto poradie nie je len zvyk. Ak preskočíte krok, neskôr sa to prejaví ako prekvapenie: úlohy, ktoré nemajú závislosti, sa neposúvajú s ostatnými, trvania bez kalendára sú nesprávne a pôvodný plán, ktorý uložíte až neskôr, zamrzne meškanie namiesto dohody.

## Ako aplikácia počíta s plánom

Každý princíp nižšie súvisí s niečím, čo aplikácia robí. Preto táto časť nasleduje rovnaké poradie.

### Začnite od cieľa, nie od úloh

Najprv zapíšte momenty, ktoré sú pevné. Až potom zapíšte prácu, ktorá sa medzi nimi musí zmestiť: začiatok prípravy staveniska, konečné povolenie, budova je vodotesná, začiatok dokončovacích prác, odovzdanie. Sú to **medzníky**: body bez trvania. Zadajte ich naozaj ako medzník (*Domov › Úlohy › Medzník ▾*), a nie ako úlohu s nulovým trvaním, ktorá sa volá podobne.

Prečo toto poradie: plán, ktorý začína zoznamom úloh, sa stane súčtom. Súčet len zriedka vyjde na dátum v zmluve. Začnite od medzníkov a hneď máte správnu otázku. Nepýtajte sa „ako dlho to všetko spolu trvá“, ale „zmestí sa práca medzi tieto dva momenty, a ak nie, čo sa musí zmeniť“. Od požadovaného dátumu odovzdania postupujte späť: najneskôr dokedy musí byť budova vodotesná, a odtiaľ až k začiatku.

Odovzdanie, ktoré je pevne dané zmluvou, dostane zaškrtávacie políčko *Povinný (zmluvný)*. Každý, kto otvorí súbor, potom vidí, že tento moment sa nedá ani vyjednávať, ani posunúť. Zaškrtávacie políčko je značka pre Gantt a zostavy. Dátum nechráni. Na to slúži termín alebo obmedzenie (pozri nižšie).

### Členenie: fázy, pracovné balíky, úlohy

Pod medzníkmi vytvorte štruktúru: fázy, pod nimi pracovné balíky a pod nimi úlohy. Urobíte to príkazom znížiť úroveň. Úloha s čiastkovými úlohami sa automaticky stane **súhrnnou úlohou**. Aplikácia odvodí jej pruh a trvanie z úloh pod ňou. Preto nikdy nezadávajte trvanie súhrnnej úlohy sami.

Praktické pravidlo pre podrobnosť: **úloha trvá zhruba jeden deň až dva týždne**. Kratšia ako deň znamená, že plánujete dielňu namiesto projektu. To patrí do týždenného plánu stavbyvedúceho, nie do modelu, ktorý má vydržať mesiace. Dlhšia ako dva týždne znamená úlohu, ktorú nemôžete poriadne odhadnúť a nemôžete ju sledovať počas realizácie: „finishing ground floor, 40 days, 45% complete“ nikomu nepovie, či veci idú dobre. Kontroly plánu preto často počítajú, koľko úloh trvá dlhšie ako zhruba dva mesiace. Ak ich je nad niekoľko percent, považuje sa to za nedostatok podrobnosti.

Príliš jemný plán škodí rovnako ako príliš hrubý. Každá úloha si vyžaduje údržbu: treba nakresliť závislosti, zapísať postup a po každej zmene znova posúdiť situáciu. Plán s dvetisíc úlohami pre šesťmesačný projekt nebude presnejší. Stane sa neudržiavaným. Plán, ktorý nik neaktualizuje, je po troch týždňoch fikcia. Zvoľte úroveň, na ktorej môžete postup každý týždeň poctivo nahlásiť.

V praxi: „3. Finishing“ je fáza, „Finishing house 4“ pracovný balík a „Plastering house 4 ground floor“ päťdňová úloha. Hranicu dĺžky môžete vedome prekročiť pri dodacích lehotách a dohľade: dodávka okenných rámov desať týždňov je naozaj jeden nedeliteľný blok čakania a nepretržitý dohľad patrí do hamaka, nie do série umelých rezov.

### Odhad trvania

Trvanie je odhad toho, ako dlho práca trvá, nie toho, ako rýchlo by mohla ísť. Odhadujte pre bežný deň s čatou, ktorú naozaj dostanete. Neodhadujte pre najlepší deň s najlepšou čatou. Optimizmus sa v reťazi sčítava. Plán, v ktorom každá úloha predpokladá najlepší deň, takmer nikdy nedodrží dátum odovzdania.

Dni alebo hodiny je skutočná voľba, nie formátovanie. Zvoľte **dni** pri práci, ktorá udáva tempo na stavbe, napríklad murárske práce, omietanie a kladenie obkladov. Trvá päť dní, bez ohľadu na to, či deň náhodou má osem alebo deväť hodín. Zvoľte **hodiny**, keď sú samotné hodiny jednotkou a záleží na zvyšku dňa: trojhodinová kontrola, štrnásťhodinové liatie betónu rozložené na dva dni, práca v pracovnej zmene. Aplikácia si túto voľbu uchováva pre každú úlohu.

Neskrývajte riziko v jednotlivých trvaniach. Pridanie dňa všade skryje rezervu, takže ju nikto nevidí ani neriadi. A tam, kde bola rezerva naozaj potrebná, sa ukáže, že je príliš malá. Rezervu urobte viditeľnou: výslovnú úlohu nárazníka pred dátumom odovzdania alebo samostatnú rezervu na počasie. Pozor na dvojité započítanie. Zhruba 180 pracovných dní ročne, s ktorými počíta holandské stavebníctvo, je ročný údaj podľa zmluvy (UAV). Už sú z neho odpočítané štátne sviatky, stavebná dovolenka *a* stratené dni. Ak sú sviatky a stavebná dovolenka už v kalendári projektu, zostáva ako samostatná položka len meškanie kvôli počasiu. Meškanie kvôli mrazu a búrke sa riadi vlastnými pravidlami v kolektívnej zmluve Onwerkbaar weer Bouw & Infra. Tieto očakávané stratené dni zapíšte do kalendára alebo do samostatnej položky, nie skryté v trvaní murárskych prác.

### Závislosti: bez siete to nie je plán

Aplikácia počíta dátumy pozdĺž **závislostí**. Úloha sa začne, až keď to dovolia jej predchádzajúce úlohy. Úloha bez závislostí nie je na nič naviazaná. Ak sa konštrukčné práce posunú o dva týždne, odpojená dokončovacia úloha sa nepohne. Plán potom klame a nič nezčervenie.

Preto má každá úloha aspoň jednu predchádzajúcu úlohu a aspoň jednu nasledujúcu úlohu. Výnimku tvorí len prvá úloha projektu a posledný medzník. Pri kontrole plánu je to prvá kontrola: najviac niekoľko percent úloh smie mať chýbajúcu logiku.

**Dokončenie-začiatok je predvolené**, a má to tak aj zostať: najprv hotový základ, potom konštrukčné práce. V zdravom pláne stavby je zhruba deväť z desiatich závislostí typu dokončenie-začiatok. To je požiadavka čitateľnosti: dokončenie-začiatok je jediný typ, ktorému každý na stavbe rozumie bez vysvetlenia, a počas realizácie je jeho priebeh predvídateľný.

**Začiatok-začiatok s oneskorením** slúži na prácu, ktorá naozaj beží paralelne a nečaká. Typický prípad je radová zástavba domov alebo viacposchodová veža: montér ide tri dni za murármi. To je závislosť začiatok-začiatok s trojdňovým oneskorením, nie dokončenie-začiatok na umelo rozseknutej úlohe. Pridajte k nej závislosť dokončenie-dokončenie. Inak by nasledujúca úloha mohla teoreticky skončiť skôr ako predchádzajúca. Na stavbe takmer nikdy nepoužívate začiatok-dokončenie.

Závislosť začiatok-začiatok kreslite radšej medzi úlohami, nie medzi fázami. Ak je predchádzajúcim prvkom fáza, aplikácia nechá nasledujúcu úlohu čakať na tú úlohu vo fáze, ktorá sa začína **naposledy**, nie na prvú. Plán teda nikdy nepočíta príliš skoro, ale niekedy neskôr, než ste chceli. Dokončenie-začiatok a dokončenie-dokončenie s fázou ako predchádzajúcim prvkom čakajú, kým skončí posledná úloha vo fáze. Zvyčajne presne to chcete.

Oneskorenia používajte striedmo, predstihy ešte striedmejšie. Oneskorenie je čakanie bez viditeľného dôvodu. Neskôr nikto nezistí, prečo sú tam sedem dní. Ak ide o tvrdnutie betónu, zadajte ho ako oneskorenie v kalendárnych dňoch, lebo betón tvrdne aj cez víkend. Alebo ešte lepšie urobte skutočnú úlohu „curing“, ktorú každý vidí a sleduje. Predstih, teda negatívne oneskorenie, by naozaj nemal byť vôbec. Pri kontrole plánu je norma nula. Ak chcete prekrytie, rozdeľte predchádzajúcu úlohu alebo použite začiatok-začiatok.

### Obmedzenia a pevné dátumy: čo najmenej

Každá úloha sa najprv plánuje ako „čo najskôr“. Vo väčšine prípadov tak má aj zostať. **Obmedzenie** je limit dátumu vedľa závislostí. Čím viac ich pridáte, tým menej plán počíta a tým viac sa mení na obrázok. Plán plný pevných dátumov pôsobí stabilne a práve preto skrýva riziko. Už sa nehýbe, takže už nevaruje.

Obmedzenie používajte len pre pevný vonkajší dátum, na ktorý plán sám nemá vplyv. Napríklad povolenie, ktoré nebude konečné pred 1. marca (*Začiatok nie skôr ako*), časové okno pre uzávierku, ktoré obec udelila, alebo dátum pripojenia od správcu siete. „Chcem túto úlohu v máji“ nie je vonkajšia skutočnosť. Riešite to logikou alebo iným trvaním. Ako praktické pravidlo: najviac niekoľko percent zostávajúcich úloh smie mať pevný dátumový limit.

Nikdy nezadávajte začiatok ručne, aby sa úloha dostala na miesto. Pri úlohe s predchádzajúcou úlohou aplikácia premení zadaný alebo presunutý začiatok na obmedzenie *Začiatok nie skôr ako (SNET)*. Úloha je potom tam, kde ju chcete mať. Zostane tam aj vtedy, keď celý predchádzajúci reťazec mešká.

Ak chcete sledovať dátum bez toho, aby ste ovplyvnili výpočet, použite **termín**. Nič nepresúva. Ale hneď ako úloha termín nespĺňa, vytvorí zápornú časovú rezervu a upozornenie. Presne ten signál chcete vidieť. Pevné ukotvenie (*Povinné (ukotvenie logiky)*) si nechajte pre extrémny prípad. Potom však vedzte, že v reťazci pred ním vytvára zápornú časovú rezervu. To znamená, že plán hovorí, že sa to nezmestí. Nie že je niečo pokazené.

### Kalendáre: najprv projekt, potom výnimky

Všetky trvania sa počítajú v pracovných dňoch alebo v hodinách pracovnej doby kalendára. Preto správne nastavte kalendár projektu skôr, než zadáte trvania: pracovné dni, pracovný čas, štátne sviatky a stavebnú dovolenku. Kalendár, ktorý opravíte v polovici, posunie celý plán. Hneď pridajte predvídateľné uzávierky: obdobie mrazov, keď sa nelieva betón, a firemnú odstávku medzi Vianocami a Novým rokom.

Zdroju priraďte vlastný kalendár len vtedy, keď sa naozaj líši: montér fasády, ktorý príde štyri dni v týždni, alebo čata, ktorá má inú letnú dovolenku. Kalendár zdroja nezmení ani jeden dátum úlohy. Ten beží ďalej na kalendári úlohy alebo projektu. Len ukazuje, že zdroj v jeden z pracovných dní úlohy nepracuje. V histograme sa to prejaví ako preťaženie. Tento rozdiel je ťažko odhaliteľný, ak neviete, že ste ho vytvorili sami.

### Zdroje: kto to robí a či je to možné

Plán bez zdrojov odpovie len na polovicu otázky. Hneď ako priradíte čaty a techniku, histogram ukáže to, čo samotná časová os nie: že 14. júna potrebujete tri omietkárske čaty, ale máte dve.

Začnite zdrojmi, ktoré sú úzkym miestom. Nie každá skrutka musí byť v pláne. Patria tam vežový žeriav, vaše vlastné čaty, subdodávatelia s obmedzenou kapacitou a dlhé dodacie lehoty. Každému zdroju priraďte poctivú kapacitu. Dvaja omietkári znamenajú dvoch, nie „dvoch, ale v núdzi troch“.

Čítajte histogram ako otázku, nie ako chybu. Červená nad čiarou znamená, že plán v ten deň žiada viac, ako máte. Niekedy je odpoveď: posuňte. Často je odpoveď: toto nebude fungovať, a presne to ste chceli vedieť. **Vyvažovanie** posúva úlohy, kým dopyt nezapadne do kapacity. Ak sa dátum dokončenia môže pohnúť, dovoľte to. Ak je dátum odovzdania pevný, vyvažujte len v rámci časovej rezervy (zaškrtávacie políčko *Vyvažovať len v rámci časovej rezervy (vyhladzovanie) — dátum dokončenia projektu zostane pevný*). Dátum dokončenia potom zostane na mieste a zostane vám nahlásený zostávajúci konflikt. To je poctivejší výsledok než plán, ktorý len vyzerá vyriešene.

*Nevyvažujte*, keď je dopyt trvale väčší ako kapacita. Vyvažovanie preskupí existujúcu prácu v čase. Nenajme ďalších omietkárov a nepostaví druhý žeriav. Tri veže, ktoré potrebujú tú istú čatu v tom istom čase, sú aj po vyvažovaní stále tri veže, ktoré potrebujú tú istú čatu. Jediné, čo sa zmení, je, že odovzdanie sa posunie. Pomôže vtedy etapizácia, dodatočná kapacita alebo iná práca. Nevyvažujte ani vtedy, keď ešte nie sú hotové logika a trvania. Vyvažovali by ste plán, ktorý bude zajtra iný.

### Kritická cesta a časová rezerva: kde je plán zraniteľný

Aplikácia nepočíta znova pri každej zmene. Prepočítajte príkazom **Prepočítať** (F5) a až potom čítajte. Ak stavový riadok hovorí *Zastaralé — prepočítajte (F5)*, pozeráte sa na predchádzajúci výpočet, nie na tento. Pri nastavení *Automatický prepočet* aplikácia prepočíta sama.

**Kritická cesta** je reťaz bez časovej rezervy. Každý stratený deň tam znamená neskoršie odovzdanie. Tam patrí váš dozor a vaši najlepší ľudia. Nepozerajte sa len na červenú. **Celková časová rezerva** hovorí, o koľko môže úloha meškať bez vplyvu na odovzdanie. **Voľná časová rezerva** hovorí, o koľko môže meškať bez toho, aby posunula nasledujúcu úlohu. Rozdiel nemení dátum dokončenia nikoho, ale môže prekážať niekomu inému. Je to užitočné, keď pracujete so subdodávateľmi, ktorých nemôžete dvakrát preplánovať.

Sledujte tri signály. Úloha s niekoľkými dňami časovej rezervy nie je bezpečná úloha, ale takmer kritická. Pri *Označiť takmer kritické* dostanú takéto úlohy vlastnú farbu. Úloha s extrémne veľkou časovou rezervou, v kontrolách plánu viac ako 44 pracovných dní, zhruba dva mesiace, takmer vždy nemá nasledujúcu úlohu. Ukáže vám presne na medzery vo vašej sieti závislostí. A záporná časová rezerva nikdy nie je chyba výpočtu. Plán tým hovorí, že termín alebo pevný dátum sa nezmestí.

### Pôvodný plán pred začiatkom, potom ho priebežne aktualizujte

Vytvorte **pôvodný plán** hneď po schválení plánu a skôr, než sa lopata zarazí do zeme (*Plán › Smerné plány a postup › Spravovať pôvodné plány…*). Najprv prepočítajte: pôvodný plán uloží dátumy z posledného výpočtu. Bez tohto východiska môžete neskôr povedať len *že* sa veci vyvíjajú inak, nie o koľko ani od kedy. Presne to však potrebujete na stavebnej porade, pri dodatočných prácach a vtedy, keď sa rokuje o meškaní.

Pôvodný plán ukladá dátumy, nie predpoklady za nimi. A práve tie sa pýtajú hneď, ako sa rokuje o meškaní. Pri vytváraní preto stručne zapíšte, na čom plán stojí (v praxi plánovania: *podklad plánu*). Uveďte, aké výkonové údaje ste použili. Uveďte, aký kalendár ste zvolili a prečo ste ho tak nastavili. Uveďte, čo ste do plánu zámerne nezahrnuli. Uveďte, kto dodal dodacie lehoty, ktoré ste predpokladali, a kto plán schválil. Pol strany stačí.

Potom je udržiavanie plánu rytmus, nie projekt. Aktualizujte ho každý týždeň v rovnakom poradí. Nastavte **dátum kontroly stavu** na dátum zostavy. Zadajte skutočný začiatok a skutočné dokončenie pre to, čo sa začalo a skončilo. Opravte zostávajúce trvanie toho, čo beží. Potom prepočítajte. Samotné percento nestačí. Skutočné dátumy sú faktický záznam, ktorý sa neskôr bude preverovať.

Vedzte, čo dátum kontroly stavu robí: aplikácia presunie prácu, ktorá ešte nezačala, na dátum kontroly stavu. Úlohy za ňou sa posunú tiež. Výnimkou je profil výpočtu Microsoft Project. Ak teda zabudnete potvrdiť dokončenú úlohu alebo medzník, posunie sa doprava sama. To nie je chyba. Model odmieta predstierať, že sa niečo v minulosti ešte môže stať. Ak dostanete upozornenie *Mimo poradia*, práca sa robila v inom poradí, než predpisuje logika. Zvyčajne je to dôvod upraviť poradie, nie upozornenie odkliknúť. Nový pôvodný plán vytvárajte len pri skutočnej zmene rozsahu. Vtedy ho vytvorte vedľa prvého, nie namiesto neho.

Nakoniec: plán je spoľahlivý, len ak mu veria ľudia, ktorí prácu vykonávajú. Nechajte stavbyvedúceho a subdodávateľov porovnať týždenný plán s týmto modelom. Ak týždeň čo týždeň dosiahnete len polovicu dohodnutého, problém je častejšie v pláne než v realizácii.

## Príklad: tri voľby, ktoré plán potichu skreslia

Čísla pochádzajú z dvoch príkladov, ktoré sú rozpracované inde v nápovede: z cvičného projektu *House extension* z návodov a z malej siete pre prístavbu. Tu ide o to, čo každá voľba urobí s vaším plánom. Vyskúšate si to sami v návode 2 (závislosti a kritická cesta) a v návode 3 (obmedzenie a termín).

### Zabudnutá závislosť

V prístavbe sa začnú stavebné práce v pondelok 7. júna 2027. Odovzdanie je v piatok 6. augusta. *Build outer cavity leaf* (6 pracovných dní) má nasledujúcu úlohu *Install window frames*, lebo rámy okien sú vo fasáde. S touto závislosťou má outer leaf 2 pracovné dni časovej rezervy.

Ak túto závislosť zabudnete, outer leaf má zrazu 23 pracovných dní časovej rezervy až do odovzdania. Na papieri môže meškať týždne a nikto na to nečaká. Nič sa nezafarbí načerveno a nezobrazí sa žiadne upozornenie. Len pri možnosti výpočtu *Úlohy s otvoreným koncom sú kritické* sa úloha bez nasledujúcej úlohy stane kritickou. Tak sa medzera ukáže.

### Zadaný dátum namiesto závislosti

Malá sieť: *Groundwork* (3 pracovné dni), *Pour foundation* (2), *Brickwork* (5) a *Roofing* (3), jedna za druhou, od pondelka 7. júna 2027. Projekt je hotový v stredu 23. júna.

Ak pre *Brickwork* zadáte začiatok v pondelok 21. júna, lebo tehly prídu až vtedy, stane sa z toho *začiatok nie skôr ako*. *Brickwork* sa posunie o týždeň a projekt je hotový v stredu 30. júna. *Groundwork* a *Pour foundation* dostanú 5 pracovných dní časovej rezervy a už nie sú kritické. Ak tehly prídu predsa skôr, *Brickwork* zostane na 21. júna: teraz riadi dátum, nie logika.

Ak namiesto toho zadáte stredu 9. júna, ešte pred dokončením základov, nestane sa nič. Závislosti aj tak dovolia začať *Brickwork* až v pondelok 14. júna.

### Termín namiesto obmedzenia

Ak chcete mať *Roofing* hotový v piatok 18. júna, nastavte pri ňom termín. Nič sa nepohne: *Roofing* zostane od pondelka 21. do stredy 23. júna. Reťaz však má −3 pracovné dni časovej rezervy a aplikácia hlási *Termín 18-06-2027 zmeškaný — skoré dokončenie 23-06-2027*. Hneď vidíte, že dohoda nesedí. Nezostane to ako pruh na správnom mieste, za ktorým reťaz nestíha.

## Dôsledky a mylné predstavy

- **Úlohy bez predchádzajúcej úlohy alebo nasledujúcej úlohy.** Najčastejšia a najškodlivejšia chyba: takéto úlohy sa nehýbu spolu s ostatnými a dostanú falošnú časovú rezervu.
- **Zadávanie dátumov alebo ťahanie pruhov namiesto nastavenia závislostí.** Tým sa tiško nastaví obmedzenie.
- **Príliš veľa obmedzení a pevný dátum ako záložka.** Plán potom už nevypočítava, iba kreslí.
- **Úlohy na tri mesiace alebo na pol dňa.** Použiteľný rozsah je zhruba jeden deň až dva týždne.
- **Optimistické trvania a rezerva skrytá v každej jednotlivej úlohe** namiesto viditeľného nárazníka.
- **Zdržanie kvôli počasiu a stavebná dovolenka nie sú zapísané v kalendári.** Aj tak sa do kalendára dostanú v januári.
- **Oneskorenia namiesto úloh.** O tri mesiace neskôr už nikto nevie vysvetliť sedem dní nepomenovaného čakania.
- **Vyvažovanie skôr, ako sú závislosti nastavené,** alebo pokračovanie vo vyvažovaní pri štrukturálnom nedostatku kapacity.
- **Zabudnutie prepočítať.** V stavovom riadku znamená *Zastarané*, že vidíte predchádzajúci výpočet.
- **Žiadny pôvodný plán alebo pôvodný plán uložený až po začiatku.**
- **Postup zapísaný iba ako percento** bez skutočných dátumov a bez dátumu kontroly stavu.
- **Zavretie panela *Upozornenia* bez jeho prečítania.** Práve tu sa spoja zmeškané termíny, porušené obmedzenia, závislosti s postupom mimo poradia a preťaženie zdrojov (*Plán › Rozvrh › Upozornenia*).

## Pozri tiež

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ako aplikácia počíta skoré a neskoré dátumy a časovú rezervu.
- [Závislosti a oneskorenie](docs://uitleg-relaties): štyri druhy závislostí, oneskorenie a závislosti na fáze.
- [Obmedzenia a termíny](docs://uitleg-constraints): čo každé obmedzenie a termín robia vo výpočte.
- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ako aplikácia počíta pracovné dni a ktorý kalendár má prednosť.
- [Dni a hodiny](docs://uitleg-dagen-en-uren): plánovanie v dňoch, v hodinách alebo zmiešané.
- [Vyvažovanie zdrojov](docs://uitleg-nivelleren): čo vyvažovanie presúva a čo nie.
- [Postup, dátum kontroly stavu a pôvodný plán](docs://uitleg-voortgang): čo robí dátum kontroly stavu a ako čítať odchýlku.
- [Pridanie úloh a medzníkov](docs://howto-taken-en-mijlpalen-toevoegen): zadanie medzníkov a úloh.
- [Pridanie závislostí](docs://howto-relaties-leggen): prepojenie úloh.
- [Pripojenie AI asistenta (MCP)](docs://howto-ai-assistent-koppelen): asistent, ktorý plánuje podľa týchto zásad.
- [Oznámenia a upozornenia](docs://ref-meldingen): všetky upozornenia na jednom mieste.
