# Poskytovanie spätnej väzby

Cieľ: nahlásiť chybu alebo odovzdať nápad, voliteľne so snímkou obrazovky, aby skončil ako issue na GitHube.

## Kedy to potrebujete

Plán vypočíta niečo, čomu nerozumiete, tlačidlo nerobí to, čo by malo, alebo v aplikácii niečo prehliadnete. Dobré hlásenie pomáha tvorcom nájsť problém. Preto aplikácia sama do hlásenia pridá verziu, operačný systém a jazyk. To, čo opíšete vy, rozhoduje o tom, či s tým môžu niečo urobiť: čo ste urobili, čo ste čakali a čo sa stalo.

## Kroky

1. Kliknite na tlačidlo *Poslať spätnú väzbu* v hornej časti okna. Toto tlačidlo je vždy v titulnom riadku. Jeho text sa mení každých desať minút: *Poslať spätnú väzbu*, *Nahlásiť chybu* a *Pridať novú funkciu*. Je to stále to isté tlačidlo. Otvorí sa okno *Odoslať spätnú väzbu*.
2. Vyberte *Chyba* pri niečom, čo nefunguje tak, ako má, alebo *Požiadavka na funkciu* pri nápade. *Chyba* je vybraná ako predvolená možnosť.
3. Vyplňte *Názov*. Bez názvu je tlačidlo *Odoslať na GitHub* sivé. Vyplňte aj *Popis*, napríklad: ktorú úlohu ste zmenili, čo ste čakali a čo ste videli.
4. Ak chcete niečo ukázať, zapnite *Pripojiť snímku obrazovky*. Aplikácia potom vytvorí obrázok aplikácie bez tohto okna. O chvíľu uvidíte malý náhľad. Tlačidlom *Anotovať* sa otvorí editor, v ktorom na obrázok pridáte šípky, obdĺžniky, voľné čiary a text. Tam vyberiete farbu, vrátite svoju poslednú akciu pomocou *Vrátiť späť* alebo začnete od začiatku pomocou *Vymazať všetko*. Keď ste spokojní, kliknite na *Dokončiť*.
5. Kliknite na *Odoslať na GitHub*.
6. Nepripojili ste snímku obrazovky? Potom sa vo vašom prehliadači hneď otvorí stránka GitHubu, na ktorej vytvoríte nový issue. Pokračujte krokom 8.
7. Pripojili ste snímku obrazovky? Potom najprv uvidíte *Takmer hotovo — vaša snímka obrazovky je v schránke.* so štyrmi krokmi. Kliknite na *OK, prejsť na GitHub*, kliknite do veľkého textového poľa na stránke issue a stlačte Ctrl+V (na Macu Cmd+V). Obrázok sa nahrá a objaví sa v texte.
8. Na konci stránky issue kliknite na *Odoslať nový issue*. Až potom sa vaše hlásenie odošle. Ak ešte nie ste prihlásení, prihláste sa na GitHub.

Na stránke issue sú váš názov a popis už vyplnené. Aplikácia navrhne štítok *bug* alebo *enhancement* a pod váš popis pridá riadok s typom, verziou aplikácie Open Planner Studio, vaším operačným systémom a jazykom aplikácie.

## Úskalia a čo vtedy aplikácia urobí

**Aplikácia nič neodošle sama.** Tlačidlo *Odoslať na GitHub* len otvorí stránku issue, vyplnenú. Ak túto stránku zavriete bez kliknutia na *Odoslať nový issue*, potom nebolo nič nahlásené. Na to potrebujete účet na GitHube.

**Vaše hlásenie skončí na GitHube.** Nedávajte do neho nič, čo nechcete zdieľať. To platí aj pre snímku obrazovky: obrázok ukazuje všetko, čo je v tom okamihu v aplikácii vidieť, napríklad názvy úloh a zdrojov vášho projektu. Aplikácia urobí snímku v okamihu, keď zapnete *Pripojiť snímku obrazovky*. Skontrolujte preto, že obrazovka je správna, než to urobíte, a vynechajte to, čo nechcete ukázať.

**Vkladanie nefunguje.** Snímka obrazovky sa uloží aj ako súbor na vašom počítači. V desktopovej aplikácii okno uvádza cestu: *Nemôžete vložiť? Snímku obrazovky sme uložili aj na* túto cestu *— presuňte tento súbor do textového poľa.* V prehliadači aplikácia stiahne obrázok ako `feedback-` s číslom a príponou `.png`. Nájdete ho v priečinku so stiahnutými súbormi a presuňte ho do textového poľa.

**Snímka obrazovky zlyhá.** Zobrazí sa *Vytvorenie snímky obrazovky zlyhalo. Spätnú väzbu môžete odoslať aj bez snímky.* Zaškrtávacie políčko sa vypne a hlásenie môžete odoslať bez obrázka.

**Veľa ste napísali a omylom kliknete vedľa okna.** Okno sa tým nezatvorí, takže váš text zostane. Esc alebo *Zrušiť* okno zatvorí a potom sa váš text stratí.

## Pozri tiež

- [Aktualizácia aplikácie](docs://howto-app-bijwerken): pred hlásením skontrolujte, či máte najnovšiu verziu.
