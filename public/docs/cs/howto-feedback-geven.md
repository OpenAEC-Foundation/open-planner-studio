# Odeslání zpětné vazby

Cíl: nahlásit chybu nebo předat nápad, volitelně se snímkem obrazovky, aby skončil jako issue na GitHubu.

## Kdy to potřebujete

Plán vypočítá něco, čemu nerozumíte, tlačítko nedělá to, co má, nebo v aplikaci něco postrádáte. Dobré hlášení pomůže tvůrcům najít problém. Proto aplikace do vašeho hlášení sama vloží verzi, operační systém a jazyk. To, co sami popíšete, rozhodne, zda s tím mohou něco udělat: co jste dělali, co jste očekávali a co se stalo.

## Kroky

1. Klikněte na tlačítko *Zpětná vazba* nahoře v okně. Toto tlačítko je vždy v záhlaví okna. Jeho text se každých deset minut mění: *Zpětná vazba*, *Nahlásit chybu* a *Přidat novou funkci*. Je to vždy stejné tlačítko. Otevře se okno *Zpětná vazba*.
2. Zvolte *Chyba* pro něco, co nefunguje tak, jak má, nebo *Požadavek na funkci* pro nápad. *Chyba* je ve výchozím nastavení vybrána.
3. Vyplňte *Název*. Bez názvu je tlačítko *Odeslat na GitHub* šedé. Vyplňte také *Popis*, například: který úkol jste změnili, co jste očekávali a co jste viděli.
4. Chcete-li něco ukázat, zapněte *Přiložit snímek obrazovky*. Aplikace pak pořídí snímek aplikace bez tohoto okna. Chvíli nato uvidíte malý náhled. Po kliknutí na tlačítko *Anotovat* se otevře editor, v němž na obrázek přidáte šipky, obdélníky, volné čáry a text. Tam zvolíte barvu, poslední akci vrátíte tlačítkem *Vrátit zpět* nebo začnete znovu tlačítkem *Vymazat vše*. Až budete spokojeni, klikněte na *Hotovo*.
5. Klikněte na *Odeslat na GitHub*.
6. Nepřiložili jste snímek obrazovky? Pak se ve vašem prohlížeči hned otevře stránka GitHubu, na které vytvoříte nový issue. Pokračujte krokem 8.
7. Přiložili jste snímek obrazovky? Pak nejdřív uvidíte okno *Téměř hotovo — váš snímek obrazovky je ve schránce.* se čtyřmi kroky. Klikněte na *OK, přejít na GitHub*, klikněte do velkého textového pole na stránce issue a stiskněte Ctrl+V (na Macu Cmd+V). Obrázek se nahraje a objeví se v textu.
8. Dole na stránce issue klikněte na *Odeslat nový issue*. Teprve potom se vaše hlášení odešle. Pokud ještě nejste přihlášeni, přihlaste se na GitHub.

Na stránce issue jsou váš název a popis už vyplněné. Aplikace navrhne štítek *bug* nebo *enhancement* a pod váš popis vloží řádek s typem, verzí Open Planner Studio, vaším operačním systémem a jazykem aplikace.

## Úskalí a co aplikace potom udělá

**Aplikace sama od sebe nic neodešle.** *Odeslat na GitHub* jen otevře stránku issue, předvyplněnou. Když tu stránku zavřete, aniž byste klikli na *Odeslat nový issue*, nic se nenahlásí. K tomu potřebujete účet na GitHubu.

**Vaše hlášení skončí na GitHubu.** Nedávejte do něj nic, co nechcete sdílet. Totéž platí pro snímek obrazovky: obrázek ukazuje všechno, co je v tu chvíli v aplikaci vidět, například názvy úkolů a zdrojů vašeho projektu. Aplikace pořídí snímek ve chvíli, kdy zapnete *Přiložit snímek obrazovky*. Než to uděláte, ujistěte se, že je obrazovka v pořádku, a vynechte to, co nechcete ukázat.

**Vkládání nefunguje.** Snímek se uloží také jako soubor na vašem počítači. V desktopové aplikaci okno zobrazí cestu: *Nejde vložit? Snímek jsme také uložili do* této cesty *— přetáhněte ten soubor do textového pole.* V prohlížeči aplikace stáhne obrázek jako `feedback-` s číslem a příponou `.png`. Najdete ho ve složce pro stahování a přetáhnete ho do textového pole.

**Snímek obrazovky selže.** Zobrazí se hlášení *Pořízení snímku obrazovky se nezdařilo. Zpětnou vazbu můžete odeslat i bez snímku.* Zaškrtávací políčko se odznačí a hlášení můžete odeslat i bez obrázku.

**Hodně jste napsali a omylem klikli vedle okna.** Okno se tím nezavře, takže váš text zůstane. Klávesa Esc nebo tlačítko *Zrušit* okno zavře a váš text se pak ztratí.

## Viz také

- [Aktualizace aplikace](docs://howto-app-bijwerken): před hlášením zkontrolujte, zda máte nejnovější verzi.
