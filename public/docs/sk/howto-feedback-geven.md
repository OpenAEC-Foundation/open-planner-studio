# Poskytovanie spätnej väzby

Cieľ: nahlásiť chybu alebo odovzdať nápad, voliteľne so snímkou obrazovky, priamo z aplikácie.

## Kedy to potrebujete

Plán vypočíta niečo, čomu nerozumiete, tlačidlo nerobí to, čo by malo, alebo vám v aplikácii niečo chýba. Dobré hlásenie pomáha tvorcom nájsť problém. Preto aplikácia sama do hlásenia pridá verziu, operačný systém a jazyk. To, čo opíšete vy, rozhoduje o tom, či s tým môžu niečo urobiť: čo ste urobili, čo ste čakali a čo sa stalo.

## Kroky

1. Kliknite na tlačidlo *Poslať spätnú väzbu* v hlavičke okna. Toto tlačidlo je vždy v hlavičke okna. Jeho text sa mení každých desať minút: *Poslať spätnú väzbu*, *Nahlásiť chybu* a *Pridať novú funkciu*. Je to vždy to isté tlačidlo. Otvorí sa okno *Odoslať spätnú väzbu*.
2. Vyberte druh hlásenia. *Niečo nefunguje* je určené pre chybu: niečo nerobí to, čo má robiť. *Nápad* je pre niečo, čo vám chýba alebo čo chcete mať inak. *Otázka alebo pripomienka* je pre ostatné. Ako predvolená je vybratá možnosť *Niečo nefunguje*.
3. Vyplňte *Názov* a potom *Popis*. Prázdne polia ukazujú príklad: pri názve napríklad *Napr. Kritická cesta sa po uložení posunie*, a pri popise otázku *Čo ste urobili, čo ste očakávali a čo sa stalo?* Kým je tlačidlo *Odoslať* sivé, vedľa neho sivý riadok vysvetľuje dôvod, napríklad *Zadajte názov.* alebo to, že v názve a v popise spolu napíšete aspoň 10 znakov.
4. Ak chcete odpoveď, vyplňte pole *E-mailová adresa*. Toto pole je nepovinné. Aplikácia si adresu po úspešnom hlásení zapamätá, takže je tam už pri ďalšom hlásení.
5. Ak chcete niečo ukázať, zapnite *Pripojiť snímku obrazovky*. Aplikácia potom urobí obrázok aplikácie bez tohto okna. Chvíľu nato uvidíte malý náhľad a vedľa neho tri tlačidlá: *Anotovať*, *Znova zachytiť* a *Odstrániť*.
6. *Anotovať* otvorí editor. V ňom na obrázok kreslíte šípky, obdĺžniky, voľné čiary a text. Tlačidlom *Zakryť* nakreslíte čiernu plochu nad niečím, čo sa nesmie odoslať, napríklad nad menom alebo sumou. Táto časť potom naozaj zmizne z obrázka, ktorý aplikácia odošle. Farbu si vyberiete. Posledný krok zrušíte tlačidlom *Vrátiť späť* alebo začnete odznova tlačidlom *Vymazať všetko*. Kliknite na *Dokončiť*, ak chcete zachovať zmeny, alebo na *Zrušiť* (alebo Esc), ak ich chcete zahodiť.
7. Tlačidlo *Znova zachytiť* urobí novú snímku a vymaže vaše anotácie. Tlačidlo *Odstrániť* odstráni snímku a vypne začiarkavacie políčko.
8. Pozrite sa na sivý riadok *Priložené* pod formulárom. Zobrazuje, čo aplikácia odošle sama: verziu, operačný systém a jazyk, napríklad *Priložené: v2026.10.1 · Windows · English*.
9. Kliknite na *Odoslať*. Počas odosielania tlačidlo ukazuje *Odosiela sa…*.
10. Uvidíte *Ďakujeme, vaše hlásenie bolo odoslané.* Ak sa pre vaše hlásenie vytvoril záznam na GitHube, je tam aj tlačidlo *Zobraziť na GitHube*. Kliknite na *Zavrieť*.

## Kam sa vaše hlásenie odošle

Aplikácia odošle vaše hlásenie do Open Feedback Studio od OpenAEC. Na to nepotrebujete účet, a to ani na GitHube. Tvorcovia vidia vaše hlásenie vo svojom prehľade. Ak je aplikácia tam prepojená s GitHubom, Open Feedback Studio z neho tiež vytvorí verejný záznam na GitHube. Pri *Niečo nefunguje* dostane záznam štítok *bug*, pri *Nápad* štítok *enhancement*. Pod vaším popisom je potom riadok s verziou Open Planner Studio, vaším operačným systémom a jazykom aplikácie.

## Problémy a čo aplikácia vtedy urobí

