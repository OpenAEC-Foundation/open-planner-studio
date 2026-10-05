# Release-secrets: wat ze doen, wat er stukgaat, en hoe je ze roteert

Dit document beschrijft de sleutels en credentials waar de uitleverketen op leunt.
Het bestaat omdat één daarvan **onherstelbaar** is: raakt de minisign-privésleutel
kwijt, dan kan geen enkele reeds geïnstalleerde kopie van de app ooit nog een
update ontvangen. Dat is geen hersteltaak maar een permanent verlies van je
installed base, en het wordt pas zichtbaar op het moment dat je het niet meer kunt
repareren.

> **In te vullen door de eigenaar.** De tabellen hieronder hebben velden gemarkeerd
> met `⟨IN TE VULLEN⟩`. Die kan niemand uit de repo afleiden — bewaarplek,
> vervaldata en wie er toegang heeft staan per definitie buiten de code. Zolang ze
> leeg zijn is dit document een inventarisatie, geen herstelplan.

## 1. Inventaris

Alle secrets staan als GitHub Actions-secret op
`OpenAEC-Foundation/open-planner-studio`. `GITHUB_TOKEN` staat er bewust niet bij:
dat wordt per run door GitHub zelf uitgegeven.

| Secret | Gebruikt in | Waarvoor | Blast radius bij verlies |
|---|---|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | `release.yml` (build-linux-mac, build-windows) | Signeert de updater-artefacten en `latest.json` met minisign | **Onherstelbaar** — zie §2 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | idem | Wachtwoord op die privésleutel | Idem: zonder wachtwoord is de sleutel onbruikbaar |
| `AZURE_TENANT_ID` | `release.yml` (build-windows) | Azure Trusted Signing — Authenticode op de Windows-installer | Herstelbaar: nieuwe credentials aanvragen. Tot die tijd waarschuwt SmartScreen bij elke Windows-download |
| `AZURE_CLIENT_ID` | idem | idem | idem |
| `AZURE_CLIENT_SECRET` | idem | idem | idem — **en dit is er één met een vervaldatum**, zie §3 |
| `AZURE_ENDPOINT` | idem | idem | idem |
| `AZURE_TRUSTED_SIGNING_ACCOUNT_NAME` | idem | idem | idem |
| `AZURE_CERTIFICATE_PROFILE_NAME` | idem | idem | idem |
| `SNAPCRAFT_STORE_CREDENTIALS` | `snap.yml` (publish-stap) | Publiceren naar het `stable`-kanaal van de Snap Store | Herstelbaar: opnieuw exporteren. Verlopen credentials laten de publish-stap falen terwijl de rest van de release slaagt |
| `DEPLOY_SSH_KEY` | `live.yml` (deploy-job) | `rsync` van `dist/` naar `open-planner-studio.open-aec.com` | Herstelbaar: nieuw sleutelpaar, publieke helft op de server |

Van deze negen is er precies één die je niet opnieuw kunt maken.

## 2. De minisign-sleutel — de enige echte SPOF

**Waarom hij anders is.** De publieke helft staat hardgecodeerd in
`src-tauri/tauri.conf.json` (`plugins.updater.pubkey`) en is dus **meegebakken in
elke uitgeleverde binary**. Een geïnstalleerde app accepteert uitsluitend een
`latest.json` die met de bijbehorende privésleutel is ondertekend. Tauri's
updaterconfiguratie kent één `pubkey`-veld — geen lijst — dus je kunt niet
"alvast" een tweede sleutel meeleveren.

Gevolg: raak je de privésleutel (of het wachtwoord) kwijt, dan zijn alle
bestaande installaties permanent afgesneden van auto-updates. Nieuwe gebruikers
merken niets; bestaande gebruikers blijven stilstaan op hun huidige versie en
moeten handmatig opnieuw installeren. De Tauri-documentatie is hier expliciet
over: *"if you lose this key you will NOT be able to publish new updates to the
users that have the app already installed."*

**Hoe hij ooit is gemaakt.** Volgens
`docs/superpowers/plans/2026-06-24-auto-update-cross-platform.md`:

```bash
npm run tauri signer generate -- -w ~/.tauri/ops.key
```

Dat schrijft de privésleutel naar `~/.tauri/ops.key` op de machine waar het
commando draaide. **Dat is een pad op één laptop, geen bewaarplek.**

| | |
|---|---|
| Huidige pubkey-vingerafdruk | `28AC8F08A87C90CD` (uit de base64 in `tauri.conf.json`) |
| Privésleutel bewaard in | ⟨IN TE VULLEN — password manager? kluis? welke?⟩ |
| Wachtwoord bewaard in | ⟨IN TE VULLEN — moet een ándere plek zijn dan de sleutel⟩ |
| Offline back-up | ⟨IN TE VULLEN — waar, en wanneer voor het laatst gecontroleerd?⟩ |
| Wie heeft toegang | ⟨IN TE VULLEN — minstens twee personen, anders is de bus factor 1⟩ |

