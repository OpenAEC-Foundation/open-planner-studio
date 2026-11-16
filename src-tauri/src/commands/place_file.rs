//! `place_file_exclusive`: één bestand exclusief onder een nieuwe naam plaatsen, in dezelfde map.
//!
//! Waarom een eigen commando (#804, knownbug 1131; ontwerp §4.10 en het besluit in §11): `rename` van
//! plugin-fs is `std::fs::rename` en vervangt een bestaand doel altijd. Wie een bestand van een ander
//! programma veilig wil vervangen, moet een stap hebben die faalt als er op de nieuwe naam al iets staat.
//! Dit commando doet precies die ene stap, met de systeemaanroep die het doel nooit vervangt:
//! Linux `renameat2` met `RENAME_NOREPLACE`, macOS `renamex_np` met `RENAME_EXCL`, Windows `MoveFileExW`
//! zonder `MOVEFILE_REPLACE_EXISTING`.
//!
//! Het is bewust geen algemene bestands-API (AGENTS.md, *Rust is thin*): niet kopiëren, niet verwijderen,
//! niet lezen, geen map maken. Het weigert alles behalve een verplaatsing binnen één echte map waarvan
//! precies één van beide namen een eigen hulpbestand is (`save-<id>.ops-save.tmp` of
//! `<naam>.ops-vorige-<id>`), binnen de scope van plugin-fs.
//!
//! Geen terugval: kent het bestandssysteem de exclusieve stap niet, dan is de uitkomst *niet
//! ondersteund* en is er niets verplaatst. Een `link()` + `unlink()` liet een bestand verdwijnen dat
//! tussen de twee aanroepen op het doel kwam (review #839, ronde 4), en "eerst kijken, dan hernoemen"
//! heeft hetzelfde venster.
//!
//! Een app-commando heeft geen permissie nodig: zonder eigen ACL-manifest laat Tauri elk commando van de
//! app toe vanuit elke webview met een lokale oorsprong (`tauri-2.12.3/src/webview/mod.rs:2076-2083`),
//! dus ook vanuit extensiecode. Alle controles staan daarom hier in de code.

use std::io;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// Een geslaagde plaatsing. Het bestand staat in beide gevallen op `to`.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum PlaceOutcome {
    /// Geplaatst en de map vastgelegd.
    Placed,
    /// Geplaatst, maar het vastleggen van de map (fsync) mislukte. Na stroomuitval kan de oude naam
    /// terug zijn; de aanroeper mag dit niet als "mislukt" behandelen, want het bestand is verplaatst.
    DirNotSynced { message: String },
}

/// Waarom het commando niets deed. De TypeScript-kant (`placeFileExclusive.ts`) kiest op `code`.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum PlaceError {
    /// Op `to` staat al iets (bestand, map of link, ook een dode link). Beide blijven onaangeroerd.
    TargetExists,
    /// Het bestandssysteem of het platform kent de exclusieve stap niet. Er is niets verplaatst.
    Unsupported { message: String },
    /// Geweigerd vóór enige wijziging.
    Refused { reason: RefusalReason },
    /// Een andere fout van het systeem, met zijn tekst. Er is niets verplaatst.
    Io { message: String },
}

/// Welke controle weigerde.
#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RefusalReason {
    /// Geen absoluut pad, geen gewone bestandsnaam, of niet dezelfde echte map.
    PathShape,
    /// Niet precies één van beide namen is een eigen hulpbestand.
    HelperName,
    /// Een pad valt buiten de scope van plugin-fs.
    Scope,
    /// `from` is geen gewoon bestand (een map of een symbolische link).
    NotRegularFile,
}

// ── De regel voor de hulpnamen, op één plek ──────────────────────────────────────────────────────
//
// `atomicWrite.ts` maakt het tijdelijke bestand als `${generateId('save')}.ops-save.tmp`; `generateId`
// (`src/utils/id.ts`) geeft `save-` + `Date.now()` in grondtal 36 + tot vier tekens uit
// `Math.random()` in grondtal 36 + een teller in cijfers. Het `<id>` is dus kleine letters en cijfers.
// De vorige versie krijgt `<naam>.ops-vorige-<id>` met hetzelfde soort `<id>` (ontwerp §4.10, stap 3).

const SAVE_TMP_PREFIX: &str = "save-";
const SAVE_TMP_SUFFIX: &str = ".ops-save.tmp";
const PREVIOUS_MARKER: &str = ".ops-vorige-";
/// Ruim boven wat `generateId` maakt (rond de 15 tekens); houdt de naam begrensd.
const MAX_HELPER_ID_LEN: usize = 64;

