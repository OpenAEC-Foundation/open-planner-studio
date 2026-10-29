# Odeslání zpětné vazby

Cíl: nahlásit chybu nebo předat nápad, volitelně se snímkem obrazovky, přímo z aplikace.

## Kdy to potřebujete

Plán vypočítá něco, čemu nerozumíte, tlačítko nedělá to, co má, nebo v aplikaci něco postrádáte. Dobré hlášení pomůže tvůrcům najít problém. Proto aplikace do vašeho hlášení sama vloží verzi, operační systém a jazyk. To, co sami popíšete, rozhodne, zda s tím mohou něco udělat: co jste dělali, co jste očekávali a co se stalo.

## Postup

1. Klikněte na tlačítko *Zpětná vazba* v horní části okna. Toto tlačítko je vždy v záhlaví okna. Jeho text se mění každých deset minut: *Zpětná vazba*, *Nahlásit chybu* a *Přidat novou funkci*. Je to vždy stejné tlačítko. Otevře se okno *Zpětná vazba*.
2. Zvolte druh hlášení. *Něco nefunguje* slouží pro chybu: něco nedělá to, co má dělat. *Nápad* je pro něco, co postrádáte, nebo co chcete mít jinak. *Dotaz nebo připomínka* je pro všechno ostatní. *Něco nefunguje* je ve výchozím nastavení vybráno.
3. Vyplňte pole *Název* a potom pole *Popis*. Prázdná pole ukazují příklad: u názvu například *Např. Kritická cesta se po uložení posune* a u popisu otázku *Co jste dělali, co jste očekávali a co se stalo?* Dokud je tlačítko *Odeslat* šedé, šedý řádek vedle něj vysvětlí proč, například *Vyplňte název.* nebo že v názvu a popisu dohromady musíte napsat alespoň 10 znaků.
4. Pokud chcete odpověď, vyplňte pole *E-mailová adresa*. Pole je nepovinné. Aplikace si adresu po úspěšném hlášení zapamatuje, takže tam bude i příště.
5. Pokud chcete něco ukázat, zapněte *Přiložit snímek obrazovky*. Aplikace potom pořídí obrázek aplikace bez tohoto okna. Chvíli potom uvidíte malý náhled se třemi tlačítky vedle něj: *Anotovat*, *Pořídit znovu* a *Odebrat*.
6. Tlačítko *Anotovat* otevře editor. V něm kreslíte na obrázek šipky, obdélníky, volné čáry a text. Tlačítkem *Zakrýt* nakreslíte černou plochu přes něco, co nesmí být vidět, například jméno nebo částku. Ta část se potom opravdu nedostane do obrázku, který aplikace odešle. Barvu zvolíte sami. Poslední akci vrátíte tlačítkem *Vrátit zpět*, nebo začnete znovu tlačítkem *Vymazat vše*. Klikněte na *Hotovo*, pokud chcete změny ponechat, nebo na *Zrušit* (nebo na Esc), pokud je chcete zahodit.
7. Tlačítko *Pořídit znovu* vytvoří nový snímek obrazovky a smaže vaše anotace. Tlačítko *Odebrat* odstraní snímek obrazovky a zruší zaškrtnutí políčka.
8. Podívejte se na šedý řádek *Odesláno s údaji* pod formulářem. Ukazuje, co aplikace posílá sama: verzi, operační systém a jazyk, například *Odesláno s údaji: v2026.10.1 · Windows · English*.
9. Klikněte na *Odeslat*. Během odesílání tlačítko ukazuje *Odesílání…*.
10. Zobrazí se *Děkujeme, vaše hlášení bylo odesláno.* Pokud se pro vaše hlášení na GitHubu vytvořil záznam, je tu také tlačítko *Zobrazit na GitHubu*. Klikněte na *Zavřít*.

## Kam hlášení jde

Aplikace odešle vaše hlášení k Open Feedback Studio od OpenAEC. K tomu nepotřebujete účet, ani na GitHubu. Tvůrci vidí vaše hlášení ve svém přehledu. Pokud je aplikace v Open Feedback Studio propojena s GitHubem, Open Feedback Studio z něj také vytvoří veřejný záznam na GitHubu. U hlášení *Něco nefunguje* dostane záznam štítek *bug*, u *Nápad* štítek *enhancement*. Pod vaším popisem je potom řádek s verzí Open Planner Studio, vaším operačním systémem a jazykem aplikace.

## Časté problémy a co aplikace potom udělá

**Vaše hlášení se může stát veřejným.** Nedávejte do něj nic, co nechcete sdílet. Totéž platí pro snímek obrazovky: obrázek ukazuje všechno, co je v tu chvíli v aplikaci vidět, například názvy úkolů a zdrojů vašeho projektu. Aplikace pořídí snímek ve chvíli, kdy zapnete *Přiložit snímek obrazovky*. Pokud obrazovka ještě není v pořádku, zavřete okno, nastavte obrazovku správně, okno znovu otevřete a klikněte na tlačítko *Pořídit znovu*. Pomocí tlačítka *Zakrýt* skryjete, co nechcete ukázat.

