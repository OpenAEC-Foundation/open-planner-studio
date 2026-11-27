# Een map openen in de bestandsbeheerder via het eigen Rust-command `open_folder` (#1245)

`open()` van `@tauri-apps/plugin-shell` staat met `"shell": { "open": true }` in `src-tauri/tauri.conf.json` alleen de standaard-regex toe (`mailto:`/`tel:`/`https?://`), dus een lokaal pad weigert die. Op Windows opende de knop "Backup-map openen" (`openBackupFolder()` in `src/services/mcp/backup.ts`) daardoor niets.

`@tauri-apps/plugin-opener` is niet als dependency meegeïnstalleerd; die toevoegen kost een npm- én een Cargo-dependency plus een capability-permissie. Daarom is er een eigen command `open_folder` (`src-tauri/src/commands/open_folder.rs`, geregistreerd in `main.rs`): het start het OS-programma zelf — `explorer` op Windows, `open` op macOS, `xdg-open` op Linux — en laat het proces los zonder te wachten (`explorer` geeft ook bij succes een niet-nul exit-code).

Grens, zoals bij `place_file_exclusive`: elk command in de `invoke_handler` is aan te roepen vanuit elke webview met een lokale oorsprong, ook vanuit extensiecode. Het pad moet daarom binnen de app-datamap liggen; base en doel worden allebei gecanoniceerd (een onbestaand doel via de dichtstbijzijnde bestaande bovenliggende map, zoals plugin-fs `resolve_real_path`), zodat `..` of een symlink in een bovenliggende map niet naar buiten kan. De webview kan de app-datamap al lezen via plugin-fs, dus dit voegt geen leesrecht toe. Een app-command heeft geen capability-permissie nodig.

Frontend: `openFolder()` / `openFolderWith()` in `src/services/shell/openFolder.ts` (zelfde seam-patroon als `placeFileExclusive.ts`), aangeroepen vanuit `openBackupFolder()` ná de `mkdir` via plugin-fs. De andere `plugin-shell` `open()`-aanroepen (feedback-URL, update-dialogs) openen alleen `https://`-URL's en blijven op die plugin.

Toetsen: `tests/mcp/cases-open-folder.ts` (headless met nep-`__TAURI_INTERNALS__.invoke`; vóór de fix rood — `plugin:shell|open` aangeroepen met de map — ná de fix groen: `open_folder` krijgt het pad, shell-open niet) en de unittests in `open_folder.rs` voor `resolve_within`.

Niet bewezen in deze omgeving: echt klikken in de Windows-app (geen Tauri-build gedraaid); CI bouwt de Rust-kant.