fn is_helper_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= MAX_HELPER_ID_LEN
        && id
            .bytes()
            .all(|b| b.is_ascii_digit() || b.is_ascii_lowercase())
}

/// Is `name` een eigen hulpbestand: `save-<id>.ops-save.tmp` of `<naam>.ops-vorige-<id>`?
fn is_helper_name(name: &str) -> bool {
    if let Some(id) = name
        .strip_prefix(SAVE_TMP_PREFIX)
        .and_then(|rest| rest.strip_suffix(SAVE_TMP_SUFFIX))
    {
        if is_helper_id(id) {
            return true;
        }
    }
    match name.rfind(PREVIOUS_MARKER) {
        Some(at) if at > 0 => is_helper_id(&name[at + PREVIOUS_MARKER.len()..]),
        _ => false,
    }
}

// ── De naad voor de proeven ──────────────────────────────────────────────────────────────────────

/// De drie systeemstappen. De proeven zetten er een eigen variant tussen om *niet ondersteund* en
/// mislukte fsyncs na te bootsen en de volgorde te zien; het commando gebruikt [`SystemOps`].
pub(crate) trait PlaceOps {
    /// Leg de inhoud van het bestand vast (fsync).
    fn sync_file(&self, path: &Path) -> io::Result<()>;
    /// Verplaats exclusief: faalt met `AlreadyExists` als er op `to` iets staat.
    fn rename_exclusive(&self, from: &Path, to: &Path) -> io::Result<()>;
    /// Leg de map vast (fsync), zodat de nieuwe naam een stroomuitval overleeft.
    fn sync_dir(&self, dir: &Path) -> io::Result<()>;
}

/// De echte systeemaanroepen.
pub(crate) struct SystemOps;

impl PlaceOps for SystemOps {
    fn sync_file(&self, path: &Path) -> io::Result<()> {
        // Windows: `sync_all` is `FlushFileBuffers`, en dat vraagt schrijfrecht op de handle.
        #[cfg(windows)]
        let file = std::fs::OpenOptions::new().write(true).open(path)?;
        #[cfg(not(windows))]
        let file = std::fs::File::open(path)?;
        file.sync_all()
    }

    fn rename_exclusive(&self, from: &Path, to: &Path) -> io::Result<()> {
        rename_exclusive_system(from, to)
    }

    fn sync_dir(&self, dir: &Path) -> io::Result<()> {
        sync_dir_system(dir)
    }
}

#[cfg(all(target_os = "linux", target_env = "gnu"))]
fn rename_exclusive_system(from: &Path, to: &Path) -> io::Result<()> {
    let (from, to) = (c_path(from)?, c_path(to)?);
    // SAFETY: beide pointers wijzen naar geldige, met NUL afgesloten C-strings die tot na de aanroep leven.
    let rc = unsafe {
        libc::renameat2(
            libc::AT_FDCWD,
            from.as_ptr(),
            libc::AT_FDCWD,
            to.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };
    if rc == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(target_os = "macos")]
fn rename_exclusive_system(from: &Path, to: &Path) -> io::Result<()> {
    let (from, to) = (c_path(from)?, c_path(to)?);
    // SAFETY: beide pointers wijzen naar geldige, met NUL afgesloten C-strings die tot na de aanroep leven.
    let rc = unsafe { libc::renamex_np(from.as_ptr(), to.as_ptr(), libc::RENAME_EXCL) };
    if rc == 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(windows)]
fn rename_exclusive_system(from: &Path, to: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};

    fn wide(path: &Path) -> Vec<u16> {
        path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect()
    }
    let (from, to) = (wide(from), wide(to));
    // Geen MOVEFILE_REPLACE_EXISTING (dan faalt het op een bestaand doel) en geen MOVEFILE_COPY_ALLOWED
    // (dan zou het tussen volumes kopiëren). MOVEFILE_WRITE_THROUGH keert pas terug als de verplaatsing
    // op schijf staat; dat is op Windows de fsync van de map.
    // SAFETY: beide pointers wijzen naar geldige, met NUL afgesloten UTF-16-strings die tot na de aanroep leven.
    let ok = unsafe { MoveFileExW(from.as_ptr(), to.as_ptr(), MOVEFILE_WRITE_THROUGH) };
    if ok != 0 {
        Ok(())
    } else {
        Err(io::Error::last_os_error())
    }
}

#[cfg(not(any(
    all(target_os = "linux", target_env = "gnu"),
    target_os = "macos",
    windows
)))]
fn rename_exclusive_system(_from: &Path, _to: &Path) -> io::Result<()> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "exclusief plaatsen kent dit platform niet",
    ))
}

