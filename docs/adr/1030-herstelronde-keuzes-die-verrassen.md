# Keuzes in de herstelronde die verrassen

De modules rond de herstelronde in `src/services/recovery/` bevatten drie keuzes die een lezer zonder uitleg zou
terugdraaien. De besluiten van de herstelopslag zelf staan in ADR 0190 tot en met 0195.

## Gevolgen

- **Terugval van de herstelworker** (`createRecoverySnapshotSerializer`, `recoverySnapshotSerializer.ts`). Alleen een
  inhoudelijke writerfout (`RecoverySerializationError`, `IfcCalendarTimePrecisionError`) blijft een fout; de worker
  blijft dan in gebruik. Elke andere fout (de worker start niet, een clone- of transportfout, een crash, geen antwoord
  binnen 60 s) tijdens een lopende ronde stopt de worker en schrijft die versie en de volgende op de hoofdthread, ook
  na een geslaagde start: crashherstel mag niet uitvallen omdat een worker hapert. De invoer ligt vast vóór de eerste
  `await`, dus de terugval schrijft dezelfde versie als de worker.
- **Samenvoegen van herstelrondes** (`createRecoveryTickQueue`, `recoveryTickQueue.ts`). De gedeelde belofte bestaat al
  voordat `round` draait, ook als die synchroon gooit, en de `finally` direct na de lus zet `inFlight` terug op `null`
  in dezelfde microtask als waarin de lus voor het laatst naar `pending` keek. Een losse `.finally` erachter laat een verzoek dat tussen die twee
  momenten binnenkomt een belofte terugkrijgen die zijn ronde nooit draait; de updater wacht op die belofte vóór hij
  herstart.
- **Bevestigen van `pendingSha256`** (`runRecoveryTick`, `recoverySnapshot.ts`). Een document met een bronkopie (site,
  download) bevestigt nooit een lopende vervanging: het heeft geen eigen doel om te vervangen, en mislukt de kopie, dan
  laat `saveRecovery` de bronverwijzing uit het manifest weg terwijl de gepersisteerde basis van de tracker haar wel
  noemt.
