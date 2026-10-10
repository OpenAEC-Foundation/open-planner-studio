# Vytvorenie hamaka

Cieľ: vytvorte úlohu, ktorá nepozná svoje vlastné trvanie. Úloha beží od začiatku jednej úlohy po dokončenie inej, napríklad pri zriadení staveniska, dohľade alebo prenájme stavebnej búdky.

## Kedy to potrebujete

Stavebná búdka stojí na mieste tak dlho, ako sa stavba robí, od prvých zemných prác po odovzdanie. Ak tejto úlohe dáte pevné trvanie 13 pracovných dní, nepôjde spolu s oneskorenými murárskymi prácami a plán prestane byť správny. **Hamak** (nazývaný aj *úroveň úsilia*) sleduje úlohu, na ktorú ho zavesíte: jeho začiatok vychádza zo závislosti na začiatku, jeho dokončenie zo závislosti na dokončení a jeho trvanie je rozdiel medzi nimi.

## Postup

1. Vytvorte úlohu, napríklad *Site cabin*, alebo vyberte existujúcu úlohu. Medzník a súhrnná úloha (fáza) nemôžu byť hamakom. Pre takú úlohu chýba zaškrtávacie políčko v paneli *Vlastnosti* a v okne *Upraviť úlohu* a v stĺpci tabuľky ho nemožno zmeniť.
2. Zaškrtnite *Hamak (odvodené trvanie)* v paneli *Vlastnosti*, v okne *Upraviť úlohu* (kliknite pravým tlačidlom na úlohu, *Upraviť...*) alebo v stĺpci tabuľky *Hamak (odvodené trvanie)* v kategórii *Plánovanie*. Pole *Trvanie* sa potom už nedá upravovať.
3. Pridajte závislosť z úlohy, s ktorou hamak začína, na hamak, typu **SS** (hamak začína spolu s touto úlohou) alebo **FS** (hamak začína až po tejto úlohe). Na to vyberte hamak, kliknite na *Pridať závislosť* v časti *Závislosti*, ponechajte smer na *Predchádzajúca úloha*, vyberte úlohu a vyberte typ. Postup nájdete v článku [Pridanie závislostí](docs://howto-relaties-leggen).
4. Pridajte závislosť z úlohy, s ktorou hamak končí, na hamak, typu **FF** (hamak sa dokončí spolu s touto úlohou) alebo **SF**.
5. Pozrite sa do panela *Vlastnosti* v časti *Hamak (odvodené trvanie)*: tam uvidíte *Určujúca závislosť začiatku* s úlohou a typom a *Určujúca závislosť dokončenia* s úlohou a typom. Určujúca závislosť je úloha, z ktorej hamak preberá začiatok alebo dokončenie.
6. Stlačte **Prepočítať** (F5), napríklad cez *Domov › Plán › Prepočítať*. Hamak teraz beží od začiatku úlohy, ktorú určuje závislosť začiatku, po dokončenie úlohy, ktorú určuje závislosť dokončenia, a *Trvanie* ukazuje odvodené trvanie.

V diagrame Gantt je hamak tenký tyrkysový pruh s háčikom na oboch koncoch.

Príklad: *Site cabin* dostane SS od úlohy *Groundwork* (pondelok 7. júna 2027) a FF od úlohy *Roofing* (dokončená v stredu 23. júna). Po stlačení tlačidla **Prepočítať** hamak beží od pondelka 7. do stredy 23. júna: 13 pracovných dní. Ak murárske práce meškajú o 2 pracovné dni, dokončenie úlohy *Roofing* sa posunie na piatok 25. júna a hamak sa spolu s ňou predĺži na 15 pracovných dní.

## Čo aplikácia robí s hamakom

- Hamak nikdy nie je kritický a nemá časovú rezervu. Neobmedzuje ani úlohy, od ktorých preberá začiatok a dokončenie: kvôli hamaku nedostanú neskoré dátumy.
- Oneskorenie sa počíta. Pri SS a oneskorení `1d` hamak začne jeden pracovný deň po určujúcej závislosti začiatku, pri FF a oneskorení `2d` skončí dva pracovné dni po určujúcej závislosti dokončenia.

## Úskalia a čo robí aplikácia

**Žiadna určujúca závislosť dokončenia.** Ak hamak nemá závislosť FF ani SF, aplikácia nedokáže odvodiť jeho dokončenie. Na paneli *Vlastnosti* sa zobrazí *Žiadna určujúca závislosť dokončenia (FF/SF) — rozpätie sa nastaví na nulovú dĺžku.* a na paneli *Upozornenia* sa zobrazí *Hamak bez určujúcej závislosti dokončenia (bez predchádzajúcej úlohy FF/SF): trvanie sa vráti na nulu*. Hamak potom začne a skončí v ten istý deň. Pridajte závislosť FF alebo SF.

**Hamak, ktorý končí po poslednej úlohe.** Ak hamak trvá až po poslednú úlohu, napríklad pri FF a oneskorení o 2 pracovné dni, dátum dokončenia projektu sa posúva spolu s ním. Úlohy, ktoré skutočne vykonávate, potom získajú časovú rezervu; žiadna z nich už nie je kritická.

**Úlohy, ktoré čakajú na hamak.** Ak pridáte závislosť z hamaku na inú úlohu, táto úloha sa začne až po konci hamaku. Celý reťazec pred hamakom, vrátane úloh, od ktorých hamak preberá začiatok a dokončenie, potom získa časovú rezervu a už nie je kritický, pretože hamak nevytvára spätný tlak. Preto nenechávajte úlohy čakať na hamak; takéto úlohy radšej zaveste na určujúcu závislosť dokončenia hamaku.

**Zadávanie trvania.** Pole *Trvanie* hamaku je odvodené a nedá sa upraviť. Trvanie, ktoré ste zadali pred zaškrtnutím políčka, sa už nepočíta.

## Pozrite aj

- [Pridanie závislostí](docs://howto-relaties-leggen): postup pri pridaní závislosti typu SS alebo FF.
- [Závislosti a oneskorenie](docs://uitleg-relaties): čo znamenajú SS a FF a ako sa počíta oneskorenie.
- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): čo znamená kritický a ako funguje časová rezerva.
- [De Vaart Apartment Complex](examples://showcase-appartementencomplex.ifc): obsahuje hamak *Structural works tower A (LOE)*.