#[cfg(any(all(target_os = "linux", target_env = "gnu"), target_os = "macos"))]
fn c_path(path: &Path) -> io::Result<std::ffi::CString> {
    use std::os::unix::ffi::OsStrExt;
    Ok(std::ffi::CString::new(path.as_os_str().as_bytes())?)
}

#[cfg(unix)]
fn sync_dir_system(dir: &Path) -> io::Result<()> {
    std::fs::File::open(dir)?.sync_all()
}

/// Windows: `MOVEFILE_WRITE_THROUGH` legt de verplaatsing al vast; een map is daar niet als bestand te openen.
#[cfg(not(unix))]
fn sync_dir_system(_dir: &Path) -> io::Result<()> {
    Ok(())
}

/// Systeemfouten van de exclusieve stap die betekenen: dit bestandssysteem kent hem niet.
#[cfg(unix)]
const UNSUPPORTED_CODES: &[i32] = &[libc::EINVAL, libc::ENOTSUP, libc::EOPNOTSUPP, libc::ENOSYS];
#[cfg(windows)]
const UNSUPPORTED_CODES: &[i32] = &[
    windows_sys::Win32::Foundation::ERROR_NOT_SUPPORTED as i32,
    windows_sys::Win32::Foundation::ERROR_INVALID_FUNCTION as i32,
];
#[cfg(not(any(unix, windows)))]
const UNSUPPORTED_CODES: &[i32] = &[];

fn step_error(error: io::Error) -> PlaceError {
    if error.kind() == io::ErrorKind::AlreadyExists {
        PlaceError::TargetExists
    } else if error.kind() == io::ErrorKind::Unsupported
        || error
            .raw_os_error()
            .is_some_and(|code| UNSUPPORTED_CODES.contains(&code))
    {
        PlaceError::Unsupported {
            message: error.to_string(),
        }
    } else {
        PlaceError::Io {
            message: error.to_string(),
        }
    }
}

// ── Het commando ─────────────────────────────────────────────────────────────────────────────────

/// Splits een pad in de map (letterlijk, met het laatste scheidingsteken) en een gewone bestandsnaam.
/// Op Windows telt ook `/` als scheidingsteken, zoals in `atomicWrite.ts`.
fn split_path(path: &str) -> Option<(&str, &str)> {
    if !Path::new(path).is_absolute() {
        return None;
    }
    let is_separator = |c: char| c == '/' || (cfg!(windows) && c == '\\');
    let at = path.rfind(is_separator)?;
    let (dir, name) = (&path[..=at], &path[at + 1..]);
    let plain = !name.is_empty()
        && name != "."
        && name != ".."
        && !name.contains('\0')
        // Windows: geen alternatieve gegevensstroom (`naam:stroom`) en geen stationsaanduiding.
        && !(cfg!(windows) && name.contains(':'));
    plain.then_some((dir, name))
}

/// `place_file_exclusive(from, to)`: verplaats `from` exclusief naar `to`, in dezelfde map.
///
/// Volgorde; bij de eerste weigering stopt het en is er niets veranderd:
/// 1. vorm: beide absoluut, gewone bestandsnamen, dezelfde echte map (`canonicalize`);
/// 2. precies één van beide namen is een eigen hulpbestand;
/// 3. beide paden in de scope;
/// 4. `from` is een gewoon bestand (geen link, geen map); `to` wordt niet gevolgd;
/// 5. fsync van `from`;
/// 6. de exclusieve stap;
/// 7. fsync van de map; faalt alleen deze, dan is de uitkomst [`PlaceOutcome::DirNotSynced`].
pub(crate) fn place(
    from: &str,
    to: &str,
    in_scope: &dyn Fn(&Path) -> bool,
    ops: &dyn PlaceOps,
) -> Result<PlaceOutcome, PlaceError> {
    let refused = |reason| PlaceError::Refused { reason };

    // 1. Vorm. Een map die niet te openen is, geeft dezelfde weigering zonder systeemtekst: dit gebeurt
    // vóór de scopecontrole, en mag dus niets zeggen over paden buiten de scope.
    let (from_dir, from_name) = split_path(from).ok_or(refused(RefusalReason::PathShape))?;
    let (to_dir, to_name) = split_path(to).ok_or(refused(RefusalReason::PathShape))?;
    let dir = std::fs::canonicalize(from_dir).map_err(|_| refused(RefusalReason::PathShape))?;
    let other_dir = std::fs::canonicalize(to_dir).map_err(|_| refused(RefusalReason::PathShape))?;
    if dir != other_dir {
        return Err(refused(RefusalReason::PathShape));
    }

    // 2. Precies één hulpnaam.
    if is_helper_name(from_name) == is_helper_name(to_name) {
        return Err(refused(RefusalReason::HelperName));
    }

    // Vanaf hier alleen de echte map: wat gecontroleerd is, is ook wat verplaatst wordt.
    let from_path: PathBuf = dir.join(from_name);
    let to_path: PathBuf = dir.join(to_name);

    // 3. Scope.
    if !in_scope(&from_path) || !in_scope(&to_path) {
        return Err(refused(RefusalReason::Scope));
    }

    // 4. `from` is een gewoon bestand.
    let meta = std::fs::symlink_metadata(&from_path).map_err(|e| PlaceError::Io {
        message: e.to_string(),
    })?;
    if meta.file_type().is_symlink() || !meta.is_file() {
        return Err(refused(RefusalReason::NotRegularFile));
    }

    // 5. Inhoud vastleggen vóór de naam verandert.
    ops.sync_file(&from_path).map_err(|e| PlaceError::Io {
        message: e.to_string(),
    })?;

    // 6. De exclusieve stap.
    ops.rename_exclusive(&from_path, &to_path)
        .map_err(step_error)?;

    // 7. De map vastleggen.
    match ops.sync_dir(&dir) {
        Ok(()) => Ok(PlaceOutcome::Placed),
        Err(e) => Ok(PlaceOutcome::DirNotSynced {
            message: e.to_string(),
        }),
    }
}

