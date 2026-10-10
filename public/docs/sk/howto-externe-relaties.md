# Prepojenia s iným projektom

Cieľ: prepojiť úlohu v tomto projekte s úlohou v inom projektovom súbore, aby váš plán zohľadnil činnosti, ktoré sú naplánované inde.

## Kedy to potrebujete

Vaša prístavba sa môže začať, až keď je pozemok pripravený na stavbu, a táto činnosť je v projekte zhotoviteľa. Alebo môže inštalatér začať, až keď je vaša konštrukcia hotová, a plánuje vo vlastnom súbore. Bežná závislosť funguje iba medzi úlohami v tom istom projekte. **Prepojenie medzi projektmi** spája úlohu s úlohou v inom súbore.

Prepojenie medzi projektmi nepočíta priebežne s druhým projektom. Aplikácia uloží pevný **kotvový dátum**: dátum zdrojovej úlohy v okamihu, keď ju prepojíte. Výpočet používa tento dátum ako hranicu. Ak sa druhý projekt zmení, vo vašom projekte sa nič nepresunie, kým neobnovíte kotvový dátum.

## Postup

1. Vyberte presne jednu úlohu v tomto projekte: úlohu, ktorá závisí od úlohy v druhom projekte, alebo úlohu, od ktorej závisí úloha v druhom projekte.
2. Vyberte *Domov › Úlohy › Prepojiť ▾ › Pridať prepojenie medzi projektmi…*. Rovnaká ponuka je na karte *Plán › Závislosti* a na karte *Tabuľka › Úlohy*. Položka je dostupná iba vtedy, keď je vybraná presne jedna úloha.
3. V okne *Prepojenie medzi projektmi* vyberte jeden z dvoch postupov. Pomocou tlačidla *Zdrojový súbor* vyberiete projektový súbor pod *Vyberte nedávny súbor* a potom v poli *Zdrojová úloha* vyberiete úlohu. Aplikácia súbor číta iba na čítanie, neotvorí ho ako dokument a kotvový dátum prevezme sama. Tento postup funguje iba v desktopovej aplikácii a iba pre súbor zo zoznamu nedávnych súborov. Inak je tlačidlo *Zdrojový súbor* neaktívne. Pomocou možnosti *Ručne (záložný postup)* zadáte *ID projektu* a *ID úlohy* zdrojovej úlohy, prípadne *Názov úlohy (nepovinné)*, a *Kotvový dátum*. Vo webovej verzii je to jediný postup.
4. V poli *Smer* vyberte, či úloha v druhom projekte je vaša predchádzajúca úloha, alebo vaša nasledujúca úloha: *Predchádzajúca úloha (iný projekt → ja)* alebo *Nasledujúca úloha (ja → iný projekt)*.
5. Vyberte *Typ závislosti* (FS, SS, FF alebo SF) a podľa potreby vyplňte *Oneskorenie (pracovné dni)*, napríklad `0d` alebo `2d`.
6. Kliknite na *Pridať prepojenie* a stlačte **Prepočítať** (F5).

Ktorý dátum zadáte ako kotvový dátum pri ručnom prepojení, závisí od smeru a typu:

- Pri externej **predchádzajúcej úlohe** rozhoduje prvé písmeno typu: F znamená dátum dokončenia zdrojovej úlohy, S dátum začiatku. Pri FS a FF preto zadáte dokončenie, pri SS a SF začiatok.
- Pri externej **nasledujúcej úlohe** rozhoduje druhé písmeno: S je dátum začiatku zdrojovej úlohy, F dátum dokončenia. Pri FS a SS preto zadáte začiatok, pri FF a SF dokončenie.

Ak plánujete v hodinách (plánovanie v hodinách je zapnuté a úloha používa kalendár s pracovným časom), pole *Kotvový dátum* navyše vyžaduje čas.

Príklad: dokončenie projektu staveniska je v piatok 18. júna 2027. Prepojíte úlohu *Groundwork* s externou predchádzajúcou úlohou typu FS, kotvový dátum 18. júna 2027. Po kliknutí na **Prepočítať** sa úloha *Groundwork* začne v pondelok 21. júna, teda prvý pracovný deň po kotvovom dátume. Externá nasledujúca úloha funguje opačne: obmedzuje, ako neskoro môže vaša úloha skončiť.

## Čo vidíte a ako to spravujete

