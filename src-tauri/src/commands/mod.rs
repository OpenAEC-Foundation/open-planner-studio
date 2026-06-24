//! Native bestand-I/O-commands — een bewuste IPC-"escape hatch".
//!
//! Deze worden NIET door de frontend gebruikt: alle bestand-I/O loopt via de
//! JS-plugins `@tauri-apps/plugin-fs` + `@tauri-apps/plugin-dialog`, en er staat
//! nergens `invoke()` in `src/`. Ze blijven bewust staan als kant-en-klare
//! native fallback voor bewerkingen die de JS-plugins niet aankunnen (zeer grote
//! bestanden streamen, eigen pad-afhandeling, OS-specifiek gedrag). Verwijder je
//! ze, verwijder dan ook deze notitie en de `serde`/`serde_json`-deps.

use std::fs;

/// Lees een UTF-8-bestand van schijf. Escape-hatch-command (zie module-docs) —
/// ongebruikt door de frontend, die bestanden leest via de JS-`plugin-fs`.
#[tauri::command]
pub fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Schrijf een UTF-8-bestand naar schijf. Escape-hatch-command (zie module-docs)
/// — ongebruikt door de frontend, die bestanden schrijft via de JS-`plugin-fs`.
#[tauri::command]
pub fn write_file(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, &contents).map_err(|e| format!("Failed to write {}: {}", path, e))
}

/// Detecteer hoe de app op deze machine geïnstalleerd is, zodat de frontend kan
/// beslissen óf en hoe de in-app updater mag werken.
///
/// Gerechtvaardigde minimale uitzondering op "geen `invoke()` in de frontend":
/// dit is pure platform-introspectie (env-read), géén domeinlogica. De frontend
/// kan zelf geen process-env lezen, vandaar deze piepkleine command.
///
/// Teruggegeven waarden:
/// - `"appimage"` — gestart vanuit een AppImage (env `APPIMAGE` gezet); updater
///   kan in-place vervangen → auto-install OK.
/// - `"snap"` — gestart binnen een Snap (env `SNAP` gezet); read-only, snapd
///   updatet zelf → in-app updater overslaan.
/// - `"deb"` — Linux zonder AppImage/Snap (vermoedelijk .deb/systeempakket);
///   Tauri-updater kan niet in-place vervangen → toon handmatige instructies.
/// - `"native"` — Windows/macOS (en overige niet-Linux): de normale updater-flow.
#[tauri::command]
pub fn install_kind() -> String {
    if cfg!(target_os = "linux") {
        if std::env::var_os("APPIMAGE").is_some() {
            "appimage".to_string()
        } else if std::env::var_os("SNAP").is_some() {
            "snap".to_string()
        } else {
            "deb".to_string()
        }
    } else {
        "native".to_string()
    }
}
