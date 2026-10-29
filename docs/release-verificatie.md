# Releaseverificatie

Dit document beschrijft hoe we controleren wat een gebruiker echt downloadt. Het hoort bij issue #429,
deelpunten "Verify the located Windows/macOS/Linux artifacts on clean machines" en "Verify signing on
actual release artifacts".

Er zijn twee onderdelen:

- `scripts/verify-release.mjs <tag>` controleert de assets van een release zonder iets te installeren.
- `.github/workflows/release-verify.yml` installeert en start de app op schone GitHub-runners en
  controleert de platformhandtekeningen. Die workflow draait ook `verify-release.mjs`.

`release.yml` draait `verify-release.mjs` ook vlak vóór publicatie, op de draft (`--draft-id <release-id>`).
Faalt daar een controle, dan blijft de release een draft en publiceert niets. In die modus haalt het script
de release op id op (de tags-route van de API kent geen drafts), eist het dat het een draft met die tag en
geen prerelease is, en behandelt het de draft als de nieuwste release: bij publicatie wordt hij dat.

## Wat elke controle doet

### `verify-release.mjs` (elk platform)

Het script downloadt alle assets met `gh release download` en schrijft een markdown-rapport.
Exitcode 0 = alles OK, 1 = minstens één controle FOUT, 2 = het script zelf crashte.

| controle | wat | FOUT als |
|---|---|---|
| sha256 = GitHub-digest | sha256 van elke gedownloade asset tegen het veld `digest` in de Releases-API | de hash verschilt. Ontbreekt `digest`, dan is de uitkomst INFO |
| updater-handtekening (.sig) | elke `*.sig` tegen de pubkey in `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Minisign: sleutel-id, Ed25519 over BLAKE2b-512 van het bestand (`ED`; legacy `Ed` over de ruwe bytes), en de globale handtekening over `handtekening ‖ trusted comment` | het bijbehorende bestand ontbreekt, de sleutel-id is anders, of een van beide handtekeningen klopt niet |
| latest.json | het manifest volgt het contract van de vastgelegde updater (tauri-plugin-updater 2.10.1): een object; `version` is semver en gelijk aan de tag (voorloop-`v`'s tellen niet); `notes` is tekst of `null`; `pub_date` is `null` of een tijdstip dat de Rfc3339-parser van `time` 0.3.47 accepteert (de datum moet bestaan, `t`/`z` mogen klein, het scheidingsteken mag elk ASCII-teken zijn, seconde 60 alleen als echte schrikkelseconde). `platforms` bevat alle tien sleutels die `release.yml` schrijft (`linux-x86_64` plus `-appimage`/`-deb`/`-rpm`, `darwin-aarch64`/`darwin-x86_64` plus `-app`, `windows-x86_64` plus `-nsis`), elk met het juiste soort asset. Per platform: `url` en `signature` zijn tekst, de URL heeft de vorm `https://github.com/<repo>/releases/download/<tag>/<asset>` of `https://github.com/<repo>/releases/latest/download/<asset>`, de asset bestaat, en `signature` is byte-gelijk aan de `.sig` van die asset en verifieert | een van die punten klopt niet. De updater zoekt eerst `{os}-{arch}-{installer}` en dan `{os}-{arch}`; ontbreekt een sleutel, dan vindt een installatie van dat soort geen update. De vorm `releases/latest/download/` wijst altijd naar de nieuwste release; voor een oudere tag is die URL dus FOUT. Een extra, onbekende sleutel is INFO |
| macOS app.tar.gz (informatief) | staat er `Contents/_CodeSignature/CodeResources` in de updater-tar | alleen INFO; de echte macOS-controle staat in de macOS-job |

De updater-pubkey heeft sleutel-id `28AC8F08A87C90CD`.

De base64-laag is net zo streng als de updater (de STANDARD-decoder van de Rust-crate `base64`): geen witruimte,
geen vreemde tekens, padding verplicht, en de tekst moet geldige UTF-8 zijn. De ingepakte minisign-tekst leest het
script zoals `minisign-verify` 0.2.5: regels zoals Rust `lines()`, en de base64-regels zonder trim. Een handtekening die de app weigert,
keurt het script dus ook af.

### `release-verify.yml` (schone runners)