**Snímek obrazovky je příliš velký.** Aplikace snímek před odesláním zmenší. Pokud je i potom příliš velký, hlášení se odešle bez obrázku. Děkovací obrazovka potom ukáže *Snímek obrazovky byl příliš velký a nebyl odeslán.*

**Odeslání nefunguje.** V okně se objeví upozornění a váš text zůstane. Existují čtyři případy:

- *Hlášení nebylo přijato.* Zkontrolujte text a e-mailovou adresu. Hlášení, které se skládá hlavně z odkazů, se odmítá.
- *Odeslali jste v krátké době mnoho hlášení.* Zkuste to znovu za hodinu.
- *Odeslání se nezdařilo.* Není připojení, nebo server neodpovídá. Zkuste to znovu, nebo klikněte na *Otevřít na GitHubu*. Toto tlačítko tam není, pokud byl předchozí pokus nejistý (viz níže).
- *Nejsme si jisti, zda vaše hlášení dorazilo. Počkejte minutu a pak ho odešlete znovu. Pokud už tam je, uvidíme to automaticky.* Spojení se přerušilo poté, co aplikace vaše hlášení odeslala. Váš text zůstane. Tlačítko *Otevřít na GitHubu* tam není, protože vaše hlášení ještě může dorazit. Tak tomu zůstane, dokud se vaše hlášení neodešle nebo se neukáže, že už bylo přijato, i když mezitím okno zavřete a znovu otevřete.

**Hlášení je už přijato.** Pokud odešlete hlášení, které už tam je, zůstane formulář a nad ním se zobrazí: *Toto hlášení už máme. Chcete něco přidat? Pak upravte text a odešlete ho znovu.* Váš text zůstane a vaše e-mailová adresa se zapamatuje. Pokud nechcete nic přidat, klikněte na *Zavřít*. Formulář bude příště prázdný. Pokud napíšete něco dalšího, upozornění zmizí a můžete odeslat znovu. Tlačítko se potom jmenuje zase *Uložit a zavřít* a váš text se zachová.

**Otevřít na GitHubu.** Toto je postup bez Open Feedback Studio. Pro něj potřebujete účet na GitHubu. Bez snímku obrazovky se stránka GitHubu, na které vytvoříte nový záznam, hned otevře ve vašem prohlížeči. Váš název a popis už budou vyplněné. Se snímkem obrazovky nejprve uvidíte *Téměř hotovo — váš snímek obrazovky je ve schránce.* se čtyřmi kroky. Klikněte na *OK, přejít na GitHub*, klikněte do velkého textového pole na stránce záznamu a stiskněte Ctrl+V (na Macu Cmd+V). Potom klikněte dole na *Odeslat nový záznam*. Teprve potom se vaše hlášení odešle.

**Vkládání nefunguje.** Na cestě přes GitHub se snímek obrazovky uloží také jako soubor na vašem počítači. V desktopové aplikaci okno uvede cestu: *Nelze vložit? Snímek obrazovky jsme uložili také do* této cesty *— přetáhněte ten soubor do textového pole.* V prohlížeči aplikace stáhne obrázek jako `feedback-` s číslem a příponou `.png`. Najdete ho ve složce pro stažené soubory a přetáhnete ho do textového pole.

**Snímek obrazovky se nezdařil.** Zobrazí se: *Pořízení snímku obrazovky se nezdařilo. Zpětnou vazbu můžete odeslat i bez snímku.* Zaškrtávací políčko se vypne a hlášení můžete odeslat bez obrázku.

**Okno zavřete před odesláním.** Pokud je ve formuláři něco vyplněno, tlačítko dole se jmenuje *Uložit a zavřít*. U prázdného formuláře se jmenuje *Zavřít*. *Uložit a zavřít*, křížek a Esc okno zavřou. Vaše hlášení se uloží jako koncept, dokud ho neodešlete nebo neklikněte na *Vymazat*. Když okno znovu otevřete, druh, váš text, e-mailová adresa a snímek obrazovky s anotacemi jsou stále tam. Koncept se uchovává, dokud je aplikace otevřena. Po jejím ukončení zmizí. Po úspěšném hlášení je formulář zase prázdný. Chcete-li začít úplně znovu, klikněte vlevo dole na *Vymazat*. Klik vedle okna jej nezavře. Během odesílání Esc okno nezavře.

## Viz také

- [Aktualizace aplikace](docs://howto-app-bijwerken): před hlášením zkontrolujte, zda máte nejnovější verzi.
