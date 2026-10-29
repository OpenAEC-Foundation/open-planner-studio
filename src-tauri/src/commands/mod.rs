//! Native commands van de Rust-schil — precies één, en dat is opzet.
//!
//! Alle bestand-I/O loopt via de JS-plugins `@tauri-apps/plugin-fs` +
//! `@tauri-apps/plugin-dialog` (zie `src/services/fileAccess/`). Het enige
//! `invoke()` in de hele frontend staat in
//! `src/services/updater/updaterService.ts` en roept `install_kind` aan.
//!
//! Hier stonden ook `read_file`/`write_file`: ongebruikte "escape hatch"-commands
//! voor native bestand-I/O. Ze zijn verwijderd bij onderhoudbaarheidsbevinding
//! K6a, omdat ongebruikt hier niet onbereikbaar betekent. Alles wat in de
//! `invoke_handler` staat is aan te roepen via
//! `window.__TAURI_INTERNALS__.invoke(...)`, dus ook vanuit extensiecode, die in
//! dezelfde realm draait. Ze namen een willekeurig pad aan, deden geen enkele
//! padvalidatie en gingen volledig buiten de scope-configuratie van `plugin-fs`
//! om — daarmee waren ze een lees-/schrijfprimitief op het hele bestandssysteem,
//! zonder dat één regel productiecode ze nodig had. Heb je ooit native
//! bestand-I/O nodig, breid dan `src/services/fileAccess/` uit (of voeg een
//! command toe MÉT padvalidatie), niet deze module.

/// Detecteer hoe de app op deze machine geïnstalleerd is, zodat de frontend kan
/// beslissen óf en hoe de in-app updater mag werken.
///
/// Gerechtvaardigde minimale uitzondering op "domeinlogica hoort in TypeScript":
/// dit is pure platform-introspectie (omgeving en pakketbeheer), géén domeinlogica.
/// De frontend kan zelf geen process-env of pacman lezen, vandaar deze command.
///
/// Teruggegeven waarden:
/// - `"appimage"` — gestart vanuit een AppImage (env `APPIMAGE` gezet); updater
///   kan in-place vervangen → auto-install OK.
/// - `"snap"` — gestart binnen een Snap (env `SNAP` gezet); read-only, snapd
///   updatet zelf → in-app updater overslaan.
/// - `"aur"` — Linux, en pacman beheert het canonieke pad van dit programma
///   (`pacman -Qo <pad>` slaagt; AUR-pakket `open-planner-studio-bin`). De
///   updater kan geen pacman-pakket installeren → in-app updater overslaan,
///   bijwerken via `yay`/`paru` (gedraagt zich als `snap`).
/// - `"deb"` — Linux zonder AppImage/Snap/AUR (vermoedelijk .deb/systeempakket);
///   de updater-plugin (≥2.6) installeert .deb gewoon in-place via pkexec/sudo
///   + `dpkg -i` → normale auto-install-flow, handmatige instructies alleen
///   nog als fallback bij een fout.
/// - `"native"` — Windows/macOS (en overige niet-Linux): de normale updater-flow.
///
/// De waarde wordt één keer per proces bepaald (`OnceLock`) en daarna steeds
/// teruggegeven. `main` warmt hem vroeg op in een eigen thread
/// ([`warm_install_kind`]): vervangt een pakketupdate later de draaiende
/// executable, dan wijst `current_exe()` naar een pad met ` (deleted)` en zou
/// een nieuwe meting `aur` als `deb` zien. De command is `async` en meet via
/// `spawn_blocking`, zodat een trage `pacman` nooit de UI-thread vasthoudt.
#[tauri::command]
pub async fn install_kind() -> String {
    tauri::async_runtime::spawn_blocking(|| cached_install_kind().to_string())
        .await
        .unwrap_or_else(|_| detect_install_kind().to_string())
}

/// Bepaal het installatietype vroeg bij het opstarten (aangeroepen vanuit
/// `main` in een eigen thread), zodat de eerste `install_kind`-aanroep niet
/// hoeft te wachten en het pad nog het originele programma is.
pub fn warm_install_kind() {
    let _ = cached_install_kind();
}

static INSTALL_KIND: std::sync::OnceLock<&'static str> = std::sync::OnceLock::new();

fn cached_install_kind() -> &'static str {
    INSTALL_KIND.get_or_init(detect_install_kind)
}

fn detect_install_kind() -> &'static str {
    if cfg!(target_os = "linux") {
        if std::env::var_os("APPIMAGE").is_some() {
            "appimage"
        } else if std::env::var_os("SNAP").is_some() {
            "snap"
        } else if managed_by_pacman() {
            "aur"
        } else {
            "deb"
        }
    } else {
        "native"
    }
}

/// Maximale wachttijd op `pacman -Qo`. Daarna wordt het proces gestopt en
/// geldt de installatie als niet-AUR (`deb`-terugval).
const PACMAN_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(2);

/// Beheert pacman het eigen programma? Alleen zinvol op Linux; elke fout (geen
/// pacman, pad onbekend, pakket niet gevonden, te traag) geeft `false`, zodat
/// de bestaande `deb`-terugval blijft gelden. Alleen het canonieke pad telt:
/// pacman kent geen symlinks als eigendom.
fn managed_by_pacman() -> bool {
    let Ok(exe) = std::env::current_exe() else {
        return false;
    };
    let Ok(path) = std::fs::canonicalize(exe) else {
        return false;
    };
    let mut command = std::process::Command::new("pacman");
    command
        .arg("-Qo")
        .arg(path)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    run_with_timeout(&mut command, PACMAN_TIMEOUT)
}

/// Start `command` en wacht hoogstens `timeout`. Geeft `true` alleen als het
/// proces binnen die tijd met succes eindigt; anders wordt het gestopt.
fn run_with_timeout(command: &mut std::process::Command, timeout: std::time::Duration) -> bool {
    let Ok(mut child) = command.spawn() else {
        return false;
    };
    let deadline = std::time::Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return status.success(),
            Ok(None) if std::time::Instant::now() < deadline => {
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return false;
            }
        }
    }
}
