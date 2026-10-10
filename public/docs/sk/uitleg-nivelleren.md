# Vyvažovanie zdrojov

Máte jedného murára a dve steny, ktoré sa musia postaviť v tie isté dni. Na papieri plán funguje, ale v praxi môže byť murár len na jednom mieste. Vyvažovanie je spôsob, akým aplikácia rieši takéto kolízie: úlohy začnú neskôr, kým zdroj dokáže zvládnuť prácu. V tomto článku presne zistíte, čo vyvažovanie posunie, kedy sa dátum dokončenia zmení a čo za vás nevyrieši.

## Pojem

Zdroj má **preťaženie** v pracovný deň, ak plán od neho v ten deň žiada viac, ako dokáže dodať. Dodať dokáže len toľko, aká je jeho kapacita: *Maximálny počet jednotiek* v pracovné dni jeho kalendára. Ak v daný deň podľa svojho kalendára nepracuje, je jeho kapacita 0.

**Vyvažovanie** to rieši tak, že úlohy začnú neskôr. Nerobí nič viac. Úlohu neskracuje, nedelí, nemení jednotky priradenia ani závislosti a nepridáva ďalší zdroj. Pre každú úlohu aplikácia hľadá prvé miesto, kde sú zdroje voľné, a úlohu tam presunie.

V okne *Vyvažovanie zdrojov* sú dva spôsoby:

- Predvolene sa môže posunúť aj dátum dokončenia projektu. To je vyvažovanie v pravom zmysle.
- S políčkom *Vyvažovať len v rámci časovej rezervy (vyhladzovanie) — dátum dokončenia projektu zostane pevný* posúva aplikácia úlohy len v rámci ich časovej rezervy. Dátum dokončenia potom zostane na mieste. Ak to nevyjde, úloha zostane tam, kde je, a aplikácia hlási konflikt. Čo je časová rezerva, zistíte v článku [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad).

## Ako aplikácia počíta

### Koľko úloha žiada

Pre každý pracovný deň aplikácia spočíta, koľko jednotiek každá úloha žiada od zdroja. Sú to jednotky priradenia podľa krivky alebo podľa vášho vlastného rozloženia práce po hodinách, presne tie isté hodiny za deň, aké ukazuje histogram. Kapacita zdroja je *Maximálny počet jednotiek* alebo hodnota kroku v časovo rozloženej kapacite, ktorá platí pre daný deň. Deň má preťaženie, ak je dopyt väčší ako kapacita.

### V akom poradí

Aplikácia umiestňuje úlohy jednu po druhej v tomto poradí: najprv najvyššia priorita, potom úloha, ktorá má najmenšiu celkovú časovú rezervu, potom skorý začiatok a nakoniec poradie v tabuľke úloh. Úloha sa dostane na rad až vtedy, keď jej predchádzajúce úlohy majú svoje miesto.

Priorita je číslo od 0 do 1000, ktoré nastavíte pre každú úlohu. Predvolená hodnota je 500. V kontextovej ponuke pruhu úlohy je to *Priorita* s voľbami *Nízka* (100), *Normálna* (500) a *Vysoká* (900). Úloha, ktorá sa dostane na rad skôr, dostane miesto, ktoré chce. Úlohy, ktoré prídu neskôr, sa musia prispôsobiť. Priorita tak rozhoduje, ktorá úloha ostane a ktorá ustúpi. Hodnota 1000 je špeciálna: taká úloha sa nikdy nepresúva kvôli kapacite. Je to „Do Not Level“ z MS Project.

### Kam sa úloha presunie

Pre každú úlohu začne aplikácia so skorým začiatkom, aký dovoľujú závislosti. Zohľadní pritom, že jej predchádzajúce úlohy sa mohli už sami posunúť. Ak úloha tam vyjde, zostane tam. Ak nevyjde, aplikácia skúsi ďalší pracovný deň úlohy, a tak ďalej. Úloha vyjde, ak je každý zdroj voľný v každý deň úlohy. Ak má úloha viac zdrojov, musia byť všetky voľné v tie dni. Úloha sa teda vždy posunie neskôr, nikdy skôr.

Aplikácia zapíše posun ako **oneskorenie pri vyvažovaní**: počet pracovných dní v kalendári úlohy, o ktoré úloha začína neskôr, ako vyžadujú jej závislosti. Vidíte ho v stĺpci *Oneskorenie pri vyvažovaní* pod *Vypočítané*. Oneskorenie sa uloží so súborom projektu. *Prepočítať* (F5) ho zohľadní ako dodatočné čakanie pred začiatkom. Úlohy za ňou sa posunú cez svoje závislosti.

