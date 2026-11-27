//! `open_folder`: een map openen in de bestandsbeheerder van het OS (#1245).
//!
//! Waarom een eigen commando: `open` van `tauri-plugin-shell` staat met `"shell": { "open": true }`
//! in `tauri.conf.json` alleen de standaard-regex toe (`mailto:`/`tel:`/`https?://`), dus een
//! lokaal pad weigert die — op Windows opende de knop "Backup-map openen" daardoor niets.
//! `tauri-plugin-opener` is niet meegeïnstalleerd. Dit commando start het OS-programma zelf:
//! Windows `explorer`, macOS `open`, overige Unix `xdg-open`. Het proces wordt losgelaten zonder
//! te wachten: `explorer` meldt ook bij succes een niet-nul exit-code.
//!
//! Grens (AGENTS.md, *Rust is thin*): net als `place_file_exclusive` is elk command in de
//! `invoke_handler` aan te roepen vanuit elke webview met een lokale oorsprong, ook vanuit
//! extensiecode. Daarom moet het pad binnen de app-datamap liggen; de webview kan die map zelf
//! al lezen via plugin-fs, dus dit voegt geen nieuw leesrecht toe. De app-datamap wordt
//! gecanoniceerd en het doel likewise (bestaand doel via `canonicalize`, anders het canonieke
//! pad van de dichtstbijzijnde bestaande bovenliggende map plus de rest, zoals plugin-fs
//! `resolve_real_path`), zodat een `..` of een symlink in een bovenliggende map niet buiten de
//! app-datamap kan wijzen.
//!
//! Een app-commando heeft geen capability-permissie nodig (zie de header van `place_file.rs`).

use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Het echte pad van `path` binnen `base`, of een fout als het erbuiten ligt. `base` moet al
/// gecanoniceerd zijn. Een pad dat (nog) niet bestaat, wordt resolved via zijn dichtstbijzijnde
/// bestaande bovenliggende map.
fn resolve_within(base: &Path, path: &Path) -> Result<PathBuf, String> {
    if !path.is_absolute() {
        return Err(format!("pad is niet absoluut: {}", path.display()));
    }
    let canon = match std::fs::canonicalize(path) {
        Ok(canon) => canon,
        Err(_) => {
            let parent = path
                .parent()
                .ok_or_else(|| format!("pad heeft geen bovenliggende map: {}", path.display()))?;
            let name = path
                .file_name()
                .ok_or_else(|| format!("pad heeft geen naam: {}", path.display()))?;
            std::fs::canonicalize(parent)
                .map_err(|e| format!("bovenliggende map onleesbaar: {e}"))?
                .join(name)
        }
    };
    if canon.starts_with(base) {
        Ok(canon)
    } else {
        Err(format!(
            "pad ligt buiten de app-datamap: {}",
            path.display()
        ))
    }
}

/// Het OS-programma dat een map opent, met het pad als enig argument.
fn opener_command(dir: &Path) -> Command {
    #[cfg(target_os = "windows")]
    let mut command = Command::new("explorer");
    #[cfg(target_os = "macos")]
    let mut command = Command::new("open");
    #[cfg(all(unix, not(target_os = "macos")))]
    let mut command = Command::new("xdg-open");
    command.arg(dir);
    command
}

/// Open `path` in de bestandsbeheerder; weigert paden buiten de app-datamap.
#[tauri::command]
pub fn open_folder(app: tauri::AppHandle, path: String) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app-datamap onbekend: {e}"))?;
    let base = std::fs::canonicalize(&app_data).unwrap_or(app_data);
    let dir = resolve_within(&base, Path::new(&path))?;
    let mut command = opener_command(&dir);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    command
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("bestandsbeheerder starten mislukt: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binnen_app_data_mag() {
        let base = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let dir = base.join("ops-open-folder-proef");
        std::fs::create_dir_all(&dir).unwrap();
        let canon = resolve_within(&base, &dir).unwrap();
        assert!(canon.starts_with(&base));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn buiten_app_data_weigert() {
        let base = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let outside = if cfg!(target_os = "windows") { Path::new("C:\\Windows") } else { Path::new("/etc") };
        assert!(resolve_within(&base, outside).is_err());
        assert!(resolve_within(&base, Path::new("relatief/pad")).is_err());
    }

    #[test]
    fn puntje_puntje_buiten_app_data_weigert() {
        let base = std::fs::canonicalize(std::env::temp_dir()).unwrap();
        let escaping = base.join("..").join("etc");
        // `..` lost op naar buiten de base; alleen als dat pad echt bestaat wordt het
        // gecanoniceerd en geweigerd, anders valt de parent-resolutie ook buiten.
        assert!(resolve_within(&base, &escaping).is_err());
    }
}
