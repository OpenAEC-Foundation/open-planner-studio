# Herstel in de browser: een sessie per tabblad

In de browser hangen de herstelrecords aan een sessie-id in `sessionStorage`, zodat tabbladen elkaars herstelset niet
raken. "Tabblad dupliceren" kopieert `sessionStorage`, en dan delen twee levende tabbladen één id: Verwerpen in het ene
wist de records van het andere, en `saveWeb` verwijdert elke ronde de documentrecords van die id die het eigen tabblad
niet open heeft (de webvariant van bevinding K5 in `docs/onderhoudbaarheid/README.md`). Een gekopieerde
`sessionStorage` is binnen het tabblad niet van een echte te onderscheiden; alleen de andere tabbladen weten het.
`resolveSessionId` claimt daarom de id met de Web Locks API (`claimLock`, `ifAvailable`) voor de hele levensduur van de
pagina: de callback geeft een promise terug die nooit klaar is, dus de browser laat de lock pas los als het document weg
is. Lukt de claim niet, dan volgt één nieuwe poging na `CLAIM_RETRY_MS` en daarna een nieuwe id.

Bij twijfel kiezen we een nieuwe id. Een vals alarm, een herlaad waarbij de lock van het vorige document nog vastzit,
kost dat dit tabblad zijn vorige snapshot niet terugvindt; die blijft staan tot ze verloopt (ADR 0194). Niet
detecteren kost dat twee tabbladen elkaars snapshots wissen. De ene nieuwe poging is er voor die herlaad.

## Gevolgen

- Een synchrone fout van Web Locks (de getter of `request`) telt als onzekere claim en volgt dezelfde route als een
  afgewezen claim, niet die van een geweigerde IndexedDB (`check-recovery-lock-refusal.ts`).
- Zonder `navigator.locks` geldt de claim als gelukt, en met een `sessionStorage` die gooit krijgt het tabblad de vaste
  id `default` zonder claim. Wat dat betekent, staat in knownbug 1996.
- `loadWeb` wacht op de sessieclaims voordat het de herstelset leest. Een duplicaat dat al las vóór zijn wachttijd om
  was, kon een oudere generatie herstellen en daarna bij het wissen de nieuwere van het andere tabblad weggooien
  (review van PR #644, `check-recovery-web-claim-order.ts`).
- Uitstellen (`holdWeb`, via `holdRecoveryForLater`). Een herlaad houdt dezelfde sessie-id, dus zonder vasthouden
  overschreef de eerste ronde het manifest en wiste ze de documentrecords die niet meer open waren: precies de
  uitgestelde snapshots (audit 2026-09-26, `check-recovery-web-hold.ts`). `holdWeb` zet de huidige id in de lijst onder
  `HELD_KEY` en geeft het tabblad een verse id voor nieuwe snapshots; de vastgehouden generatie blijft onder haar oude
  id staan, waarvan dit tabblad de lock al heeft. `loadWeb` leest de eigen generatie eerst en daarna de vastgehouden;
  van een document dat in meer generaties staat, telt de eerste. `clearWeb` wist ze allemaal. `useRecoveryRestore` houdt
  vast voordat de auto-save weer aangaat.
- Een gedupliceerd tabblad erft de lijst onder `HELD_KEY`, maar `heldSessionIds` houdt alleen de ids waarvan dit tabblad
  de lock krijgt.
- `newRecoveryId` valt terug op 128 willekeurige bits uit `crypto.getRandomValues` als `crypto.randomUUID` ontbreekt of
  gooit, zoals op een HTTP-adres (`check-recovery-web-hold.ts`, het begin van het webdeel). Dezelfde functie maakt de
  id van de instantie (`instanceId`, ADR 0190).
