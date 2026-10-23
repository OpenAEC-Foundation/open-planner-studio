# Ecosysteemgereedheid (issue #429)

Wat Open Planner Studio levert voor het OpenAEC-ecosysteem: installers, de headless kern, de API, MCP,
de koppeling met Claude, de UI-stijl, ondertekening en AWS. Per eis uit #429 staat hier de stand en waar
het bewijs staat. Dit document verwijst naar de detaildocs en herhaalt ze niet.

Stand: 21 oktober 2026. Laatste release: v2026.9.0 (2 september 2026). Wat na die release in `main`
kwam, zit pas vanaf de volgende release in de installers.

## Capability matrix

| onderdeel | geleverd | runtime en architectuur | kanaal en versie | bewijs |
|---|---|---|---|---|
| Windows-installer | ja | Windows x64, NSIS-setup (`*-setup.exe`) | GitHub Releases, stabiel (CalVer) | [releaseverificatie](release-verificatie.md) |
| macOS-installer | ja | macOS universal (arm64 + x86_64), `.dmg` | GitHub Releases, stabiel | [releaseverificatie](release-verificatie.md) |
| Linux-pakketten | ja | x86_64: `.deb`, `.rpm`, AppImage; Snap (amd64) | GitHub Releases + Snap Store `stable` | [releaseverificatie](release-verificatie.md) |
| In-app updater | ja | Windows, macOS, AppImage, `.deb` (Snap update via snapd) | `latest.json` op GitHub Releases, minisign | [releaseverificatie](release-verificatie.md) |
| Browserversie | ja | browser; zonder File System Access (Firefox, Safari) wordt opslaan een download | `open-planner-studio.open-aec.com`, elke push naar `main` | `live.yml` |
| Platformbouw (OpenAEC-app op Frappe) | ja | browser, onder een sub-pad | bouwartefact `dist-platform/` | [platformbouw](platformbouw.md) |
| Headless kern (library) | ja, niet gepubliceerd | Node.js ≥ 22, ESM, geen native code | npm-pakket `@openaec/open-planner-core` als bouwartefact (`npm run build:core`) | [headless kern](headless-kern.md) |
| Headless HTTP-API | ja | Node.js 22 in een Linux-container (CI bouwt linux/amd64; arm64 kan) | Dockerfile in de repo; geen gepubliceerde image | [headless API](headless-api.md) |
| AWS-deployment | definitie klaar, niet uitgerold | ECS Fargate (X86_64 of ARM64) achter een ALB, CloudFormation | `deploy/aws/ecs-fargate.yaml` | [headless API](headless-api.md) |
| MCP-server | ja, in de desktopapp | streamable HTTP op `127.0.0.1` (standaardpoort 3877), Bearer-token; 39 `planner_*`-tools in v2026.9.0, 41 in `main` | desktoprelease; niet in de browserversie | [MCP-verificatie](mcp-verificatie.md) |
| Claude Code | ja | `claude mcp add --transport http …` | gids in de app | [MCP-verificatie](mcp-verificatie.md) |
| Claude Desktop | ja: `.mcpb`-bundel (stekker naar de app); reserve `mcp-remote`, getest door de eigenaar op 2026-10-23 | stdio-brug naar de lokale server; Claude Desktop levert Node mee | `.mcpb` als asset bij elke GitHub-release; gids in de app | [MCP-verificatie](mcp-verificatie.md) |
| Claude-connector, MCP App | nee | — | — | zie *Claude* hieronder |
| Native DLL / `.so` | nee, niet van toepassing | — | — | zie *Native library* hieronder |
| ARM64 voor Windows en Linux | nee | — | — | niet gebouwd |

## Per eis uit #429

Per eis: de stand, wat ontbreekt en waar het bewijs staat. De details staan in de gelinkte docs.

### 1. Capability matrix

Dit document. v2026.9.0 is de nieuwste stabiele release; er zijn geen prereleases.

### 2. Installers op schone machines