### V rámci časovej rezervy alebo za ňou

Bez *vyhladzovania* aplikácia hľadá, až kým úloha nevyjde. Dátum dokončenia projektu sa tak môže posunúť.

S *vyhladzovaním* sa úloha nesmie začať neskôr ako jej neskorý začiatok. To je posledný deň, kedy by mohla začať bez posunutia dátumu dokončenia. Ak úloha v tomto okne nevyjde, zostane na svojom najskoršom mieste. Úloha sa potom objaví pod *Zostávajúce konflikty*.

### Čo aplikácia neposúva

- Úlohy, ktoré už začali alebo sú hotové. Ich záťaž sa počíta, ale nikdy nedostanú oneskorenie pri vyvažovaní.
- Úlohy s prioritou 1000. Riadia sa podľa predchádzajúcich úloh, ale kvôli kapacite sa neposúvajú.
- Úlohy bez priradenia k vybraným zdrojom, medzníky a fázy. Posunú sa len vtedy, ak sa posunie niektorá predchádzajúca úloha.
- Materiál. Ten sa nikdy nevyvažuje.

### Návrh a použitie

*Prepočítať* vytvorí návrh: úlohy, ktoré sa posunú, so starým a novým začiatkom, a dátum dokončenia pred a po posune. Nič sa vo vašom pláne nezmení, kým nevyberiete *Použiť*. Potom aplikácia zapíše oneskorenia do úloh a plán sa hneď prepočíta.

## Pracovný príklad: murár na dvoch stenách

