use std::path::{Path, PathBuf};

use tauri::Manager;
use tauri_plugin_opener::OpenerExt;

const BACKUP_DIR: &str = "ai-backups";

fn backup_dir(app_data: &Path) -> PathBuf {
    app_data.join(BACKUP_DIR)
}

fn ensure_existing_dir(dir: &Path) -> Result<(), String> {
    let meta = std::fs::metadata(dir).map_err(|e| format!("backupmap niet leesbaar: {e}"))?;
    if meta.is_dir() {
        Ok(())
    } else {
        Err(format!("backupmap is geen map: {}", dir.display()))
    }
}

#[tauri::command]
pub fn open_backup_folder(app: tauri::AppHandle) -> Result<(), String> {
    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app-datamap onbekend: {e}"))?;
    let dir = backup_dir(&app_data);
    ensure_existing_dir(&dir)?;
    app.opener()
        .open_path(dir.to_string_lossy().into_owned(), None::<&str>)
        .map_err(|e| format!("backupmap openen mislukt: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backup_dir_is_app_data_plus_ai_backups() {
        let dir = backup_dir(Path::new("/appdata"));
        assert_eq!(dir, PathBuf::from("/appdata").join("ai-backups"));
        assert_eq!(dir.parent(), Some(Path::new("/appdata")));
        assert_eq!(dir.file_name().and_then(|n| n.to_str()), Some("ai-backups"));
    }

    #[test]
    fn bestaande_map_mag() {
        let dir = std::env::temp_dir().join("ops-open-backup-folder-proef");
        std::fs::create_dir_all(&dir).unwrap();
        assert!(ensure_existing_dir(&dir).is_ok());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn bestand_of_ontbrekend_weigert() {
        let tmp = std::env::temp_dir().join("ops-open-backup-folder-proef-bestand");
        std::fs::write(&tmp, b"x").unwrap();
        assert!(ensure_existing_dir(&tmp).is_err());
        std::fs::remove_file(&tmp).unwrap();
        assert!(ensure_existing_dir(Path::new("/pad/bestaat-niet-12345")).is_err());
    }
}
