use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use tauri::Manager;

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
        Err(format!("pad ligt buiten de app-datamap: {}", path.display()))
    }
}

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
        assert!(resolve_within(&base, &escaping).is_err());
    }
}
