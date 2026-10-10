# Generovanie sviatkov a stavebnej dovolenky

Cieľ: mať sviatky krajiny a prípadne stavebnú dovolenku vyplnené v kalendári. Podľa potreby pridajte vlastný deň alebo obdobie voľna.

## Kedy to potrebujete

Bez sviatkov aplikácia jednoducho naplánuje prácu na Vianoce alebo na Deň kráľa. Nový projekt už dostane holandské sviatky, ak je zapnutý *Stavebný režim*. Sviatky vygenerujete znova, ak potrebujete inú krajinu alebo región, ak chcete zahrnúť stavebnú dovolenku, alebo ak váš projekt leží mimo rokov, pre ktoré boli sviatky vytvorené. Tieto roky sú dôležité: pre aplikáciu je deň mimo nich jednoducho pracovný deň. Ako aplikácia zohľadňuje sviatok pri počítaní, si môžete prečítať v článku [Kalendáre a pracovné dni](docs://uitleg-kalenders).

**Stavebná dovolenka** (*bouwvak*) je spoločná dovolenka v holandskom stavebníctve, tri týždne v lete. V aplikácii je predvolene vypnutá.

## Postup

### Generovanie sviatkov

1. Zvoľte *Plán › Kalendár › Kalendár* a vľavo zvoľte kalendár, do ktorého sa majú sviatky zapísať.
2. Kliknite na *Vygenerovať sviatky…*. Pod tlačidlom sa otvorí panel s možnosťami.
3. V poli *Krajina* zvoľte krajinu: Holandsko, Nemecko, Belgicko, Francúzsko, Spojené kráľovstvo, Rakúsko, Švajčiarsko alebo *Žiadne sviatky*. Pri niektorých krajinách sa zobrazí aj zoznam *Región*, napríklad spolková krajina v Nemecku. Možnosť *Celoštátne* ponechá iba sviatky, ktoré platia všade.
4. Pri Holandsku zvoľte v poli *Stavebná dovolenka* jednu z možností: *Žiadna* (predvolené), *Sever*, *Stred* alebo *Juh*. Stavebná dovolenka sa v zozname zobrazí ako jedno obdobie, napríklad *Stavebná dovolenka (Sever)*, tri týždne od pondelka do piatka. Túto voľbu vidíte iba vtedy, ak je zapnutý *Stavebný režim*.
5. Pod možnosťami je súhrn, napríklad *Sviatky: 21, 2026–2028*. Kliknite naň, aby ste videli dátumy.
6. Kliknite na *Vygenerovať*. Zoznam *Sviatky* je teraz vyplnený.
7. Kliknite na *Použiť*. Aplikácia okamžite prepočíta plán.

Pre Holandsko aplikácia každý rok zapíše do zoznamu: Nieuwjaar (Nový rok), Goede Vrijdag (Veľký piatok), Pasen (Veľká noc, dva dni), Koningsdag (Deň kráľa), Hemelvaart (Nanebovstúpenie), Pinksteren (Turíce, dva dni) a Kerst (Vianoce, 25. a 26. decembra). Ak Deň kráľa pripadne na nedeľu, je 26. apríla. Bevrijdingsdag (Deň oslobodenia) je v zozname iba v rokoch deliteľných piatimi, napríklad 2025 a 2030.

Roky vychádzajú z obdobia projektu: od roka pred dátumom začiatku do roka po dátume konca. Ak projekt nemá dátum konca, najviac tri roky po roku začiatku. Začiatok a koniec upravíte v *Nastavenia › Projekt › Info o projekte*.

### Opätovné generovanie po zmene obdobia projektu

Ak sa projekt posunie alebo dostane neskorší dátum konca, sviatky už nepokrývajú nové roky. Aplikácia to ukáže v okne *Kalendáre*, napríklad: *Sviatky pokrývajú 2025–2028; projekt beží do 2030. Chcete ich vygenerovať znova?* Kliknite na *Vygenerovať znova*. Aplikácia použije pre roky projektu rovnaké voľby ako naposledy: krajinu, región a stavebnú dovolenku. Potom kliknite na *Použiť*. Túto správu vidíte iba pri kalendári, ktorého sviatky sa vygenerovali skôr.

### Pridanie vlastného dňa alebo obdobia voľna

1. V okne *Kalendáre* kliknite na *Pridať sviatok*. Na konci zoznamu sa objaví nový riadok s dnešným dátumom v stĺpci *Od*.
2. Vyplňte *Popis*, napríklad *Firemný výlet*.
3. Upravte *Od*. Pre jeden deň nechajte *Do* prázdne. Pre obdobie, napríklad zimnú dovolenku, vyplňte posledný deň voľna.
4. Kliknite na *Použiť*.

Ikonou koša za riadkom odstránite sviatok.

### Odstránenie všetkých sviatkov

V poli *Krajina* zvoľte *Žiadne sviatky* a kliknite na *Vygenerovať*. Zoznam sviatkov je potom prázdny.

## Úskalia a čo aplikácia potom urobí

**Generovanie nahradí celý zoznam.** Dni, ktoré ste pridali sami, zmiznú tiež. Pridajte ich potom znova.

**Goede Vrijdag (Veľký piatok) je zahrnutý.** Ak vaša firma pracuje na Veľký piatok alebo na Bevrijdingsdag (Deň oslobodenia) v roku deliteľnom piatimi, odstráňte ten riadok ikonou koša.

**Dátumy stavebnej dovolenky sú odporúčané dátumy.** Aplikácia ich pozná pre roky 2025 až 2028 vrátane. Pre ostatné roky urobí hrubý odhad. Ak zvolíte stavebnú dovolenku, zobrazí preto *Odporúčané dátumy — overte u Bouwend Nederland*. Ak je to potrebné, upravte obdobie v zozname.

**Neplatný riadok.** Riadok bez platného *Od*, s *Do* pred *Od* alebo s nečitateľným dátumom dostane červenú správu, napríklad *Dátum konca je pred dátumom začiatku.* Tlačidlo *Použiť* je neaktívne, kým riadok neopravíte.

**Pri novom projekte.** V okne *Nový projekt* sú v časti *Súbor sviatkov* rovnaké možnosti. Pri možnosti *Vlastné…* začnete bez sviatkov. Po vytvorení sa otvorí okno *Kalendáre*, aby ste ich mohli vyplniť sami.

## Pozri tiež

- [Kalendáre a pracovné dni](docs://uitleg-kalenders): ako aplikácia zohľadňuje sviatky a stavebnú dovolenku pri počítaní pracovných dní.
- [Vytvorenie a priradenie kalendára](docs://howto-kalender-maken-en-toewijzen): vytvorenie vlastného kalendára pre sviatky.
- [Okná kalendára](docs://ref-kalenders): všetky polia okien kalendára.
- [Nový projekt a Info o projekte](docs://ref-projectinfo): súbor sviatkov pre nový projekt.
- [6 New Terraced Houses, De Akkers](examples://showcase-rijwoningen-de-akkers.ifc): okrem sviatkov má kalendár projektu obdobie voľna *Frost delay, foundations*.
