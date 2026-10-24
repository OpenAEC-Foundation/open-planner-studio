//! Menu-item en logo voor de AppImage (Linux).
//!
//! Een AppImage is één los bestand: anders dan het `.deb`- of `.rpm`-pakket zet niemand een
//! `.desktop`-bestand of een pictogram neer. Zonder dat staat de app niet in het startmenu en
//! toont het dock of de taakbalk een algemeen pictogram. Daarom doet de app dat bij elke start
//! zelf, alleen als hij uit een AppImage draait (env `APPIMAGE`):
//!
//! - het logo naar `<data>/icons/hicolor/256x256/apps/org.openaec.planner.png`;
//! - het menu-item naar `<data>/applications/org.openaec.planner.desktop`.
//!
//! `<data>` is `$XDG_DATA_HOME`, of `~/.local/share` als die niet (absoluut) gezet is. Alleen de
//! gebruiker zelf, geen `sudo`. Het menu-item wijst naar het pad van de AppImage; verplaatst de
//! gebruiker het bestand, dan zet de volgende start het nieuwe pad erin. `TryExec` verbergt het
//! item zolang het bestand niet op dat pad staat.
//!
//! Een bestaand `.desktop`-bestand zonder onze markering ([`MARKER`]) laat de app staan: dat heeft
//! de gebruiker of een hulpmiddel als AppImageLauncher gemaakt. `OPS_NO_DESKTOP_INTEGRATION`
//! schakelt dit helemaal uit. Fouten zijn stil: zonder menu-item werkt de app gewoon.
//!
//! Dit is geen Tauri-command (geen nieuw publiek oppervlak, zie AGENTS.md); `main` roept
//! [`integrate_appimage`] één keer aan in een eigen thread.

use std::ffi::OsStr;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// Naam van het menu-item en het pictogram: de app-id uit `tauri.conf.json`. Op Wayland gebruikt
/// GTK die id als app-id, zodat het dock het venster aan dit menu-item koppelt.
const APP_ID: &str = "org.openaec.planner";

/// Herkent een menu-item dat deze code schreef. Zonder deze regel blijft een bestaand bestand staan.
const MARKER: &str = "X-OpenPlannerStudio-AppImage=true";

/// Het logo, ingebouwd in het programma.
const ICON_PNG: &[u8] = include_bytes!("../icons/256x256.png");

/// Zet menu-item en logo neer als de app uit een AppImage draait. Doet anders niets.
pub fn integrate_appimage() {
    if std::env::var_os("OPS_NO_DESKTOP_INTEGRATION").is_some()
        || std::env::var_os("OPS_DEV_INSTANCE").is_some()
    {
        return;
    }
    let Some(appimage) = std::env::var_os("APPIMAGE").map(PathBuf::from) else {
        return;
    };
    let Some(data_home) = data_home(
        std::env::var_os("XDG_DATA_HOME").as_deref(),
        std::env::var_os("HOME").as_deref(),
    ) else {
        return;
    };
    let _ = integrate(&appimage, &data_home);
}

/// De basismap volgens de XDG-specificatie: `$XDG_DATA_HOME` als die absoluut is, anders
/// `$HOME/.local/share`. Een relatief pad telt volgens de specificatie als niet gezet.
fn data_home(xdg_data_home: Option<&OsStr>, home: Option<&OsStr>) -> Option<PathBuf> {
    if let Some(xdg) = xdg_data_home.map(Path::new).filter(|p| p.is_absolute()) {
        return Some(xdg.to_path_buf());
    }
    let home = home.map(Path::new).filter(|p| p.is_absolute())?;
    Some(home.join(".local/share"))
}

/// Schrijf logo en menu-item onder `data_home`. `Ok(false)` als er niets te doen viel.
fn integrate(appimage: &Path, data_home: &Path) -> io::Result<bool> {
    if !appimage.is_absolute() || !appimage.is_file() {
        return Ok(false);
    }
    let Some(entry) = desktop_entry(appimage) else {
        return Ok(false);
    };

    let desktop_path = data_home
        .join("applications")
        .join(format!("{APP_ID}.desktop"));
    match fs::read_to_string(&desktop_path) {
        // Niet van ons: laten staan.
        Ok(existing) if !existing.lines().any(|l| l.trim() == MARKER) => return Ok(false),
        Ok(_) => {}
        Err(e) if e.kind() == io::ErrorKind::NotFound => {}
        // Niet te lezen (bijv. geen UTF-8): ook laten staan.
        Err(_) => return Ok(false),
    }

    let icon_path = data_home
        .join("icons/hicolor/256x256/apps")
        .join(format!("{APP_ID}.png"));
    let icon_changed = write_if_changed(&icon_path, ICON_PNG)?;
    let entry_changed = write_if_changed(&desktop_path, entry.as_bytes())?;
    Ok(icon_changed || entry_changed)
}

/// De inhoud van het `.desktop`-bestand, of `None` als het pad niet in een menu-item past
/// (geen UTF-8, of een regeleinde of ander stuurteken erin).
fn desktop_entry(appimage: &Path) -> Option<String> {
    let path = appimage.to_str()?;
    if path.chars().any(char::is_control) {
        return None;
    }
    Some(format!(
        "[Desktop Entry]\n\
         Type=Application\n\
         Name=Open Planner Studio\n\
         Comment=Construction scheduling\n\
         Comment[nl]=Bouwplanning\n\
         Exec={exec}\n\
         TryExec={try_exec}\n\
         Icon={APP_ID}\n\
         Terminal=false\n\
         Categories=Office;ProjectManagement;\n\
         StartupWMClass=open-planner-studio\n\
         {MARKER}\n",
        exec = escape_string_value(&quote_exec_arg(path)),
        try_exec = escape_string_value(path),
    ))
}