| job | runner | controles |
|---|---|---|
| `linux` | `ubuntu-22.04`, `ubuntu-24.04` | `verify-release.mjs`; `.deb`: pakkethandtekening (INFO), `apt-get install ./…deb`, programma in `/usr/bin`, starten onder `xvfb-run` en na 20 s nog in leven, verwijderen; AppImage: starten met `--appimage-extract-and-run` (geen FUSE nodig) en na 20 s nog in leven |
| `linux-rpm` | container `fedora:latest` | pakkethandtekening (INFO), `rpm -K --nosignature`, `dnf install ./…rpm`, `rpm -qi`, starten onder `xvfb-run` en na 20 s nog in leven |
| `windows` | `windows-latest` | setup.exe: `Get-AuthenticodeSignature` (status `Valid`, ondertekenaar, `TimeStamperCertificate`) en `signtool verify /pa /v`; stil installeren (`/S`); het geïnstalleerde `open-planner-studio.exe`: dezelfde Authenticode-controle, starten en na 20 s nog in leven; stil verwijderen (de Uninstall-sleutel moet verdwijnen) |
| `macos` | `macos-latest` | dmg mounten en de app naar een tijdelijke map kopiëren; `codesign --verify --deep --strict`, `spctl -a -t exec -vv` op de app, `spctl -a -t open --context context:primary-signature -v` op het dmg, `xcrun stapler validate` op dmg en app, `scripts/macos-verify-dmg.sh` (dezelfde poort als in `release.yml`), de app starten en na 20 s nog in leven |

Elke job draait alle controles, ook na een FOUT. `scripts/release-check.sh` houdt de uitkomsten bij en
schrijft aan het eind een tabel naar de job-samenvatting (`$GITHUB_STEP_SUMMARY`).

Kapotte infrastructuur is nooit een gewone FOUT. Ontbreekt een commando of shellbestand, start het niet (exit
126/127), of heeft een shellbestand of `bash -c`-script een syntaxfout (vooraf `bash -n`), dan stopt `release-check.sh` met exit 3. De stap geeft die exitcode door,
dus de job wordt rood, ook in rapportmodus. De tag van `workflow_dispatch` wordt als hele waarde gecontroleerd;
`run:`-blokken lezen invoer alleen via de omgeving, nooit via `${{ }}`.

Wanneer een job rood wordt:

- **Streng** (`workflow_run` na "Build and Release", `release: published`, `workflow_dispatch`): de job
  faalt als één controle FOUT is.
- **Rapportmodus** (`pull_request` op de workflow of de scripts): de controles draaien tegen de laatste
  release; een FOUT maakt de job niet rood. Een crash, een ontbrekende tool of een ontbrekende asset wel.

`release.yml` publiceert de release met `GITHUB_TOKEN`. Zo'n event start geen nieuwe workflow, dus
`release: published` vuurt alleen bij een release die iemand met de hand publiceert. De automatische route
is `workflow_run` op "Build and Release"; die werkt pas als de workflow op `main` staat.

## Zelf draaien

Alle controles op een tag, vanaf GitHub:

```bash
gh workflow run release-verify.yml -f tag=v2026.9.0
```

Alleen de assetcontroles, lokaal (Node 22, `gh` ingelogd):

```bash
node scripts/verify-release.mjs v2026.9.0 --dir /tmp/ops-assets --out /tmp/rapport.md
echo "exit $?"
```

De test van de minisign-verificatie (eigen Ed25519-sleutel, mutatie, verkeerde sleutel-id) zit in de
dev-server-suite: `node --test tests/dev-server/verify-release.test.mjs`. De helper en de workflow (tag-injectie,
geen `${{ }}` in `run:`, kapotte controles, de exitcode van `tauri signer sign` in `release.yml`) staan in
`tests/dev-server/release-check.test.mjs`. Daar staat ook de Windows-startcontrole (`scripts/release-check.ps1`,
`Test-Alive`: een mislukte start is FOUT); die test draait als `pwsh` er is.

### Authenticode handmatig controleren op Linux

`osslsigncode` is niet nodig. Met `uv` en de Python-library `signify` kun je de handtekening van de
setup.exe controleren, inclusief de RFC 3161-tijdstempel:

Sla dit op als `/tmp/authenticode.py`:

