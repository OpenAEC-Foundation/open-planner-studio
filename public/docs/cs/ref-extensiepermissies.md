# Oprávnění rozšíření

Každé oprávnění, které může rozšíření uvést ve svém manifestu: co povoluje, co se stane, když chybí, a co z něj uvidíte při instalaci rozšíření. Jak rozšíření spravujete a instalujete, je popsáno v [Instalace a správa rozšíření](docs://howto-extensie-installeren).

## Co je a co není oprávnění

Oprávnění je **prohlášení autora**: které části rozhraní aplikace chce rozšíření používat. Není to bariéra. Kód rozšíření běží ve stejném prostředí jako sama aplikace. Proto může dělat víc, než jeho oprávnění říkají. Sandbox tu není. Aplikace to říká i v okně instalace. Instalujte jen rozšíření od autorů, kterým důvěřujete.

Aplikace vynucuje oprávnění jedním ze tří způsobů. Rozdíl je důležitý:

**Pevně vynuceno.** Když oprávnění chybí, odpovídající metoda vyhodí chybu (v nizozemštině například *Extensie „…“ mist permissie: ribbon*), dřív než se cokoli stane.

**Varování.** Když oprávnění chybí, metoda přesto funguje. Aplikace ale zapíše varování do protokolu. V budoucí verzi se z něj stane odmítnutí.

**Pouze informativní.** K oprávnění nepatří žádná část rozhraní. Aplikace ho ukáže při instalaci a jinak s ním nic nedělá.

Co nepotřebuje žádné oprávnění, je základ rozhraní rozšíření: číst projekt, kalendář, úkoly, závislosti, zdroje a přiřazení; přidávat úkoly a závislosti a měnit úkoly; načíst projekt, provést přepočítání a seskupit několik změn do jednoho kroku; ukládat vlastní nastavení, číst vlastní přiložené soubory a zobrazit oznámení.

**Manifest.** Oprávnění jsou v manifestu jako seznam. Rozšíření, které nyní instalujete s oprávněním, jež tato verze aplikace nezná, se odmítne. U už uloženého staršího rozšíření aplikace neznámá oprávnění vynechá a zapíše to do protokolu.

## Jak se aplikace ptá

Při instalaci z katalogu (na kartě *Soubor › Rozšíření › Procházet › Instalovat*) nebo ze souboru (*ZIP* nebo *JS*) zobrazí aplikace okno *Nainstalovat rozšíření?*. Otázka přijde jednou, při instalaci. Ne pokaždé, když rozšíření zapnete.

Okno ukazuje název, verzi, popis, autora a případně repozitář. Pod nadpisem *Původ* je uvedeno, odkud rozšíření pochází (*Z online katalogu rozšíření*, *Ze souboru ZIP na tomto počítači* nebo *Ze souboru JavaScript na tomto počítači*). Také je uvedeno, zda je stažení ověřeno: kontrolním součtem z katalogu, jako neověřeno, protože katalog žádný součet nedává, nebo jako soubor, který jste vybrali sami. Pod nadpisem *S čím souhlasíte* je uvedeno, že rozšíření je programový kód. Běží se stejnými právy jako aplikace. V praxi to znamená: v desktopové aplikaci mimo jiné čtení a zápis souborů kdekoli ve vaší uživatelské složce a přístup k vašim projektům, nastavení a schránce. V prohlížeči přístup k uloženým projektům a nastavení, k souborům, ke kterým jste udělili přístup, a k síti.

Pod nadpisem *Co toto rozšíření údajně používá* jsou oprávnění z manifestu jako krátké popisky, s názvem jako níže. Říká: *Toto je údaj autora, nikoli omezení — kód může stejně dělat víc.* Nemá-li rozšíření žádná oprávnění, zobrazí se *Nic nebylo uvedeno.* Dvě oprávnění mají vysvětlení: *importSource* a *help*. Zbylých šest dostane jen svůj název.

Tlačítkem *Instalovat* souhlasíte. Tlačítko *Neinstalovat*, klávesa Esc a klik mimo okno instalaci odmítnou.

## Oprávnění

**ribbon** — umístit tlačítko do pásu karet. Účinek: rozšíření smí přidat tlačítko do skupiny na záložce pásu karet. Rozšíření bez tohoto oprávnění při pokusu dostane chybu. Tlačítka se objeví na konci zvolené záložky, pod názvem skupiny rozšíření. Zmizí, když rozšíření vypnete nebo odeberete. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pevné. Kde: na záložce, kterou rozšíření zvolilo.

**events** — sledovat události aplikace a posílat vlastní události. Účinek: rozšíření se smí přihlašovat k událostem a odhlašovat se od nich a smí posílat události samo. Aplikace sama posílá tři události: načtení projektu (po importu, otevření nebo načtení rozšířením), vytvoření prázdného projektu a přepočítání plánu. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pevné. Kde: nikde; rozšíření na událost reaguje.

**backstage** — nabídnout formát importu. Účinek: rozšíření smí zaregistrovat importér. Ten se objeví na kartě *Soubor › Importovat*, kde kliknete na formát a vyberete soubor. Vestavěné formáty jsou od toho odděleny (viz [Formáty importu a exportu](docs://ref-import-exportformaten)). Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: varování. Když oprávnění chybí, registrace přesto funguje, s varováním v protokolu. Je to přechodné opatření, protože stávající rozšíření oprávnění ne vždy uvádějí. Kde: na kartě *Soubor › Importovat*.

**pdf-fonts** — dodat písmo pro export do PDF. Účinek: rozšíření smí zaregistrovat poskytovatele písem. Export do PDF ho použije pro znaky, které vestavěná písma nepokrývají, například čínské, japonské a korejské znaky. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pevné. Kde: v PDF exportovaném ze sestavy. V okně instalace je jen jeho název.

**importSource** — číst původní bajty importovaného souboru. Účinek: rozšíření smí požádat o úplný obsah zdrojového souboru importovaného projektu (zatím: soubor Primavera). Patří sem i pole, která aplikace do vašeho projektu záměrně nepřebírá, například auditní a provenienční pole, náklady, pole kontroly a pole umístění. To je mnohem širší než zbytek rozhraní, proto je to samostatné oprávnění. Bez tohoto oprávnění aplikace nepřečte ani jediný bajt zdrojového souboru. Každá metoda pak vyhodí chybu dřív, než se cokoli načte. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pevné, ve výchozím stavu zamítnuto. Kde: v okně instalace se k němu přidá vysvětlení: *importSource — úplné původní zdrojové bajty každého importovaného souboru (například nezpracovaný soubor Primavera), včetně polí, která se do projektu nedostanou.*

**help** — přidávat články nápovědy a průvodce. Účinek: rozšíření smí zaregistrovat a odebrat články nápovědy (kurzy), otevřít přiložený soubor `.ifc` jako nový dokument a spustit a zastavit průvodce, který ukazuje na části aplikace. Přiložený projekt nikdy nepřepíše dokument, se kterým pracujete. Otevře se jako nový dokument, nebo jen převezme prázdnou, nezměněnou záložku. Od verze kontraktu 1.4.0. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pevné. Kde: v okně *Nápověda* (články), jako nová záložka (projekt) a jako průvodce, který ukazuje na tlačítka. V okně instalace se k němu přidá vysvětlení: *help — smí přidávat články nápovědy, otevírat přiložené projekty jako nový dokument a zobrazovat průvodce, který ukazuje na části aplikace.*

**filesystem** — rozšíření uvádí, že používá soubory. Účinek: žádný. K ničemu v rozhraní se to nevztahuje a aplikace to nemůže vynutit. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pouze informativní. Kde: jako název v okně instalace.

**network** — rozšíření uvádí, že používá síť. Účinek: žádný; jako u *filesystem*. Výchozí: neuděleno; jen to, co je v manifestu. Vynucení: pouze informativní. Kde: jako název v okně instalace.

## Viz také

- [Formáty importu a exportu](docs://ref-import-exportformaten): formáty, které aplikace zná sama, vedle toho, co rozšíření přidávají na kartě *Soubor › Importovat*.
- [Instalace a správa rozšíření](docs://howto-extensie-installeren): instalace, vypnutí a odebrání rozšíření.
