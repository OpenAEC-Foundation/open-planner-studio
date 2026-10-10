# Aktualizace aplikace

Cíl: zjistit, zda máte nejnovější verzi, aktualizovat aplikaci a přečíst, co je nového v dané verzi.

## Kdy to potřebujete

Nová verze Open Planner Studio vychází pravidelně. Chcete vědět, zda ji už máte, například před nahlášením chyby nebo proto, že rozšíření vyžaduje novější verzi. Nebo jste právě aktualizovali a chcete vidět, co se změnilo.

Aktualizace funguje jen v desktopové aplikaci. Webová verze nemá aktualizační nástroj.

## Kroky

### Aktualizace, když aplikace sama hlásí novou verzi

1. Spusťte desktopovou aplikaci. Při spuštění aplikace na pozadí zkontroluje, zda je k dispozici nová verze. Pokud žádná nová verze není, nebo kontrola selže, například bez připojení k internetu, nic nepoznáte.
2. Je-li k dispozici nová verze, otevře se okno *Aktualizace softwaru*. Zobrazí se *Aktuální verze*, *Nová verze*, zpráva *Je k dispozici nová verze* a pod položkou *Co je nového* text, který k aktualizaci patří.
3. Uložte otevřené projekty.
4. Klikněte na *Stáhnout a nainstalovat*. Ukazatel průběhu zobrazí *Stahování…* a poté následuje instalace. Okno nelze zavřít, dokud se stahuje.
5. Počkejte, dokud se aplikace sama restartuje. Tím máte novou verzi.

Těsně před instalací aktualizace aplikace také vytvoří snímek pro obnovení vašich otevřených projektů (pro zotavení systému po chybě), viz [Zotavení systému po chybě](docs://howto-herstellen-na-een-crash).

### Ruční kontrola nové verze

1. Zvolte *Nastavení › Projekt › Nastavení*. Můžete také zvolit *Soubor › Nastavení*, nebo ozubené kolo nahoře.
2. Zvolte kartu *Pokročilé*. Pod položkou *Verze* je číslo vaší aktuální verze.
3. Klikněte na *Zkontrolovat aktualizace*. Otevře se okno *Aktualizace softwaru* a zobrazí *Kontrola…*. Poté se zobrazí *Používáte nejnovější verzi*, nebo zpráva, že je k dispozici nová verze, se stejným tlačítkem *Stáhnout a nainstalovat*.

Ve webové verzi tlačítko nic zvláštního neudělá: okno ihned zobrazí *Používáte nejnovější verzi*, aniž by aplikace cokoli kontrolovala.

### Přečtení novinek

1. Pokud aplikaci poprvé spustíte v jiné verzi než naposledy, nebo po čerstvé instalaci, otevře se okno samo. Okno má nadpis *Máte nejnovější verzi!*.
2. Nahoře je přechod z předchozí verze na novou. Po čerstvé instalaci se zobrazí jen nová verze.
3. Pokud má aplikace pro tuto verzi zabudovaný souhrn, uvidíte jeden hlavní bod a čtyři menší body. U hlavního bodu může být tlačítko *Přečíst příručku*. Jinak uvidíte jen přechod mezi verzemi a obsah pod ním.
4. Pomocí *Úplné poznámky k vydání* otevřete seznam změn na GitHubu. Pokud to nefunguje, zobrazí se *Poznámky k vydání se nepodařilo otevřít*.
5. Pod položkou *Tato aktualizace v číslech* je počet dní od předchozího vydání, počet commitů a počet přidaných řádků kódu. Pokud aplikace dokáže zjistit rozdíl ve velikosti instalačního balíčku, zobrazí se i ten. Každé číslo se zobrazí, jen pokud je k dispozici.
6. Klikněte na *Rozumím*, čímž okno zavřete.

Chcete-li okno později zobrazit znovu, zvolte *Nastavení › Projekt › Nastavení*, kartu *Pokročilé* a pod položkou *Verze* tlačítko *Co je nového*. Okno se pak otevře pro vaši aktuální verzi, bez předchozí verze.

## Časté problémy a co aplikace potom udělá

**Aktualizace selže.** Okno zobrazí *Při aktualizaci se něco pokazilo*, pod tím technický důvod a tlačítko *Zkusit znovu*.

**Aplikaci jste nainstalovali jako balíček .deb a instalace selže.** Okno vysvětlí: *Aktualizujte ručně spuštěním tohoto příkazu v terminálu, nebo stáhněte nejnovější balíček.* Pod položkou *Instalační příkaz* je příkaz s tlačítkem *Kopírovat příkaz* (potom se zobrazí *Zkopírováno*). Tlačítkem *Otevřít stránku ke stažení* přejdete na stránku ke stažení nejnovější verze.

**Aplikaci máte přes Snap Store.** Aplikace se pak sama neaktualizuje a ani při spuštění nekontroluje. To dělá Snap Store. V okně se zobrazí *Tato verze se aktualizuje automaticky přes Snap Store — nemusíte nic dělat.*

**Při spuštění se nic nezobrazí.** To je normální, pokud už máte nejnovější verzi. Kontrola při spuštění nehlásí chyby. Chcete-li mít jistotu, že máte aktuální verzi, zkontrolujte to sami, jak je popsáno výše.

## Viz také

- [Odeslání zpětné vazby](docs://howto-feedback-geven): nahlaste chybu v nejnovější verzi.