```python
import sys
from signify.authenticode import signed_file
with open(sys.argv[1], "rb") as f:
    pe = signed_file.AuthenticodeFile.from_stream(f)
    result, err = pe.explain_verify()
    print("oordeel:", result.name, err or "")
    for sd in pe.signatures:
        si = sd.signer_info
        signer = next(c for c in sd.certificates if c.serial_number == si.serial_number)
        print("ondertekenaar:", signer.subject.dn)
        print("uitgever:", signer.issuer.dn)
        print("tijdstempel:", getattr(si.countersigner, "signing_time", None))
sys.exit(0 if err is None else 1)
```

Draai het dan op de setup.exe (getest op 2026-10-21 tegen v2026.9.0; exit 0 = geldig, en één gewijzigde
byte geeft `INVALID_DIGEST` met exit 1):

```bash
mkdir -p /tmp/ops-win && gh release download v2026.9.0 --pattern '*-setup.exe' --dir /tmp/ops-win
cd /tmp && uv run --no-project --with signify \
  --with "oscrypto @ git+https://github.com/wbond/oscrypto.git@1547f535001ba568b239b8797465536759c742a3" \
  python3 -I /tmp/authenticode.py /tmp/ops-win/*-setup.exe
```

Uitvoer voor v2026.9.0: `oordeel: OK`, ondertekenaar `CN=Impertio Studio B.V.`, uitgever
`CN=Microsoft ID Verified CS EOC CA 04`, tijdstempel `2026-09-02 06:58:47Z`.

De vaste `oscrypto`-commit is nodig: de PyPI-versie van `oscrypto` herkent OpenSSL 3 niet.
De Windows-job blijft de bron: `Get-AuthenticodeSignature` en `signtool` gebruiken de echte
Windows-vertrouwensketen.

## Uitkomst v2026.9.0

