# Presunutie projektu

Cieľ: posunúť celý plán na nový dátum začiatku a vopred vidieť, čo to urobí s dokončením.

## Kedy to potrebujete

Začiatok prác sa posúva: povolenie príde neskôr, alebo použijete plán skoršieho domu pre ďalší dom. Presúvať každú úlohu jednu po druhej je veľa práce. Pomocou **Presunúť projekt** zadáte jeden nový dátum začiatku a aplikácia posunie všetko ostatné.

Dokončenie projektu sa nie vždy posunie o rovnaký počet dní ako začiatok. **Kalendár** sa nepresúva spolu s plánom: sviatky, stavebná dovolenka a zimné prerušenie sú viazané na pevné dátumy. Príklad: pomocou *Domov › Súbor › Vytvoriť* vytvoríte projekt s *Dátum začiatku* 29-09-2026, *Krajina* na *Holandsko* a *Stavebná dovolenka* na *Žiadne*. Vložíte doň plán s 30 pracovnými dňami, ktorý sa dokončí 9. novembra 2026. Ak ho presuniete na 14. decembra 2026, teda o 76 kalendárnych dní neskôr, dokončí sa 26. januára 2027. Je to o 78 dní neskôr, pretože 25. decembra a 1. januára sú vo vašom pláne dni voľna. Trvanie zostáva 30 pracovných dní. Náhľad v okne to ukáže skôr, než čokoľvek zmeníte.

## Kroky

1. Vyberte *Plán › Plán › Presunúť projekt…*. Tlačidlo je deaktivované, kým projekt nemá dátum začiatku.
2. V časti *Súčasný začiatok projektu* pozrite, kedy projekt začína teraz. V časti *Nový začiatok projektu* vyberte nový dátum.
3. Ak projekt má pôvodné plány, zobrazí sa políčko *Posunúť aj pôvodné plány*. Nechajte ho vypnuté, ak chcete posun ďalej vidieť ako odchýlku od pôvodného plánu (pozrite úskalia nižšie).
4. Kliknite na *Prepočítať náhľad*. Aplikácia vypočíta posunutý plán v plnom rozsahu, bez zmeny čohokoľvek vo vašom projekte.
5. Pozrite sa na náhľad (pozrite nižšie). Ak je správny, kliknite na *Presunúť*.

V náhľade vidíte:

- posun v kalendárnych dňoch (*Posun: 76 kalendárnych dní neskôr*);
- *Začiatok projektu* a *Dokončenie projektu*, pred a po zmene;
- červené upozornenie, ak kalendár zasahuje, alebo hlásenie, že trvanie projektu zostáva rovnaké;
- počet posunutých úloh a čo sa ešte posunie;
- upozornenia, ktoré si treba prečítať (pozrite úskalia).

Aplikácia vypočíta nový plán hneď, takže nemusíte použiť **Prepočítať** (F5). Zároveň prispôsobí zobrazenie celému projektu. Celé presunutie vrátite jedným krokom pomocou *Vrátiť späť* (Ctrl+Z).

Tlačidlo *Presunúť* funguje len po náhľade bez chyby a len vtedy, ak sa nový dátum líši od súčasného. Ak zmeníte dátum alebo políčko, náhľad zmizne a treba ho znova prepočítať.

### Čo sa posunie a čo nie

Posunie sa: začiatok a dokončenie každej úlohy, skutočný začiatok a skutočné dokončenie, dátumy obmedzení (aj tvrdého pevného ukotvenia Mandatory, pozrite [Obmedzenia a termíny](docs://uitleg-constraints)), termíny, dátum kontroly stavu, kotvy prepojení medzi projektmi a kroky dostupnosti zdrojov. Posunie sa aj začiatok projektu a, ak ste ho vyplnili, aj dátum dokončenia projektu.

Čo sa neposunie:

- kalendáre, teda sviatky, stavebná dovolenka a zimné prerušenie;
- pôvodné plány, pokiaľ nezapnete *Posunúť aj pôvodné plány*;
- vyplnené vlastné pole typu *Dátum*.

## Úskalia a čo aplikácia robí

**Dokončenie sa posunie o iný počet dní.** Ak náhľad zistí, že dokončenie sa posunie o viac alebo o menej kalendárnych dní ako začiatok, alebo že sa zmení trvanie projektu v pracovných dňoch, zobrazí červené upozornenie s číslami. Potom môžete ešte zrušiť.

**Pôvodné plány zostanú nezmenené.** Pôvodný plán slúži na meranie odchýlky. Ak projekt presuniete s vypnutým políčkom, posun vidíte ako odchýlku od pôvodného plánu. Ak políčko zapnete, pôvodné plány sa posunú spolu s plánom. Posunú sa len ich dátumy; dátum, kedy bol pôvodný plán uložený, sa nemení.

**Bežiaci projekt.** Skutočné dátumy sa posunú spolu s plánom. V projekte, kde ste už zadali postup, to nie vždy chcete. Aplikácia upozorní: *Skontrolujte, či je to pri bežiacom projekte správne.*

**Prepojenia medzi projektmi.** Kotva vo vašom projekte sa posunie spolu s plánom, zdrojový projekt sa neposunie. Po presunutí obnovte prepojenia pomocou *Domov › Úlohy › Prepojiť ▾ › Obnoviť všetky prepojenia medzi projektmi*. Pozrite [Prepojenia medzi projektmi s iným projektom](docs://howto-externe-relaties).

**Sviatky, ktoré nesiahajú dostatočne ďaleko.** Kalendár s vygenerovanými sviatkami pokrýva niekoľko rokov. Ak posunutý plán presahuje tento rozsah, aplikácia vypočíta ten rok bez sviatkov. Náhľad na to upozorní, napríklad: *Vygenerované sviatky kalendára „Bouwkalender NL“ pokrývajú 2025–2029; posunutý plán beží do 2030. Vygenerujte sviatky znova.* Najskôr projekt presuňte. Potom otvorte *Plán › Kalendár › Kalendár*: vedľa sviatkov je teraz *Vygenerovať znova*. Potvrďte tlačidlom *Použiť* a aplikácia prepočíta plán. Rozsah nových sviatkov sa riadi dátumami projektu, takže vygenerovanie pred presunom nepomôže.

**Dátum je v minulosti.** To je povolené, ale náhľad to uvedie: *Nový začiatok projektu je v minulosti.*

**Zmena začiatku projektu v info o projekte je niečo iné.** Ak zmeníte dátum začiatku v *Nastavenia › Projekt › Info o projekte* a zvolíte *Použiť*, plán sa nepresunie. Posunú sa len úlohy bez predchádzajúcej úlohy alebo obmedzenia, ktoré by inak ležali pred novým začiatkom, na tento dátum. Aplikácia vám oznámi, koľko ich je. Ak chcete posunúť všetko, použite *Presunúť projekt…*.

## Pozri aj

- [Kritická cesta a časová rezerva](docs://uitleg-kritiek-pad): ako plán vypočítava a prečo sa dokončenie posúva.
- [Pridávanie závislostí](docs://howto-relaties-leggen): závislosti pri presune jednoducho zostanú na mieste.
- [Nový projekt a info o projekte](docs://ref-projectinfo): čo robí dátum začiatku v info o projekte.