/// De scope zoals plugin-fs hem voor zijn eigen schrijfcommando's toetst (`resolve_path` in
/// `tauri-plugin-fs-2.5.0/src/commands.rs:1534-1566`): de scope die tijdens het draaien groeit
/// (`app.fs_scope()`, waar de bestandsdialoog en `persisted-scope` gekozen bestanden aan toevoegen) of
/// de scope uit de capability. Een app-commando krijgt die laatste niet van Tauri mee, dus hier staat
/// hetzelfde als `fs:allow-home-write-recursive` (`$HOME` en `$HOME/**`,
/// `permissions/autogenerated/base-directories/home.toml`). Met dezelfde `tauri::scope::fs::Scope`
/// gelden dezelfde globregels, ook `require_literal_leading_dot` (Unix: een map met een punt vooraan
/// telt niet mee), omdat `tauri.conf.json` voor fs niets instelt.
struct AppScope {
    scopes: Vec<tauri::scope::fs::Scope>,
}

impl AppScope {
    fn new(app: &tauri::AppHandle) -> Self {
        use tauri_plugin_fs::FsExt;
        let home = tauri::scope::fs::Scope::new(
            app,
            &tauri::utils::config::FsScope::Scope {
                allow: vec![PathBuf::from("$HOME"), PathBuf::from("$HOME/**")],
                deny: Vec::new(),
                require_literal_leading_dot: None,
            },
        )
        .ok();
        Self {
            scopes: app.try_fs_scope().into_iter().chain(home).collect(),
        }
    }

    /// Toegestaan als geen van beide het pad verbiedt en minstens één het toestaat, zoals plugin-fs.
    fn allows(&self, path: &Path) -> bool {
        !self.scopes.iter().any(|s| s.is_forbidden(path))
            && self.scopes.iter().any(|s| s.is_allowed(path))
    }
}