/// Eén argument van `Exec` volgens de Desktop Entry-specificatie: tussen dubbele aanhalingstekens,
/// met `"`, `` ` ``, `$` en `\` voorafgegaan door een backslash. Een `%` wordt `%%`, anders leest
/// de launcher het als veldcode.
fn quote_exec_arg(arg: &str) -> String {
    let mut out = String::with_capacity(arg.len() + 2);
    out.push('"');
    for c in arg.chars() {
        match c {
            '"' | '`' | '$' | '\\' => {
                out.push('\\');
                out.push(c);
            }
            '%' => out.push_str("%%"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Een waarde van het type `string`: een backslash wordt `\\`. Stuurtekens zijn al uitgesloten.
fn escape_string_value(value: &str) -> String {
    value.replace('\\', "\\\\")
}

/// Schrijf `bytes` naar `path` als de inhoud anders is, via een tijdelijk bestand en `rename`,
/// zodat een menu nooit een half bestand leest. `Ok(true)` als er geschreven is.
fn write_if_changed(path: &Path, bytes: &[u8]) -> io::Result<bool> {
    if fs::read(path).is_ok_and(|current| current == bytes) {
        return Ok(false);
    }
    let dir = path.parent().ok_or_else(|| io::Error::other("geen map"))?;
    fs::create_dir_all(dir)?;
    let mut tmp_name = path.file_name().unwrap_or_default().to_os_string();
    tmp_name.push(format!(".{}.tmp", std::process::id()));
    let tmp = dir.join(tmp_name);
    if let Err(e) = fs::write(&tmp, bytes).and_then(|()| fs::rename(&tmp, path)) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "ops-desktop-integration-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn data_home_volgt_xdg() {
        let home = OsStr::new("/home/an");
        assert_eq!(
            data_home(Some(OsStr::new("/data")), Some(home)),
            Some(PathBuf::from("/data"))
        );
        // Relatief XDG_DATA_HOME telt als niet gezet.
        assert_eq!(
            data_home(Some(OsStr::new("data")), Some(home)),
            Some(PathBuf::from("/home/an/.local/share"))
        );
        assert_eq!(
            data_home(None, Some(home)),
            Some(PathBuf::from("/home/an/.local/share"))
        );
        assert_eq!(data_home(None, None), None);
        assert_eq!(data_home(None, Some(OsStr::new("rel"))), None);
    }

    #[test]
    fn exec_argument_is_veilig_gequote() {
        assert_eq!(quote_exec_arg("/a b/c"), "\"/a b/c\"");
        assert_eq!(
            quote_exec_arg("/x\"y`z$w\\v%u"),
            "\"/x\\\"y\\`z\\$w\\\\v%%u\""
        );
        // In het bestand wordt elke backslash nog eens verdubbeld.
        assert_eq!(
            escape_string_value(&quote_exec_arg("/a\"b")),
            "\"/a\\\\\"b\""
        );
    }

    #[test]
    fn menu_item_bevat_pad_pictogram_en_markering() {
        let entry = desktop_entry(Path::new("/home/an/Apps/Open Planner Studio.AppImage")).unwrap();
        assert!(entry.starts_with("[Desktop Entry]\n"));
        assert!(entry.contains("\nExec=\"/home/an/Apps/Open Planner Studio.AppImage\"\n"));
        assert!(entry.contains("\nTryExec=/home/an/Apps/Open Planner Studio.AppImage\n"));
        assert!(entry.contains("\nIcon=org.openaec.planner\n"));
        assert!(entry.lines().any(|l| l == MARKER));
        assert!(entry.ends_with('\n'));
        assert_eq!(desktop_entry(Path::new("/a\nb.AppImage")), None);
    }

    #[test]
    fn schrijft_bijwerkt_en_respecteert_vreemd_bestand() {
        let dir = temp_dir("schrijft");
        let appimage = dir.join("ops.AppImage");
        fs::write(&appimage, b"x").unwrap();
        let data = dir.join("share");
        let desktop = data.join("applications/org.openaec.planner.desktop");
        let icon = data.join("icons/hicolor/256x256/apps/org.openaec.planner.png");

        // Eerste start: beide bestanden komen er.
        assert!(integrate(&appimage, &data).unwrap());
        assert_eq!(fs::read(&icon).unwrap(), ICON_PNG);
        assert!(fs::read_to_string(&desktop).unwrap().contains(appimage.to_str().unwrap()));

        // Tweede start: niets te doen.
        assert!(!integrate(&appimage, &data).unwrap());

        // Verplaatste AppImage: het pad in het menu-item volgt.
        let moved = dir.join("verplaatst.AppImage");
        fs::rename(&appimage, &moved).unwrap();
        assert!(integrate(&moved, &data).unwrap());
        assert!(fs::read_to_string(&desktop).unwrap().contains("verplaatst.AppImage"));

        // Een eigen bestand van de gebruiker blijft staan.
        fs::write(&desktop, "[Desktop Entry]\nName=Eigen\n").unwrap();
        assert!(!integrate(&moved, &data).unwrap());
        assert_eq!(fs::read_to_string(&desktop).unwrap(), "[Desktop Entry]\nName=Eigen\n");

        // Geen bestand op het pad of een relatief pad: niets.
        assert!(!integrate(&dir.join("weg.AppImage"), &data).unwrap());
        assert!(!integrate(Path::new("ops.AppImage"), &data).unwrap());

        let _ = fs::remove_dir_all(&dir);
    }
}