`release-verify.yml` installeert en start elke release op verse GitHub-runners (Ubuntu 22.04 en 24.04,
Fedora, Windows, macOS) en draait na elke release vanzelf. Voor v2026.9.0 lukt installeren en starten
op alle platforms: zie [releaseverificatie](release-verificatie.md#uitkomst-v202690).

Beperking: een GitHub-runner is een verse VM, maar geen kale machine (er staan ontwikkeltools op, op
Windows ook WebView2). Niet gemeten: of het venster iets zinnigs toont, SmartScreen, Gatekeeper met
quarantaine-attribuut en een update van versie A naar B.

### 3. Herbruikbare kern zonder UI

Het Node-pakket `@openaec/open-planner-core` opent een IFC, rekent door zoals de app en schrijft terug.
`npm run verify` bouwt het pakket, installeert het in een lege map en draait het consumeervoorbeeld.
Bewijs en grens van de library: [headless kern](headless-kern.md).

Open: publiceren op npm is een besluit van de organisatie.

### 4. Native library (DLL)

Niet van toepassing. De productkern is TypeScript en draait in een JavaScript-runtime. Er is geen
Rust- of C-kern om als DLL of `.so` met een C-ABI aan te bieden. Het Rust-deel (`src-tauri/`) is alleen
de desktopschil met drie commando's; dat is geen product-SDK.

Een DLL zou een JavaScript-engine moeten meeleveren en geheugen en fouten over de C-grens moeten
vertalen. Daar is nu geen afnemer voor. Een native programma gebruikt de [HTTP-API](headless-api.md); een
Node-programma gebruikt het pakket. Vraagt een concrete afnemer om een DLL, dan komt dit punt terug.

### 5. Headless API

`GET /healthz` en `POST /v1/schedule` op de kern, met een OpenAPI-contract, Bearer-token, één foutvorm,
grenzen voor upload en rekentijd en logs zonder IFC-inhoud. De smoke-test draait in CI tegen de server
en de container. Zie [headless API](headless-api.md).

### 6. MCP-server met een externe client

De officiële MCP-SDK test de server in `npm test` en in CI tegen de echte desktopapp
(`mcp-real-app.yml`): transport, rechten, undo en de documentbinding per sessie. Wat de AI-backup
wel en niet beschermt, staat in [MCP-verificatie](mcp-verificatie.md).

Beperking: de toetsing is gedaan op `main`. In v2026.9.0 heeft de server 39 tools en nog geen
MCP-sessies (`Mcp-Session-Id`); dat komt met de volgende release.

### 7. Claude Desktop en Claude Code

- Claude Code verbindt rechtstreeks over HTTP. Claude Desktop verbindt via de **`.mcpb`-bundel**: een
  stdio-stekker die elk bericht doorstuurt naar de bridge van de draaiende app (besluit eigenaar, 2026-10-23:
  een stekker naar de app, geen losse kern). Installeren is een dubbelklik en het token plakken; de gebruiker
  hoeft geen Node.js te installeren. De reserve is `mcp-remote` in `claude_desktop_config.json`.
- Getest: Claude Code 2.1.306 en `mcp-remote` 0.15.2, tegen de Node-kopie van de bridge. Tegen de echte
  desktopapp draaide de officiële SDK. Claude Desktop met `mcp-remote`: getest door de eigenaar op
  2026-10-23. De bundel: in CI via stdio tegen de Node-kopie van de bridge (`tests/mcp/cases-mcpb.ts`) en
  met `mcpb validate`; installeren in Claude Desktop zelf is nog niet getest.
- Een Claude-connector ("custom connector") werkt niet: die verbindt vanuit de cloud van Anthropic en
  heeft een publiek bereikbare server nodig, terwijl de MCP-server alleen op `127.0.0.1` luistert.
- Niet geleverd: een MCP App, een losse MCP-server zonder app, een ondertekende bundel en een downloadknop in de app.

De stappen voor gebruikers staan in de in-app gids *AI-assistent koppelen*.

### 8. UI en het OpenAEC-stijlboek

De UI is eigen code: eigen ribbon, backstage, titel- en statusbalk en dialogen, met `lucide-react`-iconen.
De app gebruikt geen pakketten uit het stijlboek (`@openaec/design-tokens`, `@openaec/ribbon`,
`@openaec/shell`, `@openaec/ui-primitives`, versie 0.1.0, niet op npm) en ook niet `openaec-ui`.

De merkkleuren zijn met de hand overgenomen in `src/styles/globals.css` en zijn gelijk aan de tokens van
het stijlboek (bijvoorbeeld `#36363E`, `#D97706`, `#EA580C`). Verschillen: een kleine hoekafronding van
6 px tegenover 4 px, andere maten voor zijbalk en werkbalk, andere reserve-lettertypen, en andere
themanamen (de app heeft licht, donker, hoog contrast en "systeem"). Vergeleken met het stijlboek op
commit `dfdcd415`.

Besluit (product owner, 21 oktober 2026): de app stapt nu niet over op de stijlboekpakketten.

### 9. Ondertekening van releases

Gecontroleerd op de echte bestanden van v2026.9.0; details en commando's in
[releaseverificatie](release-verificatie.md).

| platform | v2026.9.0 | vanaf de volgende release |
|---|---|---|
| Windows | setup.exe geldig getekend (Impertio Studio B.V., Microsoft Trusted Signing, met tijdstempel); het geïnstalleerde programma niet | installer, programma en uninstaller getekend (bewezen in `windows-sign-check.yml`) |
| macOS | geen Developer ID, geen notarisatie | getekend, genotariseerd en gestapled, met `scripts/macos-verify-dmg.sh` als poort |
| Linux | geen GPG op `.deb`/`.rpm`, geen `SHA256SUMS`; wel een sha256-digest per bestand op GitHub | ongewijzigd; GPG is een besluit over sleutelbeheer |
| updater (minisign, sleutel-id `28AC8F08A87C90CD`) | alle handtekeningen kloppen, behalve de losse `.exe.sig` (de updater gebruikt de `nsis.zip`) | `.exe.sig` opnieuw gemaakt na Authenticode |

Zelf controleren: `node scripts/verify-release.mjs <tag>`.

### 10. AWS

Gekozen runtime: een Linux-container op ECS Fargate achter een Application Load Balancer, met een
CloudFormation-definitie (`deploy/aws/ecs-fargate.yaml`). CI bouwt de container, draait de smoke-test
ertegen en controleert de definitie met `cfn-lint`. Zie [headless API](headless-api.md).

Nog niet gedaan: een echte deployment in AWS en de smoke-test daar. Daarvoor is een AWS-account nodig; de
vraag wie dat doet staat in #429. Tot die test is gedaan, heet Open Planner Studio niet "gereed voor AWS".

### 11. Bewijs per eis

De runs waarop dit document steunt (21 oktober 2026):

- releasecontrole tegen v2026.9.0: [Verify Release, run 39571015654](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39571015654);
- Windows-ondertekening zonder tag: [Windows sign check, run 39566056289](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39566056289);
- MCP met de officiële SDK tegen de echte desktopapp: [MCP echte app, run 39580908758](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39580908758);
- API, container en `cfn-lint` op `main`: [Headless API, run 39585147871](https://github.com/OpenAEC-Foundation/open-planner-studio/actions/runs/39585147871).

De headless kern wordt bij elke CI-run getoetst (`verify:core-package` en `check-headless-core.ts` in
`npm run verify`). Nieuwe releases controleert `release-verify.yml` vanzelf.