**Minimum om deze SPOF weg te nemen:** sleutel én wachtwoord in een gedeelde
password manager waar minstens twee mensen bij kunnen, plus één offline kopie.
De GitHub-secret telt niet als back-up — die is write-only en niet uit te lezen.

### Migratiepad als je de sleutel wilt of moet vervangen

De volgorde is dwingend, want de oude sleutel is het enige waar bestaande
installaties op vertrouwen. Dit werkt **alleen zolang je de oude sleutel nog
hebt** — daarom is het een geplande actie, geen noodprocedure.

1. Genereer een nieuw sleutelpaar (`npm run tauri signer generate`).
2. Zet de **nieuwe pubkey** in `tauri.conf.json`, maar **signeer die release nog
   met de OUDE privésleutel** (de GitHub-secrets blijven dus even ongewijzigd).
   Deze release is het bruggetje: bestaande installaties accepteren hem nog
   (oude handtekening) en dragen daarna de nieuwe pubkey.
3. Laat die versie ruim de tijd krijgen om zich te verspreiden — ⟨IN TE VULLEN:
   hoeveel weken vinden we genoeg?⟩. Wie in dit venster niet update, blijft
   achter op de oude sleutel en moet uiteindelijk handmatig herinstalleren.
4. Vervang pas dán `TAURI_SIGNING_PRIVATE_KEY` en `..._PASSWORD` door het nieuwe
   paar. Vanaf de volgende release worden updates met de nieuwe sleutel getekend.
5. Bewaar de oude sleutel daarna nog steeds — er lopen installaties rond die
   alleen die kennen, en je wilt de mogelijkheid houden om nog een bruggetje te
   bouwen.

Ben je de sleutel al kwijt, dan bestaat stap 2 niet en is er geen pad terug:
bestaande gebruikers moeten via de website of hun pakketbeheerder opnieuw
installeren. Overweeg dan een expliciete aankondiging in plaats van te hopen dat
mensen het zelf merken.

## 3. Wat verloopt, en wanneer

Deze twee verlopen uit zichzelf, zonder waarschuwing in de repo. Ze breken pas
tijdens een release — het slechtst denkbare moment, want de tag is dan al gepusht.

| Wat | Vervalt op | Herinnering staat in | Vernieuwen |
|---|---|---|---|
| `AZURE_CLIENT_SECRET` | ⟨IN TE VULLEN⟩ | ⟨IN TE VULLEN — agenda-afspraak, één maand van tevoren⟩ | Nieuw client secret in Azure AD; secret in GitHub vervangen |
| Azure-certificaatprofiel | ⟨IN TE VULLEN⟩ | ⟨IN TE VULLEN⟩ | Via Azure Trusted Signing |
| `SNAPCRAFT_STORE_CREDENTIALS` | ⟨IN TE VULLEN⟩ | ⟨IN TE VULLEN⟩ | `snapcraft export-login` en het secret vervangen |

Zet die herinneringen in een agenda die niet aan één persoon hangt. Een
vervaldatum die alleen in iemands hoofd zit is functioneel geen vervaldatum.

## 4. Waar het misgaat als een secret ontbreekt

Nuttig bij het lezen van een gefaalde release:

- **Ontbrekende Tauri-signing-secrets** — `tauri-action` bouwt wel, maar
  produceert geen `.sig`-bestanden en geen bruikbare `latest.json`. De release
  slaagt ogenschijnlijk; de updater vindt niets. Stilste faalmodus van de keten.
- **Ontbrekende of verlopen Azure-secrets** — de `azure/trusted-signing-action`
  faalt hard in `build-windows`. Zichtbaar, en de release blijft draft. Dat is
  het gewenste gedrag.
- **Ontbrekende Snap-credentials** — `snap.yml` bouwt de snap en hangt hem aan de
  release, maar slaat de publish-stap over (`if: … env.SNAPCRAFT_STORE_CREDENTIALS != ''`).
  Bewust: geen credentials betekent geen publicatie, geen fout.
- **Ontbrekende deploy-sleutel** — `live.yml` faalt in de deploy-job. De site
  blijft op de vorige versie staan, wat veiliger is dan half deployen.

## 5. Zie ook

- [`SECURITY.md`](../SECURITY.md) — kwetsbaarheden melden.
- `.claude/rules/ci-release.md` §*Auto-update & releases* — hoe de releaseketen in elkaar zit.
- `docs/superpowers/plans/2026-06-24-auto-update-cross-platform.md` — het
  oorspronkelijke ontwerp van de updaterketen.