- Prepojenia medzi projektmi sa zobrazujú ako text v stĺpcoch *Predchádzajúce úlohy* a *Nasledujúce úlohy* v tabuľke úloh. Pridáte ich tlačidlom **+** v hlavičke tabuľky pod *Závislosti*. Zobrazujú sa s názvom projektu, názvom úlohy a typom závislosti. Malý trojuholník s textom *Chýba zdrojový súbor* ukazuje, že zdroj sa nenačítal. Umiestnite kurzor myši nad prepojenie. Tam vidíte projekt (riadok *ID projektu* ukazuje názov projektu, keď je známy), ID úlohy, kotvový dátum a stav zdroja.
- V diagrame Gantt je pri úlohe sivý prízračný pruh. Pri predchádzajúcej úlohe končí na kotvovom dátume, pri nasledujúcej úlohe na ňom začína. Prerušovaný rámik s červeným označením *zastaralé* znamená, že zdroj sa nenačítal. Pri ručnom prepojení to platí vždy.
- Kliknite pravým tlačidlom na prepojenie v stĺpci a vyberte *Upraviť prepojenie medzi projektmi…* alebo *Odstrániť závislosť*. Ak má prepojenie zdrojový súbor, je tam aj *Obnoviť zdroj*.
- Vyberte *Prepojiť ▾ › Obnoviť všetky prepojenia medzi projektmi*, aby sa zdrojové súbory znovu prečítali a kotvové dátumy sa aktualizovali. To funguje iba v desktopovej aplikácii. Ak máte iba ručné prepojenia, aplikácia zobrazí *Žiadne zdroje, ktoré možno obnoviť (chýba cesta k súboru).* Po obnovení stlačte **Prepočítať**.
- Ak zmeníte typ alebo smer tak, že kotvový dátum potrebuje inú stranu zdrojovej úlohy (začiatok namiesto dokončenia, alebo naopak), aplikácia pri ručnom prepojení požiada o nový kotvový dátum: *Vyberte nový kotvový dátum. Typ závislosti teraz používa opačnú stranu zdrojovej úlohy.* Pri prepojení so zdrojovým súborom aplikácia kotvový dátum znovu načíta sama.

## Úskalia a čo aplikácia robí

**Iný projekt sa spolu s vaším nepresúva.** Ak sa zdrojová úloha posunie na iný dátum, váš plán ďalej počíta so starým kotvovým dátumom, kým ho neobnovíte alebo nezmeníte. Pri ručnom postupe zmeníte kotvový dátum sami: kliknite pravým tlačidlom na prepojenie a vyberte *Upraviť prepojenie medzi projektmi…*.

**Externá predchádzajúca úloha je dolná hranica.** Ak sa vaša úloha kvôli vlastným predchádzajúcim úlohám začne neskôr, než vyžaduje kotvový dátum, rozhoduje tá závislosť. Kotvový dátum úlohu iba posúva.

**Externá nasledujúca úloha je horná hranica.** Ak je kotvový dátum príliš tesný, uvidíte zápornú časovú rezervu na vašej úlohe a na úlohách pred ňou. Samostatné upozornenie sa nezobrazí, preto sledujte stĺpec *Celková časová rezerva*.

**Iba pevné oneskorenie.** Pri prepojení medzi projektmi nemôžete zadať oneskorenie v kalendárnych dňoch ani v percentách. Aplikácia zobrazí: *Prepojenia medzi projektmi podporujú iba pevné oneskorenie v pracovných dňoch alebo v pracovnom čase.* Pracovné dni sa počítajú v kalendári vašej úlohy. Oneskorenie v hodinách sa počíta iba pri úlohe plánovanej v hodinách. Pri úlohe v dňoch ho výpočet ignoruje. Použite preto pracovné dni.

**ID projektu v inom súbore.** ID projektu nie je v poli ani v stĺpci. Je uložené ako `InternalProjectId` v IFC tohto projektu: otvorte projekt, prejdite na kartu *IFC* a vyberte *Generovať IFC*. Výpočet používa iba kotvový dátum. ID nie je iba štítok. Pri obnovení aplikácia najprv rozpozná zdrojový súbor podľa ID projektu, potom podľa cesty k súboru. Ak pri ručnom prepojení zadáte rovnaké ID projektu, aké má zdrojový súbor, prepojenie sa pri obnovení tohto súboru aktualizuje spolu s ním. ID úlohy v druhom projekte nájdete v jeho tabuľke, v stĺpci *ID úlohy* pod *Technické*.

## Pozri aj

- [Závislosti a oneskorenie](docs://uitleg-relaties): ako aplikácia počíta závislosť a oneskorenie.
- [Pridávanie závislostí](docs://howto-relaties-leggen): závislosti medzi úlohami v tom istom projekte.
- [Obmedzenia a termíny](docs://uitleg-constraints): obmedzenia dátumov úlohy bez iného projektu.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): obsahuje prepojenie medzi projektmi na *Car park paving* (externú predchádzajúcu úlohu).