Príklad je cvičný projekt z návodov *House extension* v stave tesne pred vyvažovaním v návode 5. V návode 5 to urobíte sami a overíte si čísla. V tomto príklade má omietka typ *Pevná práca* a omietkár má jednotky priradenia 2, ako v článku [Pravidlá práce: trvanie, jednotky a práca](docs://uitleg-werkregels).

Po dutinovej podlahe, dokončenej v pondelok 28. júna, začnú vnútorná murovaná vrstva (5 pracovných dní) a vonkajšia murovaná vrstva (6 pracovných dní) v utorok 29. júna. Obe úlohy sú priradené murárovi: jednotky priradenia 1 a hodnota *Maximálny počet jednotiek* 1. Po vnútornej vrstve nasledujú strešné prvky (6-hodinová úloha žeriavu) a krytina (2 pracovné dni). Rámy čakajú na krytinu a na vonkajšiu vrstvu. Odovzdanie je v pondelok 30. augusta.

### Preťaženie

Vnútorná vrstva beží od 29. júna do 5. júla vrátane, vonkajšia od 29. júna do 6. júla vrátane. Od 29. júna do 5. júla vrátane, to je 5 pracovných dní, plán žiada 2 jednotky priradenia od murára s kapacitou 1. Murár má v týchto 5 dňoch preťaženie.

### Poradie

Obe úlohy majú prioritu 500. Okenné rámy sa dodajú až 14. júla. V návode 3 ste nastavili obmedzenie *Začiatok nie skôr ako (SNET)* pre ne. Preto má vnútorná vrstva 3 pracovné dni časovej rezervy a vonkajšia 5. Vnútorná vrstva má najmenšiu časovú rezervu, a preto ide ako prvá. Zostane od 29. júna do 5. júla vrátane.

### Posun

Vonkajšia vrstva nemôže začať 29. júna. Prvý deň, keď je murár znovu voľný, je utorok 6. júla. To je o 5 pracovných dní neskôr ako skorý začiatok, takže oneskorenie pri vyvažovaní je 5. Vonkajšia vrstva teraz beží od 6. júla do 13. júla vrátane. Rámy sa aj tak začnú až 14. júla, takže odovzdanie zostane v pondelok 30. augusta. Okno hlási *Dátum dokončenia projektu: bez zmeny (30-08-2027)* a ukáže jeden riadok: *Build outer cavity leaf*, starý začiatok 29-06-2027, nový začiatok 06-07-2027, *5 d*.

Posun o 5 pracovných dní je presne časová rezerva vonkajšej vrstvy. Preto dá *vyhladzovanie* tu rovnaký výsledok. Vonkajšia vrstva už nemá žiadnu časovú rezervu a je kritická.

### Čo ak rámy neprídu 14. júla

Bez tohto obmedzenia môžu rámy začať v piatok 9. júla a odovzdanie je v stredu 25. augusta. Vonkajšia vrstva potom má len 2 pracovné dni časovej rezervy.

- Bez *vyhladzovania* sa vonkajšia vrstva aj tak posunie o 5 pracovných dní. Rámy teraz musia počkať: začnú 14. júla, o 3 pracovné dni neskôr. Všetko za nimi sa posunie a odovzdanie sa zmení z 25. augusta na 30. augusta, tiež o 3 pracovné dni neskôr.
- S *vyhladzovaním* sa nič nepresunie. Vonkajšia vrstva sa nezmestí do svojich 2 pracovných dní časovej rezervy. Okno zobrazí konflikt *Build outer cavity leaf*, 5 dní, s dôvodom *V rámci časovej rezervy nie je dostatok voľnej kapacity na vyriešenie tohto konfliktu.*

### Čo ak dostane vonkajšia vrstva prioritu

Ak dáte vonkajšej vrstve prioritu *Vysoká* (900), príde na rad ako prvá. Zostane 29. júna a teraz ustúpi vnútorná vrstva: o 6 pracovných dní neskôr, od 7. júla do 13. júla vrátane. Vnútorná vrstva má len 3 pracovné dni časovej rezervy, takže posun o 6 pracovných dní je o 3 príliš veľa. Strešné prvky, rámy a všetko za nimi sa posunú spolu s nimi. Odovzdanie sa zmení z pondelka 30. augusta na štvrtok 2. septembra. Rovnaké preťaženie tak dá iný dátum dokončenia podľa toho, ktorá úloha ostane na mieste.

### Čo ak príde druhý murár

Ak nastavíte hodnotu *Maximálny počet jednotiek* murára na 2, preťaženie už nie je. *Prepočítať* hlási *Žiadne úlohy sa nemusia posunúť — plán je už bez konfliktov.*

## Dôsledky a nesprávne predstavy

**„Vyvažovanie nájde najkratší plán.“** Nie. Aplikácia pracuje úlohu po úlohe v pevnom poradí a nehľadá celkovo najlepšie riešenie. Pozrite si príklad s prioritou: iná priorita dá iný dátum dokončenia.

**„Vyvažovaná úloha je bezpečná.“** Vyvažovanie využíva časovú rezervu. Posunutá úloha potom má menej časovej rezervy alebo žiadnu a môže sa stať kritickou, ako vonkajšia vrstva vyššie. Ak potom mešká, posunie sa odovzdanie.

**„Vyvažovanie sleduje moje neskoršie zmeny.“** Nie. Oneskorenie je pevný počet pracovných dní. Ak sa vnútorná vrstva po vyvažovaní skráti, vonkajšia vrstva sa aj tak začne o 5 pracovných dní neskôr, hoci to už nie je potrebné. Potom vyvažujte znovu. Aplikácia začína od nuly.

**Nie všetko sa dá vyriešiť posúvaním.** Ak zdroj v dni, ktoré úloha potrebuje, nepracuje, alebo ak úloha podľa svojej krivky žiada na jeden deň viac, ako zdroj dokáže dodať, preťaženie zostane. Aplikácia potom pri úlohe uvedie, prečo.

**Materiál sa nevyvažuje.** Ak materiál na deň žiada viac, ako je jeho kapacita, aplikácia to hlási ako preťaženie, ale vyvažovanie ho nechá tak.

**Pripnuté úlohy.** Ak všetky kolidujúce úlohy majú prioritu 1000, okno hlási *Žiadne úlohy sa nemusia posunúť — plán je už bez konfliktov.*, zatiaľ čo preťaženie zostane. Po použití teda pozrite na hlásenie *Preťaženie* na páse s nástrojmi.

## Pozri tiež

- [Riešenie preťaženia](docs://howto-overbezetting-oplossen): kroky na nájdenie preťaženia a jeho vyvažovanie.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo je časová rezerva a prečo sa úloha stane kritickou.
- [Pravidlá práce: trvanie, jednotky a práca](docs://uitleg-werkregels): ako sa trvanie úlohy mení spolu s jednotkami priradenia.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): tri veže, ktoré potrebujú tie isté tímy a vežový žeriav, a čo s nimi robí vyvažovanie.