Run: <https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39565196501> (rapportmodus, PR #438, 2026-10-21; na reviewronde 1, gelijk aan de eerste run 39559191898).

| platform | controle | uitkomst |
|---|---|---|
| alle | sha256 van alle 15 assets = GitHub-`digest` (het veld bestaat voor elke asset) | OK |
| alle | updater-`.sig` van rpm, deb, AppImage, `nsis.zip`, `app.tar.gz` (sleutel-id `28AC8F08A87C90CD`, alg `ED`) | OK |
| Windows | updater-`.sig` van de setup.exe | **FOUT** — getekend vóór Authenticode (trusted comment `timestamp:1788332248`); past niet bij de gepubliceerde exe. Opgelost in `release.yml` vanaf de volgende release |
| alle | `latest.json`: 10 platform-entries wijzen naar een bestaande asset, signature = asset-`.sig` en verifieert | OK |
| Linux | `.deb` en `.rpm`: pakkethandtekening (GPG) | geen (INFO) |
| Linux (22.04 en 24.04) | `.deb` installeren, `/usr/bin/open-planner-studio` 2026.9.0, starten onder Xvfb, na 20 s in leven, verwijderen | OK |
| Linux (22.04 en 24.04) | AppImage starten (`--appimage-extract-and-run`), na 20 s in leven | OK |
| Linux (Fedora) | `rpm -K --nosignature` (digests OK), `dnf install`, `rpm -qi`, starten, na 20 s in leven | OK |
| Windows | setup.exe: Authenticode `Valid`, ondertekenaar `CN=Impertio Studio B.V.` (uitgever `Microsoft ID Verified CS EOC CA 04`), tijdstempel van `Microsoft Public RSA Time Stamping Authority`, `signtool verify /pa /v` exit 0 | OK |
| Windows | stil installeren (`/S`) naar `%LOCALAPPDATA%\Open Planner Studio`, starten, na 20 s in leven, stil verwijderen | OK |
| Windows | geïnstalleerd `open-planner-studio.exe`: Authenticode | **FOUT** — `NotSigned`. Azure Trusted Signing tekent alleen de setup.exe (`files-folder-depth: 1` in de nsis-map), niet het programma in de installer. Niet verwacht; opgelost door PR #444, zie *Windows: Authenticode op installer, programma en uninstaller* |
| macOS | app: `codesign --verify --deep --strict` | **FOUT** — "code object is not signed at all" (alleen een ad-hoc-handtekening op het binaire bestand, geen Team-ID) |
| macOS | `spctl` op app en dmg | **FOUT** — "no usable signature" |
| macOS | `xcrun stapler validate` op dmg en app | **FOUT** — geen ticket |
| macOS | `scripts/macos-verify-dmg.sh` | **FOUT** — dmg niet getekend |
| macOS | app.tar.gz bevat `Contents/_CodeSignature/CodeResources` | nee (INFO) |
| macOS | app (uit de dmg gekopieerd, zonder quarantaine-attribuut) starten, na 20 s in leven | OK |

De macOS-fouten zijn verwacht: de release-job van v2026.9.0 kreeg geen APPLE_*-secrets. PR #390 voegt
signing, notarisatie, staple en `scripts/macos-verify-dmg.sh` als releasepoort toe.

Wat deze run niet aantoont:

- dat het venster iets zinnigs toont. De alive-check meet alleen dat het proces na 20 s nog draait;
- hoe Gatekeeper een app met quarantaine-attribuut behandelt (een download via de browser). De runner start
  de app direct; de `spctl`-controles staan daarvoor in;
- SmartScreen op Windows (reputatie, geen technische controle);
- de Snap en de in-app updater zelf (een update van versie A naar B).

## Windows: Authenticode op installer, programma en uninstaller

In v2026.9.0 tekende een losse stap ná de build alleen de setup.exe; het geïnstalleerde programma was
`NotSigned` (zie de tabel hierboven). Sinds PR #444 tekent Tauri tijdens het bundelen, via
`bundle.windows.signCommand`:

- `scripts/windows-sign.ps1 -Setup` haalt de officiële Microsoft-signeerclient (NuGet
  `Microsoft.ArtifactSigning.Client` 1.0.146; de SHA512 uit de NuGet-catalogus staat vast in het script) en
  schrijft een Tauri-config-override met de `signCommand`. Alleen `release.yml` (build-windows) en
  `windows-sign-check.yml` laden die override met `--config`. `ci.yml`, `tauri:dev` en lokale builds tekenen
  dus niet en hebben geen credentials nodig.
- Tauri roept `scripts/windows-sign.ps1 <bestand>` aan voor het programma, de NSIS-plugins, de uninstaller
  en de installer: `signtool sign /fd SHA256 /tr http://timestamp.acs.microsoft.com /td SHA256` met de dlib.
  Inloggen gaat alleen via `EnvironmentCredential` (`AZURE_TENANT_ID`, `AZURE_CLIENT_ID`,
  `AZURE_CLIENT_SECRET`).
- Waarom niet `artifact-signing-cli` uit de Tauri-docs: dat is een tool van een derde partij. Hij logt in met
  `az login -p <secret>` (het secret staat dan in een procesargument) en downloadt dezelfde Microsoft-dlib
  zonder hashcontrole.
- `release.yml` eist daarna een geldige handtekening met tijdstempel op setup.exe en
  `open-planner-studio.exe`. Anders faalt build-windows en blijft de release draft.

Bewijs zonder tag: `windows-sign-check.yml`
([run 39563362181](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39563362181),
2026-10-21) bouwt release-gelijk, installeert stil en controleert met `Get-AuthenticodeSignature` en
`signtool verify /pa /v`:

| bestand | status | ondertekenaar | tijdstempelautoriteit | tijdstempel (UTC) |
|---|---|---|---|---|
| setup.exe (installer) | Valid | CN=Impertio Studio B.V. | CN=Microsoft Public RSA Time Stamping Authority | 2026-10-21 07:47:37 |
| open-planner-studio.exe (geïnstalleerd) | Valid | CN=Impertio Studio B.V. | CN=Microsoft Public RSA Time Stamping Authority | 2026-10-21 07:47:02 |
| uninstall.exe (uninstaller) | Valid | CN=Impertio Studio B.V. | CN=Microsoft Public RSA Time Stamping Authority | 2026-10-21 07:47:23 |

## Open punten

- **Geen GPG-handtekening op Linux-pakketten en geen `SHA256SUMS`.** De `.deb` en `.rpm` dragen geen
  pakkethandtekening; alleen de updater-`.sig` (minisign) en de GitHub-`digest` per asset bestaan. Een
  GPG-sleutel invoeren is een besluit over sleutelbeheer voor de organisatie; dat valt buiten deze controle.
- **De Snap** (`.snap`-asset en de Snap Store) controleert deze workflow niet. De Store tekent zelf.