/// Het Tauri-commando. Het werk (fsync kan even duren) draait buiten de hoofdthread.
#[tauri::command]
pub async fn place_file_exclusive(
    app: tauri::AppHandle,
    from: String,
    to: String,
) -> Result<PlaceOutcome, PlaceError> {
    let scope = AppScope::new(&app);
    tauri::async_runtime::spawn_blocking(move || {
        place(&from, &to, &|path| scope.allows(path), &SystemOps)
    })
    .await
    .unwrap_or_else(|e| {
        Err(PlaceError::Io {
            message: e.to_string(),
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Barrier};

    const TMP: &str = "save-mhx1q2k9ab3.ops-save.tmp";
    const DOEL: &str = "doel.ifc";
    const VORIGE: &str = "doel.ifc.ops-vorige-mhx1q2k9ab3";

    static NEXT_DIR: AtomicUsize = AtomicUsize::new(0);

    /// Een eigen map in de tijdelijke map van het systeem. `path` is de gewone (niet-canonieke) vorm,
    /// zoals de app hem doorgeeft; `real` de echte map, de wortel van de scope in de proef.
    struct TempDir {
        path: PathBuf,
        real: PathBuf,
    }

    impl TempDir {
        fn new(label: &str) -> Self {
            let n = NEXT_DIR.fetch_add(1, Ordering::SeqCst);
            let path = std::env::temp_dir()
                .join(format!("ops-place-file-{}-{label}-{n}", std::process::id()));
            let _ = std::fs::remove_dir_all(&path);
            std::fs::create_dir_all(&path).unwrap();
            let real = std::fs::canonicalize(&path).unwrap();
            Self { path, real }
        }

        fn file(&self, name: &str) -> PathBuf {
            self.path.join(name)
        }

        fn write(&self, name: &str, bytes: &[u8]) -> String {
            let path = self.file(name);
            std::fs::write(&path, bytes).unwrap();
            text(&path)
        }

        fn scope(&self) -> impl Fn(&Path) -> bool {
            let root = self.real.clone();
            move |path: &Path| path.starts_with(&root)
        }
    }

    impl Drop for TempDir {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn text(path: &Path) -> String {
        path.to_str().unwrap().to_owned()
    }

    fn content(seed: u8, len: usize) -> Vec<u8> {
        (0..len)
            .map(|i| (i as u8).wrapping_mul(31).wrapping_add(seed))
            .collect()
    }

    fn refused(reason: RefusalReason) -> Result<PlaceOutcome, PlaceError> {
        Err(PlaceError::Refused { reason })
    }

    /// Volgt [`SystemOps`], legt de volgorde vast en kan elke stap laten falen.
    #[derive(Default)]
    struct Recorder {
        events: RefCell<Vec<&'static str>>,
        fail_sync_file: bool,
        rename_error: Option<fn() -> io::Error>,
        fail_sync_dir: bool,
    }

    impl PlaceOps for Recorder {
        fn sync_file(&self, path: &Path) -> io::Result<()> {
            self.events.borrow_mut().push("sync_file");
            if self.fail_sync_file {
                return Err(io::Error::other("nagebootste fout bij fsync van from"));
            }
            SystemOps.sync_file(path)
        }

        fn rename_exclusive(&self, from: &Path, to: &Path) -> io::Result<()> {
            self.events.borrow_mut().push("rename_exclusive");
            if let Some(make) = self.rename_error {
                return Err(make());
            }
            SystemOps.rename_exclusive(from, to)
        }

        fn sync_dir(&self, dir: &Path) -> io::Result<()> {
            self.events.borrow_mut().push("sync_dir");
            if self.fail_sync_dir {
                return Err(io::Error::other("nagebootste fout bij fsync van de map"));
            }
            SystemOps.sync_dir(dir)
        }
    }

    #[test]
    fn place_file_hulpnamen_volgen_generate_id() {
        // Vormen zoals `generateId('save')` ze maakt: tijd en willekeur in grondtal 36, teller in cijfers.
        assert!(is_helper_name("save-mhx1q2k9ab3.ops-save.tmp"));
        assert!(is_helper_name("save-mhx1q2k91.ops-save.tmp"));
        assert!(is_helper_name("doel.ifc.ops-vorige-mhx1q2k9ab3"));
        assert!(is_helper_name("x.ops-vorige-1"));
        assert!(!is_helper_name("doel.ifc"));
        assert!(!is_helper_name("save-.ops-save.tmp"));
        assert!(!is_helper_name("save-MHX1.ops-save.tmp"));
        assert!(!is_helper_name("save-mh_x1.ops-save.tmp"));
        assert!(!is_helper_name("save-mh-x1.ops-save.tmp"));
        assert!(!is_helper_name("doel.ifc.ops-save.tmp"));
        assert!(!is_helper_name("doel.ifc.ops-vorige-"));
        assert!(!is_helper_name(".ops-vorige-abc"));
        assert!(!is_helper_name("doel.ifc.ops-vorige-abc.ifc"));
        let te_lang = format!("save-{}.ops-save.tmp", "a".repeat(MAX_HELPER_ID_LEN + 1));
        assert!(!is_helper_name(&te_lang));
        let net_goed = format!("save-{}.ops-save.tmp", "a".repeat(MAX_HELPER_ID_LEN));
        assert!(is_helper_name(&net_goed));
    }

    #[test]
    fn place_file_uitkomsten_hebben_vaste_codes() {
        // Het contract met `src/services/fileAccess/placeFileExclusive.ts`.
        assert_eq!(json(&PlaceOutcome::Placed), r#"{"code":"placed"}"#);
        assert_eq!(
            json(&PlaceOutcome::DirNotSynced {
                message: "m".into()
            }),
            r#"{"code":"dir-not-synced","message":"m"}"#
        );
        assert_eq!(
            json(&PlaceError::TargetExists),
            r#"{"code":"target-exists"}"#
        );
        assert_eq!(
            json(&PlaceError::Unsupported {
                message: "m".into()
            }),
            r#"{"code":"unsupported","message":"m"}"#
        );
        assert_eq!(
            json(&PlaceError::Io {
                message: "m".into()
            }),
            r#"{"code":"io","message":"m"}"#
        );
        for (reason, text) in [
            (RefusalReason::PathShape, "path-shape"),
            (RefusalReason::HelperName, "helper-name"),
            (RefusalReason::Scope, "scope"),
            (RefusalReason::NotRegularFile, "not-regular-file"),
        ] {
            assert_eq!(
                json(&PlaceError::Refused { reason }),
                format!(r#"{{"code":"refused","reason":"{text}"}}"#)
            );
        }
    }

    fn json<T: Serialize>(value: &T) -> String {
        serde_json::to_string(value).unwrap()
    }

    // Proef 1.
    #[test]
    fn place_file_vrije_doelnaam_plaatst_bytegelijk() {
        let dir = TempDir::new("vrij");
        let bytes = content(7, 300_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            Ok(PlaceOutcome::Placed)
        );
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
        assert!(!dir.file(TMP).exists());

        // Andersom: het doel opzij zetten onder een `.ops-vorige`-naam (ontwerp §4.10, stap 3).
        let to = text(&dir.file(VORIGE));
        let from = text(&dir.file(DOEL));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            Ok(PlaceOutcome::Placed)
        );
        assert_eq!(std::fs::read(dir.file(VORIGE)).unwrap(), bytes);
        assert!(!dir.file(DOEL).exists());
    }

    // Proef 2.
    #[test]
    fn place_file_bestaand_doel_blijft_bytegelijk() {
        let dir = TempDir::new("bestaand");
        let nieuw = content(1, 70_000);
        let oud = content(2, 50_000);
        let from = dir.write(TMP, &nieuw);
        let to = dir.write(DOEL, &oud);
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            Err(PlaceError::TargetExists)
        );
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), oud);
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), nieuw);

        // Een map op het doel.
        let map = "map.ifc";
        std::fs::create_dir(dir.file(map)).unwrap();
        std::fs::write(dir.file(map).join("binnen.txt"), b"binnen").unwrap();
        assert_eq!(
            place(&from, &text(&dir.file(map)), &dir.scope(), &SystemOps),
            Err(PlaceError::TargetExists)
        );
        assert!(dir.file(map).is_dir());
        assert_eq!(
            std::fs::read(dir.file(map).join("binnen.txt")).unwrap(),
            b"binnen"
        );
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), nieuw);
    }

    // Proef 2, symbolische links op het doel (Unix).
    #[cfg(unix)]
    #[test]
    fn place_file_link_op_het_doel_wordt_niet_gevolgd() {
        let dir = TempDir::new("doellink");
        let nieuw = content(3, 10_000);
        let ander = content(4, 10_000);
        let from = dir.write(TMP, &nieuw);
        dir.write("ander.ifc", &ander);
        std::os::unix::fs::symlink(dir.file("ander.ifc"), dir.file(DOEL)).unwrap();
        assert_eq!(
            place(&from, &text(&dir.file(DOEL)), &dir.scope(), &SystemOps),
            Err(PlaceError::TargetExists)
        );
        assert!(std::fs::symlink_metadata(dir.file(DOEL))
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read(dir.file("ander.ifc")).unwrap(), ander);
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), nieuw);

        // Een dode link telt ook als bezet.
        let dood = "dood.ifc";
        std::os::unix::fs::symlink(dir.file("bestaat-niet"), dir.file(dood)).unwrap();
        assert_eq!(
            place(&from, &text(&dir.file(dood)), &dir.scope(), &SystemOps),
            Err(PlaceError::TargetExists)
        );
        assert!(std::fs::symlink_metadata(dir.file(dood))
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(!dir.file("bestaat-niet").exists());
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), nieuw);
    }

    // Proef 3.
    #[test]
    fn place_file_buiten_de_scope_geweigerd() {
        let dir = TempDir::new("scope");
        let bytes = content(5, 1_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));
        let from_real = dir.real.join(TMP);
        let to_real = dir.real.join(DOEL);

        let alleen_from = |p: &Path| p == from_real;
        let alleen_to = |p: &Path| p == to_real;
        let niets = |_: &Path| false;
        for scope in [&alleen_from as &dyn Fn(&Path) -> bool, &alleen_to, &niets] {
            assert_eq!(
                place(&from, &to, scope, &SystemOps),
                refused(RefusalReason::Scope)
            );
            assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
            assert!(!dir.file(DOEL).exists());
        }
    }

    // Proef 4.
    #[test]
    fn place_file_andere_map_geweigerd() {
        let dir = TempDir::new("mappen");
        std::fs::create_dir(dir.file("sub")).unwrap();
        let bytes = content(6, 1_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file("sub").join(DOEL));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            refused(RefusalReason::PathShape)
        );
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
        assert!(!dir.file("sub").join(DOEL).exists());

        // Een map die niet bestaat.
        let to = text(&dir.file("bestaat-niet").join(DOEL));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            refused(RefusalReason::PathShape)
        );
    }

    // Proef 4: dezelfde map via een andere schrijfwijze telt als dezelfde map.
    #[test]
    fn place_file_zelfde_map_andere_schrijfwijze() {
        let dir = TempDir::new("schrijfwijze");
        std::fs::create_dir(dir.file("sub")).unwrap();
        let bytes = content(8, 1_000);
        let from = dir.write(TMP, &bytes);
        // `sub/..` wijst naar dezelfde echte map.
        let sep = std::path::MAIN_SEPARATOR;
        let to = format!("{}{sep}sub{sep}..{sep}{DOEL}", text(&dir.path));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            Ok(PlaceOutcome::Placed)
        );
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
    }

    #[cfg(unix)]
    #[test]
    fn place_file_zelfde_map_via_een_link() {
        let dir = TempDir::new("maplink");
        let alias = dir.path.with_extension("alias");
        let _ = std::fs::remove_file(&alias);
        std::os::unix::fs::symlink(&dir.path, &alias).unwrap();
        let bytes = content(9, 1_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&alias.join(DOEL));
        let uitkomst = place(&from, &to, &dir.scope(), &SystemOps);
        let _ = std::fs::remove_file(&alias);
        assert_eq!(uitkomst, Ok(PlaceOutcome::Placed));
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
    }

    #[test]
    fn place_file_vorm_van_de_paden() {
        let dir = TempDir::new("vorm");
        let bytes = content(10, 100);
        let from = dir.write(TMP, &bytes);
        let sep = std::path::MAIN_SEPARATOR;
        let base = text(&dir.path);
        for to in [
            DOEL.to_owned(),
            format!("relatief{sep}{DOEL}"),
            format!("{base}{sep}"),
            format!("{base}{sep}.."),
            format!("{base}{sep}."),
            format!("{base}{sep}doel\0.ifc"),
        ] {
            assert_eq!(
                place(&from, &to, &dir.scope(), &SystemOps),
                refused(RefusalReason::PathShape),
                "{to:?}"
            );
        }
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
    }

    // Proef 5.
    #[test]
    fn place_file_hulpnaam_precies_een() {
        let dir = TempDir::new("hulpnaam");
        let bytes = content(11, 1_000);
        let cases: [(&str, &str); 6] = [
            ("bron.ifc", DOEL),                               // geen hulpnaam
            (TMP, VORIGE),                                    // twee hulpnamen
            ("save-ABC.ops-save.tmp", DOEL),                  // ongeldig <id>: hoofdletters
            ("save-a_b.ops-save.tmp", DOEL),                  // ongeldig <id>: teken
            (DOEL, "doel.ifc.ops-vorige-"),                   // leeg <id>
            ("save-.ops-save.tmp", "doel.ifc.ops-vorige-x!"), // beide ongeldig
        ];
        for (from_name, to_name) in cases {
            let from = dir.write(from_name, &bytes);
            let to = text(&dir.file(to_name));
            assert_eq!(
                place(&from, &to, &dir.scope(), &SystemOps),
                refused(RefusalReason::HelperName),
                "{from_name} -> {to_name}"
            );
            assert_eq!(std::fs::read(dir.file(from_name)).unwrap(), bytes);
            assert!(!dir.file(to_name).exists());
        }
    }

    // Proef 6.
    #[test]
    fn place_file_from_is_een_map_geweigerd() {
        let dir = TempDir::new("frommap");
        std::fs::create_dir(dir.file(TMP)).unwrap();
        let from = text(&dir.file(TMP));
        let to = text(&dir.file(DOEL));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            refused(RefusalReason::NotRegularFile)
        );
        assert!(dir.file(TMP).is_dir());
        assert!(!dir.file(DOEL).exists());
    }

    #[cfg(unix)]
    #[test]
    fn place_file_from_is_een_link_geweigerd() {
        let dir = TempDir::new("fromlink");
        let bytes = content(12, 1_000);
        dir.write("echt.ifc", &bytes);
        std::os::unix::fs::symlink(dir.file("echt.ifc"), dir.file(TMP)).unwrap();
        let from = text(&dir.file(TMP));
        let to = text(&dir.file(DOEL));
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            refused(RefusalReason::NotRegularFile)
        );
        assert!(std::fs::symlink_metadata(dir.file(TMP))
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(std::fs::read(dir.file("echt.ifc")).unwrap(), bytes);
        assert!(!dir.file(DOEL).exists());
    }

    // Proef 7.
    #[test]
    fn place_file_niet_ondersteund_verplaatst_niets() {
        let dir = TempDir::new("nietondersteund");
        let bytes = content(13, 1_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));
        let makers: [fn() -> io::Error; 2] = [
            || io::Error::from_raw_os_error(UNSUPPORTED_CODES[0]),
            || io::Error::new(io::ErrorKind::Unsupported, "nagebootst"),
        ];
        for make in makers {
            let ops = Recorder {
                rename_error: Some(make),
                ..Recorder::default()
            };
            let uitkomst = place(&from, &to, &dir.scope(), &ops);
            assert!(
                matches!(uitkomst, Err(PlaceError::Unsupported { .. })),
                "{uitkomst:?}"
            );
            assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
            assert!(!dir.file(DOEL).exists());
            assert_eq!(*ops.events.borrow(), ["sync_file", "rename_exclusive"]);
        }
        for code in UNSUPPORTED_CODES {
            assert!(matches!(
                step_error(io::Error::from_raw_os_error(*code)),
                PlaceError::Unsupported { .. }
            ));
        }
    }

    // Proef 8.
    #[test]
    fn place_file_fsync_voor_en_na_de_stap() {
        let dir = TempDir::new("fsync");
        let bytes = content(14, 1_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));

        // Faalt de eerste fsync, dan gebeurt de stap niet.
        let ops = Recorder {
            fail_sync_file: true,
            ..Recorder::default()
        };
        let uitkomst = place(&from, &to, &dir.scope(), &ops);
        assert!(
            matches!(uitkomst, Err(PlaceError::Io { .. })),
            "{uitkomst:?}"
        );
        assert_eq!(*ops.events.borrow(), ["sync_file"]);
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
        assert!(!dir.file(DOEL).exists());

        // Faalt alleen de laatste, dan is het bestand geplaatst, met een eigen uitkomst.
        let ops = Recorder {
            fail_sync_dir: true,
            ..Recorder::default()
        };
        let uitkomst = place(&from, &to, &dir.scope(), &ops);
        assert!(
            matches!(uitkomst, Ok(PlaceOutcome::DirNotSynced { .. })),
            "{uitkomst:?}"
        );
        assert_eq!(
            *ops.events.borrow(),
            ["sync_file", "rename_exclusive", "sync_dir"]
        );
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
        assert!(!dir.file(TMP).exists());

        // Het gewone geval: dezelfde volgorde.
        let from = text(&dir.file(DOEL));
        let to = text(&dir.file(VORIGE));
        let ops = Recorder::default();
        assert_eq!(
            place(&from, &to, &dir.scope(), &ops),
            Ok(PlaceOutcome::Placed)
        );
        assert_eq!(
            *ops.events.borrow(),
            ["sync_file", "rename_exclusive", "sync_dir"]
        );
    }

    // Proef 9.
    #[test]
    fn place_file_twee_tegelijk_naar_hetzelfde_doel() {
        let dir = Arc::new(TempDir::new("tegelijk"));
        for ronde in 0..100u32 {
            let doel = format!("doel-{ronde}.ifc");
            let mut namen = Vec::new();
            let mut inhoud = Vec::new();
            for kant in ["a", "b"] {
                let naam = format!("save-{kant}{ronde}.ops-save.tmp");
                let bytes = content(if kant == "a" { 21 } else { 42 }, 20_000 + ronde as usize);
                dir.write(&naam, &bytes);
                namen.push(naam);
                inhoud.push(bytes);
            }
            let barrier = Arc::new(Barrier::new(2));
            let threads: Vec<_> = namen
                .iter()
                .map(|naam| {
                    let (dir, barrier) = (Arc::clone(&dir), Arc::clone(&barrier));
                    let from = text(&dir.file(naam));
                    let to = text(&dir.file(&doel));
                    std::thread::spawn(move || {
                        barrier.wait();
                        place(&from, &to, &dir.scope(), &SystemOps)
                    })
                })
                .collect();
            let uitkomsten: Vec<_> = threads.into_iter().map(|t| t.join().unwrap()).collect();
            let winnaar = match (&uitkomsten[0], &uitkomsten[1]) {
                (Ok(PlaceOutcome::Placed), Err(PlaceError::TargetExists)) => 0,
                (Err(PlaceError::TargetExists), Ok(PlaceOutcome::Placed)) => 1,
                other => panic!("ronde {ronde}: {other:?}"),
            };
            let verliezer = 1 - winnaar;
            assert_eq!(std::fs::read(dir.file(&doel)).unwrap(), inhoud[winnaar]);
            assert!(!dir.file(&namen[winnaar]).exists());
            assert_eq!(
                std::fs::read(dir.file(&namen[verliezer])).unwrap(),
                inhoud[verliezer]
            );
        }
    }
}