**Vaše hlásenie môže byť verejné.** Nedávajte doň nič, čo nechcete zdieľať. To platí aj pre snímku obrazovky: obrázok ukazuje všetko, čo je v tom momente v aplikácii viditeľné, napríklad názvy úloh a zdroje vášho projektu. Aplikácia urobí snímku vo chvíli, keď zapnete *Pripojiť snímku obrazovky*. Ak obrazovka ešte nie je správna, zatvorte okno, nastavte obrazovku, znova otvorte okno a kliknite na *Znova zachytiť*. Na skrytie toho, čo nechcete ukázať, použite tlačidlo *Zakryť*.

**Snímka obrazovky je príliš veľká.** Aplikácia pred odoslaním snímku zmenší. Ak je aj potom príliš veľká, hlásenie sa odošle bez obrázka. Obrazovka s poďakovaním potom ukáže: *Snímka obrazovky bola príliš veľká a nebola priložená.*

**Odoslanie nefunguje.** V okne sa zobrazí oznam a váš text zostane. Sú štyri prípady:

- *Hlásenie nebolo prijaté.* Skontrolujte text a e-mailovú adresu. Hlásenie, ktoré obsahuje hlavne odkazy, sa odmietne.
- *Odoslali ste veľa hlásení za krátky čas.* Skúste to znova o hodinu.
- *Odoslanie zlyhalo.* Chýba pripojenie alebo server neodpovedá. Skúste to znova alebo kliknite na *Otvoriť na GitHube*. Toto tlačidlo sa nezobrazí, ak bol predchádzajúci pokus neistý (pozri nižšie).
- *Nie sme si istí, či sa vaše hlásenie doručilo. Počkajte minútu a potom ho odošlite znova; ak už tam je, zistíme to automaticky.* Spojenie sa prerušilo po tom, čo aplikácia hlásenie odoslala. Váš text zostane. Tlačidlo *Otvoriť na GitHube* tu nie je, lebo vaše hlásenie ešte môže prísť. Tak to zostane, kým sa hlásenie neodošle alebo kým ho nemáme prijaté, aj keď okno medzitým zatvoríte a znova otvoríte.

**Vaše hlásenie je už prijaté.** Ak odošlete hlásenie, ktoré je už prijaté, nad formulárom zostane toto: *Toto hlásenie už máme. Chcete niečo doplniť? Potom upravte text a odošlite ho znova.* Váš text zostane a vaša e-mailová adresa sa zapamätá. Ak nechcete nič doplniť, kliknite na *Zavrieť*; formulár bude pri ďalšom otvorení prázdny. Ak napíšete niečo viac, oznam zmizne a môžete odoslať znova; tlačidlo sa potom volá znova *Uložiť a zavrieť* a váš text sa zachová.

**Otvoriť na GitHube.** Toto je cesta bez Open Feedback Studio. Na to potrebujete účet na GitHube. Bez snímky obrazovky sa stránka GitHubu, na ktorej vytvoríte nový záznam, otvorí hneď vo vašom prehliadači, s vaším názvom a popisom už vyplnenými. So snímkou najprv uvidíte *Takmer hotovo — vaša snímka obrazovky je v schránke.* Potom nasledujú štyri kroky. Kliknite na *OK, prejsť na GitHub*, kliknite do veľkého textového poľa stránky záznamu a stlačte Ctrl+V (Cmd+V na Macu). Potom dole kliknite na *Odoslať nový záznam*. Až potom sa vaše hlásenie odošle.

**Vkladanie nefunguje.** Pri odoslaní cez GitHub sa snímka obrazovky uloží aj ako súbor na vašom počítači. V desktopovej aplikácii okno uvádza cestu: *Nedá sa vložiť? Snímku sme uložili aj do* tej cesty *— presuňte tento súbor do textového poľa.* V prehliadači aplikácia stiahne obrázok ako `feedback-` s číslom a príponou `.png`. Nájdete ho v priečinku na stiahnuté súbory a presuňte ho do textového poľa.

**Snímka obrazovky zlyhala.** Zobrazí sa: *Vytvorenie snímky obrazovky zlyhalo. Spätnú väzbu môžete odoslať aj bez snímky.* Začiarkavacie políčko sa vypne a hlásenie môžete odoslať bez obrázka.

**Zavriete okno pred odoslaním.** Ak je vo formulári niečo, tlačidlo dole sa volá *Uložiť a zavrieť*; pri prázdnom formulári sa volá *Zavrieť*. Tlačidlo *Uložiť a zavrieť*, krížik a klávesa Esc zatvoria okno. Vaše hlásenie sa zachová ako koncept, kým ho neodošlete alebo kým nekliknete na *Vymazať*. Pri ďalšom otvorení okna zostanú druh, váš text, e-mailová adresa a snímka obrazovky s anotáciami. Koncept sa zachová, kým je aplikácia otvorená; po jej ukončení je preč. Po úspešnom hlásení je formulár znova prázdny. Ak chcete začať odznova sami, kliknite dole vľavo na *Vymazať*. Kliknutie vedľa okna ho nezavrie. Kým sa odosiela, Esc okno nezatvorí.

## Pozri tiež

- [Aktualizácia aplikácie](docs://howto-app-bijwerken): pred hlásením skontrolujte, či máte najnovšiu verziu.
