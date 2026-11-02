# Ondertekening van installers en pakketten — onderzoek en plan voor #726

Onderzocht op 2 november 2026, naar aanleiding van het besluit om de gebruikersissues nu op te pakken.
Dit is een voorstel voor Ethan en de organisatiebeheerder. Het activeert geen nieuwe publicatiepoort en
wijzigt geen signingworkflow, app, apptekst of IFC-formaat.

## Uitgangspunt en bewijsgrenzen

- Werkbranch: `chore/726-installers-ondertekenen`, in de eigen T3-worktree met die naam.
- `git fetch origin` gevolgd door `git log -1` bevestigde als uitgangspunt de nieuwste `origin/main`:
  `1f0de72fe8924878a2be405e91dc22910789cf07`. Er was geen merge nodig.
- [Issue #726](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/726) en de volledige
  [comment van JanAdriaan891](https://github.com/OpenAEC-Foundation/open-planner-studio/issues/726#issuecomment-6497812451)
  zijn gelezen. De audit van 29 oktober en de aanvulling daarna zijn afzonderlijke bronnen.
- De nieuwste gepubliceerde release is
  [v2026.44.0](https://github.com/OpenAEC-Foundation/open-planner-studio/releases/tag/v2026.44.0),
  gepubliceerd op 31 oktober. De assetnamen en de conclusies van bestaande workflowruns zijn live opgehaald.
- Er zijn geen installers, sleutels of certificaten gedownload of geopend en geen signingstappen gestart.
  Secretmetadata is uitsluitend op naam opgevraagd. De cryptografische controles hieronder zijn dus
  bewijs uit de bestaande audit en CI, geen nieuwe lokale verificatie van de downloadbytes.

De [releaseworkflow op het onderzochte main](https://github.com/OpenAEC-Foundation/open-planner-studio/blob/1f0de72fe8924878a2be405e91dc22910789cf07/.github/workflows/release.yml)
is vergeleken met die van de releasecommit `20fa91af5205e86bcde72a42d40d723f9d2d75d9`.
De signingstappen zijn gelijk; onder meer de algemene CI-poort en de AppImage-invoermodulecontrole zijn
sinds de tag aangepast. Het groene releasebewijs hieronder hoort bij de tagcommit, niet bij een nieuwe
installerbuild vanaf het huidige main.

## Wat is nu ondertekend?

### Gepubliceerde bestanden uit de audit

| Platform / bestanden | v2026.43.0 en v2026.10.0 | Betekenis en grens van het bewijs |
| --- | --- | --- |
| Windows `*_x64-setup.exe` | Geldige platformhandtekening volgens de audit | Authenticode op de aangeboden installer; dit auditoordeel bewijst op zichzelf niet iedere ingebouwde DLL of uninstaller. |
| macOS `*_universal.dmg` | Geldige Apple Developer ID-handtekening volgens de audit | Het auditoordeel over de DMG is afzonderlijk van de controle van app, notarisatie en updaterarchief. |
| Linux `.deb`, `.rpm`, `.AppImage` | Cryptografisch geldige Tauri-updaterhandtekening volgens de audit | Minisign over het bestand. Dat is geen ingebedde DEB/RPM-handtekening en geen bewijs van een OpenPGP-handtekening. |
| Losse Linux `.snap` | De comment meldt later gepubliceerde, geldige `.snap.asc`-handtekeningen | De assetlijsten bevatten voor beide tags inderdaad `.snap.asc` en `openaec-signing-public-key.asc`. Die aanwezigheid is hier opnieuw vastgesteld; de geldigheid komt uit de comment. |
| Snap Store | Winkelassertions vielen buiten de bestandsaudit | Een losse `.asc` en een Store-assertion zijn verschillende controles. |

De fingerprint in het issue en de comment is `13F6D414ADEE4ED4CD09AC60601D86C93C504D29`.
Dit is alleen overgenomen identificatiemetadata. De bijbehorende sleutel is niet opgehaald of gelezen.

### Nieuwste release v2026.44.0 en de reguliere workflow

De [release-run 41190896052](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/41190896052)
op `20fa91af5205e86bcde72a42d40d723f9d2d75d9` heeft conclusie `success`. De stapconclusies voor
Authenticode, macOS-verificatie en de draftcontrole zijn afzonderlijk gecontroleerd. De latere
[verificatierun 41197872768](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/41197872768)
op dezelfde SHA heeft eveneens conclusie `success`, met geslaagde Windows-, macOS-, Ubuntu- en Fedora-jobs.
De logs met certificaatinformatie zijn niet geopend.

| Onderdeel | Huidig bewijs | Wat nog ontbreekt of niet bewezen is |
| --- | --- | --- |
| Windows installer, geïnstalleerde `open-planner-studio.exe`, uninstaller | Vóór publicatie verplicht de workflow `Get-AuthenticodeSignature`: `Valid`, een tijdstempel en `signtool verify /pa /v` met exit 0. Die stap slaagde in de release-run. | De code toetst niet aan een afgesproken uitgever. Geen volledige inventaris en verificatie van eigen EXE/DLL in de geïnstalleerde boom. Geen MSI-asset aangeboden in deze release. |
| macOS universal DMG en de app daaruit | Developer ID-signing, app- en DMG-notarisatie/stapling; vóór publicatie controle met `codesign`, Gatekeeper en `stapler`. De gecontroleerde DMG wordt opnieuw geüpload en op gelijke SHA256 gecontroleerd. De betreffende stappen slaagden. | De verifier vergelijkt niet met een vooraf afgesproken Team ID/bundle-identiteit. De updaterapp wordt niet langs dezelfde native controle geleid. |
| Linux `.deb`, `.rpm`, `.AppImage` | Elk heeft een `.sig`-asset. De cryptografische updatercontrole vóór publicatie slaagde. | Geen `.asc`-assets, `SHA256SUMS`, `SHA256SUMS.asc` of publieke-sleutelasset in deze release. De workflow tekent deze pakketten niet met OpenPGP. Native DEB/RPM-signing is niet ingericht; de binaries zijn hier niet opnieuw onderzocht. |
| Losse `.snap` op GitHub | Asset aanwezig, zonder `.snap.asc`. `snap.yml` bouwt en uploadt hem nadat de hoofdrelease gepubliceerd is. | Geen OpenPGP-signing of cryptografische signingpoort voor deze upload. De hoofdreleasepoort kan een later toegevoegde asset niet beoordelen. |
| Snap Store | Er bestaat een publicatiestap met `SNAPCRAFT_STORE_CREDENTIALS`. | Geen controle van de Store-assertion/revisie in de onderzochte releaseverificatie. De huidige Store-revisie is niet opgehaald. |
| Updater Windows | `setup.exe.sig` en `.nsis.zip.sig`; ZIP bevat de getekende installer. De workflow maakt de ZIP en beide signatures opnieuw vóór de laatste controle. | De laatste draftcontrole verifieert minisign, maar controleert Authenticode niet opnieuw op de teruggedownloade installer/ZIP. |
| Updater macOS | `Open.Planner.Studio_universal.app.tar.gz` met `.sig`, gedekt door de cryptografische draftcontrole. | De native controle van de app uit de DMG bewijst niet dezelfde controle voor de app uit dit archief. Alleen aanwezigheid van `CodeResources` is daar informatief. |
| Updater Linux | `.AppImage.sig`, `.deb.sig`, `.rpm.sig`, gedekt door de cryptografische draftcontrole. | OpenPGP en native pakketverificatie blijven afzonderlijke eisen. |
| `latest.json` | Verplichte controle van versie, datum/veldtypen, tien platformsleutels, juiste release-URL/assetsoort en gelijke, cryptografisch geldige signatures. | Het manifest zelf heeft geen eigen `.sig`/OpenPGP-handtekening. De updater controleert de payloadsignature; een ondertekend checksumbestand kan daarnaast de gepubliceerde metadata dekken. |
| Claude Desktop `.mcpb` | Asset aanwezig; het manifest wordt gevalideerd. De releaseworkflow vermeldt expliciet dat deze bundel zonder signing wordt gebouwd. | Geen `mcpb sign`. Wel meenemen in een ondertekend checksumoverzicht; een keuze over native MCPB-signing vraagt afzonderlijk onderzoek en akkoord. |

SHA256 tegen de GitHub-API bewijst bytegelijkheid met die API; het is op zichzelf geen uitgevershandtekening.
Ook de aanwezigheid van een `.sig`, `.asc` of `CodeResources` bewijst geen geldige, vertrouwde ondertekening.

### Wat blokkeert publicatie al?

[`release.yml`](../.github/workflows/release.yml) maakt eerst een draft. `publish-release` wacht op
Linux/macOS, Windows en MCPB. Windows en macOS hebben de hierboven genoemde native controles. Daarna
downloadt [`verify-release.mjs --draft-id`](../scripts/verify-release.mjs) de draftassets en verifieert
minisign, `latest.json` en GitHub-digests. Een fout voorkomt `draft: false`.

[`release-verify.yml`](../.github/workflows/release-verify.yml) controleert daarnaast na publicatie op
schone runners. Op een PR draait deze workflow alleen bij passende bestandspaden en in rapportmodus.
Deze controle achteraf is geen vervanging voor een publicatiepoort. DEB-pakkethandtekeningen zijn daar
`INFO`; Fedora draait `rpm -K --nosignature`, dus geen cryptografische RPM-signaturecontrole.
Snap en AUR volgen de hoofdrelease via eigen workflows en staan buiten die laatste draftcontrole.

### Website en aangeboden varianten

De [productpagina](https://open-aec.com/open-planner-studio/) toont bij het downloadblok nog
`Download v2026.10.0`, terwijl het nieuws- en releaseblok `v2026.44.0` toont. De aangeboden varianten zijn
Windows EXE, universal DMG, DEB, RPM, AppImage en Snap Store. De directe bestemmingen moeten bij de
uitvoering opnieuw worden vastgelegd; alleen naar GitHub `latest` kijken is onvoldoende.
De oudere tags uit de audit mogen pas buiten scope vallen zodra geen aangeboden link ze meer gebruikt.
Deze PR wijzigt de website niet.

## Welke OpenAEC-voorzieningen bestaan al?

De [Blueprint-releaseworkflow op fe7c6c8a035a365d1f2944c82699d91267a68d3b](https://github.com/OpenAEC-Foundation/OpenAEC-Blueprint/blob/fe7c6c8a035a365d1f2944c82699d91267a68d3b/.github/workflows/release.yml)
gebruikt dezelfde Azure- en Apple-secretnamen. Voor OpenPGP noemt hij `OPENAEC_GPG_PRIVATE_KEY`,
`OPENAEC_GPG_PASSPHRASE` en de variabele `OPENAEC_GPG_FINGERPRINT`; hij voorziet signing van
`SHA256SUMS` en AppImage en maakt build-attestaties.

Dit is een bruikbaar voorbeeld, geen bewijs dat de credentials hier beschikbaar zijn en geen geschikte
poort om letterlijk over te nemen: Windows-signing heeft er `continue-on-error`, macOS kent ad-hoc-terugval,
en ontbrekende OpenPGP-gegevens slaan signing over. De prereleasekeuze hangt alleen af van Windows/macOS.
Een opmerking dat de organisatie nog geen OpenPGP-sleutel heeft is strijdig met de latere melding in #726;
die opmerking is geen grond om een nieuwe sleutel of licentie aan te maken.

Ook [open-pdf-studio op 0eaa0dc96e21c4f75c7532823908c9dbe187f916](https://github.com/OpenAEC-Foundation/open-pdf-studio/blob/0eaa0dc96e21c4f75c7532823908c9dbe187f916/.github/workflows/release.yml)
heeft Azure-signing tijdens het bundelen en Apple-notarisatie. De onderzochte macOS-route controleert
daar de app, maar geen eigen stapled DMG-ticket. De bestaande Planner-controle behouden heeft dus
voorrang boven blind overnemen uit een andere repository.

### Namen die deze repository al gebruikt

Alleen namen zijn opgevraagd, geen secretwaarden. De inventaris komt uit de workflowverwijzingen en
`gh secret list --repo ... --json name`.

| Doel | Namen in workflows | Zichtbaar als repositorysecret |
| --- | --- | --- |
| Azure Artifact Signing / Authenticode | `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_ENDPOINT`, `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME`, `AZURE_CERTIFICATE_PROFILE_NAME` | Alle zes |
| Apple Developer ID en notarisatie | `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, `APPLE_API_ISSUER`, `APPLE_API_KEY`, `APPLE_API_KEY_CONTENT`, `APPLE_TEAM_ID` | Niet in de repositorylijst; organisatieovererving is niet vastgesteld. De bestaande release-run slaagde wel. |
| Tauri/minisign updater | `TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Beide |
| Snap Store | `SNAPCRAFT_STORE_CREDENTIALS` | Ja; een uploadcredential is geen OpenPGP-signingsleutel. |
| AUR-publicatie | `AUR_SSH_PRIVATE_KEY` | Niet in de repositorylijst; een SSH-credential is geen pakketondertekening. |
| Webdeploy | `DEPLOY_SSH_KEY` | Niet in de repositorylijst; staat los van installer-signing. |
| GitHub-API | `GITHUB_TOKEN` / `github.token` | Automatisch workflowtoken; geen aan te maken signingsecret. |

`OPENAEC_GPG_PRIVATE_KEY`, `OPENAEC_GPG_PASSPHRASE` en `OPENAEC_GPG_FINGERPRINT` worden in de huidige
Planner-workflows niet genoemd. De secret- en variabelenlijsten van de repo bevatten deze namen evenmin.
De omgevingenlijst is leeg. Dit bewijst niet dat organisatiecredentials ontbreken.

De namenlijst van organisatiesecrets gaf **HTTP 403**: org-admin of Actions-secretrechten vereist.
Daarom zijn beschikbaarheid, geselecteerde repositories en toegangsbeleid van de organisatiesecrets
onbekend. Niet proberen te omzeilen; de beheerder moet dit in GitHub bevestigen zonder waarden te delen.

## Uitvoerplan na besluit van Ethan

Onderstaande stappen zijn nog niet uitgevoerd. Signing met bestaande credentials vraagt een nieuwe,
concrete opdracht. Een nieuwe controle begint standaard uit of in waarschuwingsmodus. Bestaande harde
controles blijven hard; pas na akkoord van Ethan wordt de aanvullende controle verplicht.

### 1. Releaseomvang en vertrouwen vastleggen

| Stap | Uitvoering | Nodig van Ethan / organisatiebeheerder |
| --- | --- | --- |
| 1.1 | Leg één kandidaat-tag/SHA en de volledige verwachte assetlijst vast, plus werkelijk aangeboden website-URL's en eventuele oudere versies. Neem Snap, updaterarchieven, `latest.json` en MCPB mee; MSI alleen als die wordt aangeboden. | **Ethan:** akkoord op de te leveren varianten en te behouden oudere links. Advies: geen nieuwe MSI/Android-variant toevoegen binnen deze signingopdracht. De auditregel “Windows / Android” bevat alleen een Windows EXE. |
| 1.2 | Leg verwachte Windows-uitgever/Azure-profiel, Apple Team ID/bundle-identiteit en OpenPGP-primary fingerprint vast als publiek controlebeleid. Vertrouw geen willekeurige geldige ondertekenaar en geen sleutel die alleen naast de download staat. | **Beheerder:** bevestig de organisatie-identiteiten en het bestaande OpenPGP-beheer, inclusief eventuele geldige subkeys. **Ethan:** keur de vertrouwde identiteiten goed. |
| 1.3 | Laat de beheerder de deling van bestaande Azure-, Apple- en OpenPGP-voorzieningen met deze repo bevestigen. Alleen als nodig past die beheerder het toegangsbeleid aan. | **Beheerder:** namen, repo-toegang en verantwoordelijk eigenaar bevestigen; geen waarden aan de uitvoerder geven. Geen nieuwe sleutel, certificaat of betaalde licentie aanvragen op grond van deze inventaris. |

### 2. Windows

| Stap | Uitvoering | Nodig van Ethan / organisatiebeheerder |
| --- | --- | --- |
| 2.1 | Behoud de bestaande Tauri-`signCommand` via `windows-sign.ps1`, met Azure Artifact Signing tijdens het bundelen. Inventariseer eigen EXE/DLL, inclusief eventuele helpers/plugins, en controleer de geïnstalleerde boom uit de echte installer. Houd externe leveranciersbestanden apart met onderbouwde toegestane uitgevers. | **Beheerder:** bevestig bestaand Azure-account/profiel, rechten en afgesproken uitgever. **Ethan:** akkoord op de inventaris en uitzonderingen. |
| 2.2 | Controleer iedere aangeboden NSIS/MSI, eigen binary en uninstaller op geldige Authenticode-keten, overeengekomen uitgever en tijdstempel; `signtool verify` moet exit 0 geven. Voeg geen MSI toe zolang die niet is besloten. | **Ethan:** akkoord voordat nieuwe eisen blokkerend worden. Geen nieuwe signingcredentials nodig als de bestaande voorziening voldoet. |
| 2.3 | Download de definitieve draftinstaller en updater-ZIP terug. Vergelijk de EXE in de ZIP bytegelijk met de gecontroleerde installer en voer de native controle daarop uit vóór publicatie. Breid dezelfde controle achteraf uit met de uninstaller/eigen DLL. | **Ethan:** akkoord op de extra CI-controle; beheerder alleen bij een runner- of autorisatieprobleem. |

### 3. macOS

| Stap | Uitvoering | Nodig van Ethan / organisatiebeheerder |
| --- | --- | --- |
| 3.1 | Behoud bestaande Developer ID, entitlements, hardened-runtime-instellingen, notarisatie en stapling van app én DMG. Geen ad-hoc-terugval. | **Beheerder:** bevestig bestaande identiteit, Team ID, API-toegang en geldigheid. Geen certificaatinhoud of API-sleutel aan deze opdracht toevoegen. |
| 3.2 | Breid de bestaande controle uit met de overeengekomen Team ID/bundle-identiteit. Houd `codesign --verify --deep --strict`, Gatekeeper en `stapler validate` als voorwaarden. | **Ethan:** akkoord op het beleid; **beheerder:** vertrouwde identiteiten bevestigen. |
| 3.3 | Download naast de definitieve DMG ook de updater-`.app.tar.gz` uit de draft, pak die veilig uit en controleer de app met dezelfde native eisen. Alleen een aanwezige `CodeResources` is onvoldoende. | **Ethan:** akkoord op de extra macOS-CI-stap. Hergebruik de bestaande runner; verificatie behoeft geen privésleutel. |

### 4. Linux: pakketten, GitHub-Snap, Store en AUR

| Stap | Uitvoering | Nodig van Ethan / organisatiebeheerder |
| --- | --- | --- |
| 4.1 | Gebruik de bestaande OpenAEC-OpenPGP-voorziening. Advies: losse `.asc` voor DEB/RPM/AppImage/Snap en een ondertekend `SHA256SUMS` voor alle definitieve assets. Dat herhaalt de bestaande Snap-aanpak en verandert geen pakketbytes. Publiceer/verwijs naar de publieke sleutel en onafhankelijk bevestigde fingerprint. | **Beheerder:** bevestig dat de bestaande sleutel uit de audit bruikbaar is en waar de publieke distributie en vertrouwde fingerprint thuishoren; bevestig de secretnamen en repo-deling. **Ethan:** akkoord op deze dekking. Sleutelpublicatie en signing worden door bevoegd beheer uitgevoerd na afzonderlijke opdracht. |
| 4.2 | Native RPM-/DEB-signing is een afzonderlijke keuze. Als die verplicht wordt: eerst het pakket native tekenen, daarna updaterhandtekeningen, checksums en metadata opnieuw opbouwen. Verifieer RPM met signaturecontrole en afgesproken keyring; voor DEB eerst het toegestane verificatiemechanisme kiezen. | **Ethan:** besluit of detached OpenPGP voor deze downloads voldoende is of ingebedde pakketondertekening vereist is. **Beheerder:** bevestig ondersteunde sleutel/subkey en pakketbeleid. |
| 4.3 | Bouw de losse Snap uit de gecontroleerde DEB terwijl de hoofdrelease nog draft is. Teken/verifieer de definitieve Snap en voeg hem samen met zijn `.asc` vóór de laatste draftcontrole toe. Verwijder de latere ongecontroleerde `--clobber`-uploadroute. | **Ethan:** akkoord op de aangepaste publicatievolgorde. De huidige `snap.yml` kan hiervoor niet ongewijzigd blijven. Geen signingstap starten in deze onderzoeks-PR. |
| 4.4 | Behandel Store-upload en promotie naar `stable` apart. Controleer de OpenPGP-getekende input vóór upload; leg Store-revisie en digest vast en verifieer de bijbehorende assertion. Onderzoek eerst of de bestaande Store-toegang een nog niet vrijgegeven revisie kan laten downloaden en controleren, zodat promotie pas daarna plaatsvindt. Controleer na promotie de werkelijk aangeboden revisie opnieuw. | **Beheerder:** bevestig eigenaar, upload-/promotierechten en beschikbare route voor een niet vrijgegeven revisie. **Ethan:** akkoord op deze route vóór implementatie. Een `.asc` vervangt geen Store-assertion. Geen `--dangerous` gebruiken als bewijs van een vertrouwde Store-installatie. |
| 4.5 | Laat AUR de ondertekende bron-DEB verifiëren voordat `PKGBUILD`/checksums worden gepubliceerd. Een SSH-sleutel en alleen SHA256 zijn geen OpenPGP-bronverificatie. Native Arch-pakketondertekening vereist een aparte distributiekeuze. | **Ethan:** bevestig gewenste AUR-dekking. **Beheerder:** alleen bestaande AUR-rechten bevestigen wanneer daadwerkelijk publiceren is opgedragen; de bestaande waiver voor een ontbrekend AUR-secret niet stilzwijgend wijzigen. |

Canonical beschrijft [Snap-assertions](https://snapcraft.io/docs/explanation/security/assertions/) en het
apart ophalen en erkennen daarvan. Er is in deze opdracht geen Snap geïnstalleerd en geen Store-upload gedaan.

### 5. Updater en gezamenlijke publicatiepoort

| Stap | Uitvoering | Nodig van Ethan / organisatiebeheerder |
| --- | --- | --- |
| 5.1 | Behoud de bestaande minisign-voorziening. Geen rotatie of vervanging van de updaterkey: bestaande installaties vertrouwen de bijbehorende publieke sleutel. | **Beheerder:** bevestig continuïteit van de bestaande voorziening, zonder sleutelwaarden te delen. **Ethan:** geen nieuwe sleutel nodig voor dit plan. |
| 5.2 | Vaste volgorde: native platform-/pakketsigning en stapling → definitieve updaterarchieven → updater-`.sig` → definitief `latest.json` → OpenPGP/checksums → terugdownloaden en verifiëren → publicatie. Maak `SHA256SUMS` over alle definitieve assets behalve zichzelf en zijn eigen `.asc`. Elke latere bytewijziging vraagt opnieuw de afhankelijke signatures/checksums én alle controles. | **Ethan:** akkoord op één gecontroleerde assetset per publicatiemoment, inclusief Snap en MCPB. **Beheerder:** bevoegd beheer voert het tekenen met bestaande credentials uit, pas na concrete opdracht. |
| 5.3 | Behoud de harde draftverificatie en voeg de ontbrekende native/OpenPGP-/assetdekking toe. Gebruik een strikt verificatiepad met alleen publieke vertrouwensgegevens, zonder signingcredentials. Een ontbrekende, ongeldige of verkeerde-uitgeverhandtekening moet na activering de draft laten staan. | **Ethan:** afzonderlijk akkoord voor activeren. Tot dat moment alleen een nieuwe aanvullende controle op `off`/`warn`; bestaande harde controles niet versoepelen. |
| 5.4 | Herhaal de controle na publicatie op exacte tag, assetnamen en hashes. Website-downloads en Store-revisie horen bij dit bewijs. Geen ongecontroleerde assetvervanging na publicatie; bij noodzakelijke vervanging opnieuw volledige verificatie van de betrokken set. | **Ethan:** expliciet akkoord voor de concrete release/publicatie en eventuele websiteaanpassing. **Orkestrator:** legt later het releasebewijs vast op #726 en sluit pas na de checklist. |

Tauri vereist [payloadsignatures voor updates](https://v2.tauri.app/plugin/updater/#signing-updates).
Dat vervangt Authenticode, Apple Developer ID of OpenPGP niet. Dit plan voegt geen nieuwe
manifestverificatie in de app toe; dat zou een gedragswijziging zijn waarvoor Ethan eerst beslist.

## Bewijs dat de implementatie later moet leveren

Elke echte fix krijgt eerst een gerichte regressiecontrole die faalt op de dan geldende main, daarna
slaagt op de wijziging. De controle moet minstens ontbrekende signature, veranderde payload,
geldige maar verkeerde ondertekenaar en latere assettoevoeging/vervanging onderscheiden. Native
Windows/macOS-controles lopen in CI met hun echte platformtools; geen zware lokale builds op aia.
Synthetisch sleutel- of certificaatmateriaal valt buiten deze onderzoeksopdracht.

Acceptatie vraagt per aangeboden platform: verwachte identiteit, juiste definitieve bytes, succesvolle
cryptografische verificatie en een bewezen mislukte publicatiepoging bij ontbrekende/ongeldige signing,
zonder een echte release te publiceren. Een geslaagde functionele starttest vervangt dat niet.
De groen-te-maken poort en het eigenaarakkoord moeten vóór de eerste nieuwe concrete publicatie vaststaan.

## Wat deze PR oplevert

Alleen dit plan. Er is geen nieuwe checker gebouwd: de bestaande releaseverifier is al beschikbaar,
en de ontbrekende dekking vereist eerst besluiten over vertrouwen en de publicatievolgorde. Daardoor
worden ook de secretgebruikende PR-signingworkflows niet door een workflowwijziging geactiveerd.
Een nieuwe poort is niet ingeschakeld en er is niets gepubliceerd of op het issue geplaatst.

Voor documentatiewerk is een rood/groen producttest niet van toepassing. De PR moet de afbakening,
bronverwijzingen en de gerichte documentcontroles vermelden; gewone PR-CI blijft afzonderlijk bewijs.
De niet opnieuw uitgevoerde binaire verificatie, organisatie-secrettoegang, Store-assertions en een
volgende concrete release blijven expliciet open.
