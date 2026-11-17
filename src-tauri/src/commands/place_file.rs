//! `place_file_exclusive`: één bestand exclusief onder een nieuwe naam plaatsen, in dezelfde map.
//!
//! Waarom een eigen commando (#804, knownbug 1131; ontwerp §4.10 en het besluit in §11): `rename` van
//! plugin-fs is `std::fs::rename` en vervangt een bestaand doel altijd. Wie een bestand van een ander
//! programma veilig wil vervangen, moet een stap hebben die faalt als er op de nieuwe naam al iets staat.
//! Dit commando doet precies die ene stap, met de systeemaanroep die het doel nooit vervangt:
//! Linux `renameat2` met `RENAME_NOREPLACE`, macOS `renameatx_np` met `RENAME_EXCL`, Windows
//! `SetFileInformationByHandle(FileRenameInfo)` zonder vervangen.
//!
//! Het is bewust geen algemene bestands-API (AGENTS.md, *Rust is thin*): niet kopiëren, niet verwijderen,
//! niet lezen, geen map maken. Het weigert alles behalve een verplaatsing binnen één map waarvan precies
//! één van beide namen een eigen hulpbestand is (`save-<id>.ops-save.tmp` of `<naam>.ops-vorige-<id>`),
//! en alleen wat plugin-fs `rename` voor deze webview ook toelaat.
//!
//! **De grens van dit commando** (besluit van de technisch beslisser, 16 november 2026; review #972).
//!
//! Eisen:
//! - nooit een bestaand doel vervangen;
//! - nooit een pad toelaten dat plugin-fs weigert (de oorspronkelijke `from`/`to`-tekst plus de echte map);
//! - een fout van de stap blijft een fout (`EEXIST` is `target-exists`, ook bij hetzelfde inode);
//! - na de stap hoogstens één verplaatsing, geen herstel.
//!
//! Buiten de grens (benoemd, knownbug 1799): op Unix kan een partij met hernoemrechten in die map tussen
//! controle en stap een ander object onder de hulpnaam zetten. Het commando meldt `source-changed` als
//! het dat achteraf ziet, en kan het missen bij een wissel-terug. Op Windows speelt dit niet.
//!
//! Waarom: op Linux en macOS hernoemt het systeem op naam, dus een strikte binding bestaat daar niet
//! zonder een omweg in twee stappen die alleen Linux heeft. Wie tussen controle en stap een object onder
//! de hulpnaam kan zetten, heeft via plugin-fs al dezelfde rechten in de thuismap. Geen `linkat`.
//!
//! Hoe: het commando toetst eerst de padteksten zoals plugin-fs `rename` (`SafeFilePath`, dan de scope
//! van `from` en daarna van `to`). Het opent de map één keer en houdt haar vast; de scope geldt ook het
//! echte pad van die open map. Het opent de bron zonder links te volgen en stelt op de open bron vast dat
//! het een gewoon bestand is. De stap gaat relatief aan de open map (Unix) of hernoemt de open bron
//! (Windows; map en bron zijn geopend zonder `FILE_SHARE_DELETE`). Daarna gaat het na dat op het doel de
//! open bron staat, in de open map en via het pad van de aanroeper. Is dat niet zo, dan geeft het
//! `source-changed` en raakt het niets meer aan; die uitkomst belooft geen stand op schijf.
//!
//! Geen terugval: kent het bestandssysteem of het platform de gebonden exclusieve stap niet, dan is de
//! uitkomst *niet ondersteund* en is er niets verplaatst. Een `link()` + `unlink()` liet een bestand
//! verdwijnen dat tussen de twee aanroepen op het doel kwam (review #839, ronde 4), en "eerst kijken,
//! dan hernoemen" heeft hetzelfde venster.
//!
//! Een app-commando heeft geen permissie nodig: zonder eigen ACL-manifest laat Tauri elk commando van de
//! app toe vanuit elke webview met een lokale oorsprong (`tauri-2.12.3/src/webview/mod.rs:2076-2083`),
//! dus ook vanuit extensiecode. Alle controles staan daarom hier in de code.

use std::fs::File;
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

/// Waarom het commando niet plaatste. De TypeScript-kant (`placeFileExclusive.ts`) kiest op `code`.
#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(tag = "code", rename_all = "kebab-case")]
pub enum PlaceError {
    /// Op `to` staat al iets (bestand, map of link, ook een dode link). Beide blijven onaangeroerd.
    TargetExists,
    /// Het bestandssysteem of het platform kent de gebonden exclusieve stap niet. Er is niets verplaatst.
    Unsupported { message: String },
    /// Geweigerd vóór enige wijziging.
    Refused { reason: RefusalReason },
    /// Na de stap stond op het doel niet de gecontroleerde bron: tussen controle en stap is de bron of
    /// de map gewisseld, of daarna het doel. Het commando raakt daarna niets meer aan en belooft geen
    /// stand op schijf: wat de stap verplaatste, kan op `to` staan of al weer weg zijn.
    SourceChanged,
    /// Een andere fout van het systeem, met zijn tekst. Er is niets verplaatst, behalve op een
    /// netwerkschijf die de fout pas meldt nadat de hernoeming gebeurde (knownbug 1795).
    Io { message: String },
}

/// Welke controle weigerde.
#[derive(Debug, PartialEq, Eq, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum RefusalReason {
    /// Geen pad dat plugin-fs aanneemt (`SafeFilePath`: geen `..`, geen URL), geen absoluut pad, geen
    /// gewone bestandsnaam, of niet dezelfde map.
    PathShape,
    /// Niet precies één van beide namen is een eigen hulpbestand.
    HelperName,
    /// Een pad valt buiten wat plugin-fs `rename` voor deze webview toelaat.
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
// De naamvorm bewijst geen eigendom; herstelcode mag dat er niet uit afleiden.

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

// ── De open map en de naad voor de proeven ───────────────────────────────────────────────────────

/// De map, één keer geopend en vastgehouden tot het eind, met haar echte pad zoals het systeem het
/// voor de open map geeft (niet een padtekst van eerder).
pub(crate) struct OpenDir {
    // Windows leest de handle niet terug: zij houdt de map alleen vast (zonder `FILE_SHARE_DELETE`).
    #[cfg_attr(windows, allow(dead_code))]
    file: File,
    real: PathBuf,
}

/// De drie stappen rond de verplaatsing. De proeven zetten er een eigen variant tussen om fouten na te
/// bootsen, de volgorde te zien en tussen controle en stap te wisselen; het commando gebruikt
/// [`SystemOps`]. De controles zelf (vorm, hulpnaam, scope, gewoon bestand, de controle na de stap)
/// zitten niet in de naad.
pub(crate) trait PlaceOps {
    /// Leg de inhoud van de open bron vast (fsync).
    fn sync_file(&self, source: &File) -> io::Result<()>;
    /// Verplaats `from` exclusief naar `to` in de open map: faalt met `AlreadyExists` als er op `to`
    /// iets staat. Unix: relatief aan de open map; Windows: via de open bron. Uitzondering op Windows
    /// (knownbug 1798): is `to` een harde link van de bron zelf, dan slaagt de stap, zonder dat een ander
    /// bestand vervangen wordt.
    fn rename_exclusive(
        &self,
        dir: &OpenDir,
        source: &File,
        from: &str,
        to: &str,
    ) -> io::Result<()>;
    /// Leg de map vast, zodat de nieuwe naam een stroomuitval overleeft.
    fn sync_dir(&self, dir: &OpenDir, source: &File) -> io::Result<()>;
}

/// De echte systeemaanroepen.
pub(crate) struct SystemOps;

impl PlaceOps for SystemOps {
    fn sync_file(&self, source: &File) -> io::Result<()> {
        source.sync_all()
    }

    fn rename_exclusive(
        &self,
        dir: &OpenDir,
        source: &File,
        from: &str,
        to: &str,
    ) -> io::Result<()> {
        sys::rename_exclusive(dir, source, from, to)
    }

    fn sync_dir(&self, dir: &OpenDir, source: &File) -> io::Result<()> {
        sys::sync_dir(dir, source)
    }
}

/// Identiteit van een bestand: apparaat en inode (Unix), volumenummer en bestandsindex (Windows).
type FileId = (u64, u64);

#[cfg(unix)]
mod sys {
    use super::{FileId, OpenDir};
    use std::ffi::CString;
    use std::fs::File;
    use std::io;
    use std::os::unix::fs::{MetadataExt, OpenOptionsExt};
    use std::os::unix::io::{AsRawFd, FromRawFd};
    use std::path::{Path, PathBuf};

    pub fn open_dir(path: &Path) -> io::Result<File> {
        std::fs::OpenOptions::new()
            .read(true)
            .custom_flags(libc::O_DIRECTORY | libc::O_CLOEXEC)
            .open(path)
    }

    pub fn file_id(file: &File) -> io::Result<FileId> {
        let meta = file.metadata()?;
        Ok((meta.dev(), meta.ino()))
    }

    pub fn id_of_path(path: &Path) -> io::Result<FileId> {
        let meta = std::fs::symlink_metadata(path)?;
        Ok((meta.dev(), meta.ino()))
    }

    #[cfg(target_os = "linux")]
    pub fn real_path(dir: &File) -> io::Result<PathBuf> {
        std::fs::read_link(format!("/proc/self/fd/{}", dir.as_raw_fd()))
    }

    #[cfg(target_os = "macos")]
    pub fn real_path(dir: &File) -> io::Result<PathBuf> {
        use std::os::unix::ffi::OsStringExt;
        let mut buf = vec![0u8; libc::MAXPATHLEN as usize];
        // SAFETY: F_GETPATH schrijft hoogstens MAXPATHLEN bytes, met NUL, in de buffer.
        let rc = unsafe { libc::fcntl(dir.as_raw_fd(), libc::F_GETPATH, buf.as_mut_ptr()) };
        if rc == -1 {
            return Err(io::Error::last_os_error());
        }
        let len = buf.iter().position(|&b| b == 0).unwrap_or(buf.len());
        buf.truncate(len);
        Ok(PathBuf::from(std::ffi::OsString::from_vec(buf)))
    }

    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    pub fn real_path(_dir: &File) -> io::Result<PathBuf> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "het echte pad van een open map kent dit platform niet",
        ))
    }

    /// Open de bron in de open map zonder een link te volgen (`O_NOFOLLOW`); `O_NONBLOCK` zodat een
    /// fifo niet blijft hangen (die wordt daarna als geen gewoon bestand geweigerd).
    pub fn open_source(dir: &OpenDir, name: &str) -> io::Result<File> {
        let name = CString::new(name)?;
        // SAFETY: geldige map-descriptor en een met NUL afgesloten naam die tot na de aanroep leeft.
        let fd = unsafe {
            libc::openat(
                dir.file.as_raw_fd(),
                name.as_ptr(),
                libc::O_RDONLY | libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_CLOEXEC,
            )
        };
        if fd < 0 {
            return Err(io::Error::last_os_error());
        }
        // SAFETY: `fd` is net geopend en van niemand anders.
        Ok(unsafe { File::from_raw_fd(fd) })
    }

    /// `O_NOFOLLOW` op een symbolische link geeft `ELOOP`.
    pub fn is_link_refusal(error: &io::Error) -> bool {
        error.raw_os_error() == Some(libc::ELOOP)
    }

    pub fn is_regular(file: &File) -> io::Result<bool> {
        Ok(file.metadata()?.file_type().is_file())
    }

    pub fn id_in_dir(dir: &OpenDir, name: &str) -> io::Result<FileId> {
        let name = CString::new(name)?;
        // SAFETY: `stat` is een gewone C-struct; nul is een geldige beginwaarde.
        let mut st: libc::stat = unsafe { std::mem::zeroed() };
        // SAFETY: geldige map-descriptor, naam en uitvoerbuffer.
        let rc = unsafe {
            libc::fstatat(
                dir.file.as_raw_fd(),
                name.as_ptr(),
                &mut st,
                libc::AT_SYMLINK_NOFOLLOW,
            )
        };
        if rc != 0 {
            return Err(io::Error::last_os_error());
        }
        Ok((st.st_dev as u64, st.st_ino as u64))
    }

    #[cfg(all(target_os = "linux", target_env = "gnu"))]
    pub fn rename_exclusive(dir: &OpenDir, _source: &File, from: &str, to: &str) -> io::Result<()> {
        let (from, to) = (CString::new(from)?, CString::new(to)?);
        let fd = dir.file.as_raw_fd();
        // SAFETY: geldige map-descriptor; beide namen zijn met NUL afgesloten en leven tot na de aanroep.
        let rc =
            unsafe { libc::renameat2(fd, from.as_ptr(), fd, to.as_ptr(), libc::RENAME_NOREPLACE) };
        if rc == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }

    #[cfg(target_os = "macos")]
    pub fn rename_exclusive(dir: &OpenDir, _source: &File, from: &str, to: &str) -> io::Result<()> {
        let (from, to) = (CString::new(from)?, CString::new(to)?);
        let fd = dir.file.as_raw_fd();
        // SAFETY: geldige map-descriptor; beide namen zijn met NUL afgesloten en leven tot na de aanroep.
        let rc =
            unsafe { libc::renameatx_np(fd, from.as_ptr(), fd, to.as_ptr(), libc::RENAME_EXCL) };
        if rc == 0 {
            Ok(())
        } else {
            Err(io::Error::last_os_error())
        }
    }

    #[cfg(not(any(all(target_os = "linux", target_env = "gnu"), target_os = "macos")))]
    pub fn rename_exclusive(
        _dir: &OpenDir,
        _source: &File,
        _from: &str,
        _to: &str,
    ) -> io::Result<()> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "exclusief plaatsen kent dit platform niet",
        ))
    }

    /// De open map vastleggen (fsync op de map-descriptor).
    pub fn sync_dir(dir: &OpenDir, _source: &File) -> io::Result<()> {
        dir.file.sync_all()
    }

    /// Systeemfouten van de exclusieve stap die betekenen: dit bestandssysteem kent hem niet.
    pub const UNSUPPORTED_CODES: &[i32] =
        &[libc::EINVAL, libc::ENOTSUP, libc::EOPNOTSUPP, libc::ENOSYS];
}

#[cfg(windows)]
mod sys {
    //! Windows heeft geen `openat`. De binding komt hier uit de deelmodus: de map en de bron worden
    //! geopend zonder `FILE_SHARE_DELETE`, dus zolang het commando ze vasthoudt, kan niemand ze
    //! hernoemen of verplaatsen (een hernoeming vraagt toegang `DELETE`, en die deelt niemand). Een map
    //! met een open bestand erin is ook niet te verplaatsen. Het echte pad van de open map blijft dus
    //! kloppen. De stap hernoemt de open bron zelf (`SetFileInformationByHandle`, `FileRenameInfo`,
    //! `ReplaceIfExists` onwaar): wat verplaatst wordt, is precies het geopende bestand.
    use super::{FileId, OpenDir};
    use std::fs::File;
    use std::io;
    use std::os::windows::ffi::{OsStrExt, OsStringExt};
    use std::os::windows::fs::OpenOptionsExt;
    use std::os::windows::io::AsRawHandle;
    use std::path::{Path, PathBuf};
    use windows_sys::Win32::Foundation::{GENERIC_READ, GENERIC_WRITE};
    use windows_sys::Win32::Storage::FileSystem::{
        FileRenameInfo, GetFileInformationByHandle, GetFinalPathNameByHandleW,
        SetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, DELETE, FILE_ATTRIBUTE_DIRECTORY,
        FILE_ATTRIBUTE_REPARSE_POINT, FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT,
        FILE_NAME_NORMALIZED, FILE_READ_ATTRIBUTES, FILE_RENAME_INFO, FILE_SHARE_DELETE,
        FILE_SHARE_READ, FILE_SHARE_WRITE, VOLUME_NAME_DOS,
    };

    fn info(file: &File) -> io::Result<BY_HANDLE_FILE_INFORMATION> {
        let mut info = BY_HANDLE_FILE_INFORMATION::default();
        // SAFETY: geldige handle en een uitvoerstruct van de juiste grootte.
        let ok = unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) };
        if ok == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(info)
        }
    }

    fn id(info: &BY_HANDLE_FILE_INFORMATION) -> FileId {
        (
            u64::from(info.dwVolumeSerialNumber),
            (u64::from(info.nFileIndexHigh) << 32) | u64::from(info.nFileIndexLow),
        )
    }

    pub fn open_dir(path: &Path) -> io::Result<File> {
        let file = std::fs::OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_BACKUP_SEMANTICS)
            .open(path)?;
        if info(&file)?.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY == 0 {
            return Err(io::Error::new(io::ErrorKind::NotADirectory, "geen map"));
        }
        Ok(file)
    }

    pub fn file_id(file: &File) -> io::Result<FileId> {
        Ok(id(&info(file)?))
    }

    /// Open zonder een link te volgen en zonder iets te verhinderen, alleen om de identiteit te lezen.
    pub fn id_of_path(path: &Path) -> io::Result<FileId> {
        let file = std::fs::OpenOptions::new()
            .access_mode(FILE_READ_ATTRIBUTES)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
            .open(path)?;
        file_id(&file)
    }

    pub fn real_path(dir: &File) -> io::Result<PathBuf> {
        let mut buf = vec![0u16; 512];
        loop {
            // SAFETY: geldige handle; de buffer is `buf.len()` tekens groot.
            let len = unsafe {
                GetFinalPathNameByHandleW(
                    dir.as_raw_handle(),
                    buf.as_mut_ptr(),
                    buf.len() as u32,
                    FILE_NAME_NORMALIZED | VOLUME_NAME_DOS,
                )
            } as usize;
            if len == 0 {
                return Err(io::Error::last_os_error());
            }
            if len < buf.len() {
                buf.truncate(len);
                return Ok(PathBuf::from(std::ffi::OsString::from_wide(&buf)));
            }
            buf.resize(len + 1, 0);
        }
    }

    /// Open de bron zonder een link te volgen, met `DELETE` (voor de hernoeming via deze handle) en
    /// schrijfrecht (`FlushFileBuffers`), en zonder `FILE_SHARE_DELETE`, zodat niemand haar tussen
    /// controle en stap kan wegzetten.
    pub fn open_source(dir: &OpenDir, name: &str) -> io::Result<File> {
        std::fs::OpenOptions::new()
            .access_mode(GENERIC_READ | GENERIC_WRITE | DELETE)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT | FILE_FLAG_BACKUP_SEMANTICS)
            .open(dir.real.join(name))
    }

    /// Een link wordt zelf geopend (`FILE_FLAG_OPEN_REPARSE_POINT`) en daarna aan haar kenmerk geweigerd.
    pub fn is_link_refusal(_error: &io::Error) -> bool {
        false
    }

    pub fn is_regular(file: &File) -> io::Result<bool> {
        let attributes = info(file)?.dwFileAttributes;
        Ok(attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT) == 0)
    }

    pub fn id_in_dir(dir: &OpenDir, name: &str) -> io::Result<FileId> {
        id_of_path(&dir.real.join(name))
    }

    /// Hernoem de open bron naar `to` in de vastgehouden map, zonder te vervangen: een bezet doel geeft
    /// `ERROR_ALREADY_EXISTS`. `from` is hier de naam van de open bron en wordt niet opnieuw opgezocht.
    pub fn rename_exclusive(dir: &OpenDir, source: &File, _from: &str, to: &str) -> io::Result<()> {
        let name: Vec<u16> = dir.real.join(to).as_os_str().encode_wide().collect();
        let name_bytes = name.len() * std::mem::size_of::<u16>();
        // De struct eindigt op `FileName: [u16; 1]`; die ene plaats is de afsluitende NUL.
        let size = std::mem::size_of::<FILE_RENAME_INFO>() + name_bytes;
        let mut buf = vec![0u64; size.div_ceil(std::mem::size_of::<u64>())];
        let info = buf.as_mut_ptr().cast::<FILE_RENAME_INFO>();
        // SAFETY: de buffer is nul-geïnitialiseerd (dus `ReplaceIfExists` onwaar en de NUL aan het
        // eind), groot genoeg, en uitgelijnd op 8 bytes, genoeg voor `FILE_RENAME_INFO`.
        unsafe {
            (*info).RootDirectory = std::ptr::null_mut();
            (*info).FileNameLength = name_bytes as u32;
            std::ptr::copy_nonoverlapping(
                name.as_ptr(),
                std::ptr::addr_of_mut!((*info).FileName).cast::<u16>(),
                name.len(),
            );
        }
        // SAFETY: geldige handle met `DELETE`; de buffer is `size` bytes groot.
        let ok = unsafe {
            SetFileInformationByHandle(
                source.as_raw_handle(),
                FileRenameInfo,
                info.cast_const().cast::<core::ffi::c_void>(),
                size as u32,
            )
        };
        if ok == 0 {
            Err(io::Error::last_os_error())
        } else {
            Ok(())
        }
    }

    /// `FlushFileBuffers` op de open bron na de hernoeming. Een map is op Windows niet als bestand vast
    /// te leggen; of dit de nieuwe naam bij stroomuitval vasthoudt, is niet met een proef bewezen.
    pub fn sync_dir(_dir: &OpenDir, source: &File) -> io::Result<()> {
        source.sync_all()
    }

    /// Systeemfouten van de exclusieve stap die betekenen: dit bestandssysteem kent hem niet.
    pub const UNSUPPORTED_CODES: &[i32] = &[
        windows_sys::Win32::Foundation::ERROR_NOT_SUPPORTED as i32,
        windows_sys::Win32::Foundation::ERROR_INVALID_FUNCTION as i32,
    ];
}

#[cfg(not(any(unix, windows)))]
mod sys {
    use super::{FileId, OpenDir};
    use std::fs::File;
    use std::io;
    use std::path::{Path, PathBuf};

    fn unsupported<T>() -> io::Result<T> {
        Err(io::Error::new(
            io::ErrorKind::Unsupported,
            "exclusief plaatsen kent dit platform niet",
        ))
    }
    pub fn open_dir(_: &Path) -> io::Result<File> {
        unsupported()
    }
    pub fn file_id(_: &File) -> io::Result<FileId> {
        unsupported()
    }
    pub fn id_of_path(_: &Path) -> io::Result<FileId> {
        unsupported()
    }
    pub fn real_path(_: &File) -> io::Result<PathBuf> {
        unsupported()
    }
    pub fn open_source(_: &OpenDir, _: &str) -> io::Result<File> {
        unsupported()
    }
    pub fn is_link_refusal(_: &io::Error) -> bool {
        false
    }
    pub fn is_regular(_: &File) -> io::Result<bool> {
        unsupported()
    }
    pub fn id_in_dir(_: &OpenDir, _: &str) -> io::Result<FileId> {
        unsupported()
    }
    pub fn rename_exclusive(_: &OpenDir, _: &File, _: &str, _: &str) -> io::Result<()> {
        unsupported()
    }
    pub fn sync_dir(_: &OpenDir, _: &File) -> io::Result<()> {
        unsupported()
    }
    pub const UNSUPPORTED_CODES: &[i32] = &[];
}

use sys::UNSUPPORTED_CODES;

fn io_error(error: io::Error) -> PlaceError {
    PlaceError::Io {
        message: error.to_string(),
    }
}

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
        io_error(error)
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

/// Een padtekst die plugin-fs `rename` als `SafeFilePath::Path` aanneemt (dezelfde ontleding, ook de
/// weigering van `..` door `SafePathBuf`), gesplitst door [`split_path`].
fn plain_path(path: &str) -> Option<(&str, &str)> {
    use std::str::FromStr;
    match tauri_plugin_fs::SafeFilePath::from_str(path).ok()? {
        tauri_plugin_fs::SafeFilePath::Path(_) => split_path(path),
        tauri_plugin_fs::SafeFilePath::Url(_) => None,
    }
}

/// `place_file_exclusive(from, to)`: verplaats `from` exclusief naar `to`, in dezelfde map.
///
/// Volgorde; bij de eerste weigering stopt het en is er niets veranderd:
/// 1. de padteksten zoals plugin-fs ze aanneemt (`SafeFilePath`), absoluut, gewone bestandsnamen;
/// 2. de padteksten in de scope, zoals plugin-fs `rename`: eerst `from`, dan `to`;
/// 3. de map van `from` geopend en vastgehouden, en die van `to` is dezelfde open map;
/// 4. precies één van beide namen is een eigen hulpbestand;
/// 5. beide paden in de scope, ook op het echte pad van de open map;
/// 6. de bron, geopend in de open map zonder links te volgen, is een gewoon bestand;
/// 7. fsync van de open bron;
/// 8. de exclusieve stap; een fout blijft een fout;
/// 9. controle: op het doel staat nu de open bron, in de open map én via het pad van de aanroeper;
///    anders [`PlaceError::SourceChanged`], zonder verdere stap;
/// 10. fsync van de map; faalt alleen deze, dan is de uitkomst [`PlaceOutcome::DirNotSynced`].
pub(crate) fn place(
    from: &str,
    to: &str,
    in_scope: &dyn Fn(&Path) -> bool,
    ops: &dyn PlaceOps,
) -> Result<PlaceOutcome, PlaceError> {
    let refused = |reason| PlaceError::Refused { reason };

    // 1. De padteksten, zoals plugin-fs `rename` ze als `SafeFilePath` aanneemt: geen `..`
    // (`SafePathBuf`). Een URL neemt dit commando niet aan.
    let (from_dir, from_name) = plain_path(from).ok_or(refused(RefusalReason::PathShape))?;
    let (to_dir, to_name) = plain_path(to).ok_or(refused(RefusalReason::PathShape))?;

    // 2. De scope op de padteksten van de aanroeper, in de volgorde van plugin-fs `rename`. Een doel dat
    // nog niet bestaat, maakt Tauri niet canoniek: een link in de map telt dus mee zoals hij er staat.
    if !in_scope(Path::new(from)) || !in_scope(Path::new(to)) {
        return Err(refused(RefusalReason::Scope));
    }

    // 3. Dezelfde map, één keer geopend. Een map die niet te openen is, geeft dezelfde weigering
    // zonder systeemtekst.
    let shape = |_| refused(RefusalReason::PathShape);
    let dir = sys::open_dir(Path::new(from_dir)).map_err(shape)?;
    let dir_id = sys::file_id(&dir).map_err(shape)?;
    let other_id = sys::open_dir(Path::new(to_dir))
        .and_then(|other| sys::file_id(&other))
        .map_err(shape)?;
    if dir_id != other_id {
        return Err(refused(RefusalReason::PathShape));
    }

    // 4. Precies één hulpnaam.
    if is_helper_name(from_name) == is_helper_name(to_name) {
        return Err(refused(RefusalReason::HelperName));
    }

    // 5. De scope ook op het echte pad van de open map.
    let real = sys::real_path(&dir).map_err(|e| PlaceError::Unsupported {
        message: e.to_string(),
    })?;
    let dir = OpenDir { file: dir, real };
    if !in_scope(&dir.real.join(from_name)) || !in_scope(&dir.real.join(to_name)) {
        return Err(refused(RefusalReason::Scope));
    }

    // 6. De bron, geopend in de open map zonder links te volgen, is een gewoon bestand.
    let source = sys::open_source(&dir, from_name).map_err(|e| {
        if sys::is_link_refusal(&e) {
            refused(RefusalReason::NotRegularFile)
        } else {
            io_error(e)
        }
    })?;
    if !sys::is_regular(&source).map_err(io_error)? {
        return Err(refused(RefusalReason::NotRegularFile));
    }
    let source_id = sys::file_id(&source).map_err(io_error)?;

    // 7. Inhoud vastleggen vóór de naam verandert.
    ops.sync_file(&source).map_err(io_error)?;

    // 8. De exclusieve stap. Een fout blijft een fout, ook als op het doel hetzelfde inode staat (een
    // harde link): dan is er niets verplaatst. Een netwerkschijf kan de fout pas geven nadat de
    // hernoeming gebeurde; dat vangt het commando niet (knownbug 1795).
    ops.rename_exclusive(&dir, &source, from_name, to_name)
        .map_err(step_error)?;

    // 9. Staat op het doel de gecontroleerde bron, in de open map én waar de aanroeper kijkt? Zo niet,
    // dan geen tweede stap: die zou op naam werken en kan een ander bestand raken (knownbug 1799).
    let in_dir = sys::id_in_dir(&dir, to_name).ok() == Some(source_id);
    let at_caller = sys::id_of_path(Path::new(to)).ok() == Some(source_id);
    if !(in_dir && at_caller) {
        return Err(PlaceError::SourceChanged);
    }

    // 10. De map vastleggen.
    match ops.sync_dir(&dir, &source) {
        Ok(()) => Ok(PlaceOutcome::Placed),
        Err(e) => Ok(PlaceOutcome::DirNotSynced {
            message: e.to_string(),
        }),
    }
}

// ── De scope: die van plugin-fs `rename`, niet nagebouwd ─────────────────────────────────────────

/// Eén scope-item van plugin-fs. Zijn eigen type (`scope::Entry`) is privé
/// (`tauri-plugin-fs-2.5.0/src/lib.rs:39`); dit is dezelfde vorm met dezelfde omzetting
/// (`lib.rs:356-375`): een pad of `{ path }`, met `$HOME`, `$APPLOCALDATA` en dergelijke opgelost door
/// `PathResolver::parse` van Tauri, en `None` voor een basismap die dit systeem niet kent.
#[derive(Debug)]
struct FsScopeEntry {
    path: Option<PathBuf>,
}

#[derive(serde::Deserialize)]
#[serde(untagged)]
enum FsScopeEntryRaw {
    Value(PathBuf),
    Object { path: PathBuf },
}

impl tauri::ipc::ScopeObject for FsScopeEntry {
    type Error = io::Error;

    fn deserialize<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        raw: tauri::utils::acl::Value,
    ) -> Result<Self, Self::Error> {
        use tauri::Manager;
        let raw: FsScopeEntryRaw = serde_json::from_value(raw.into()).map_err(io::Error::other)?;
        let path = match raw {
            FsScopeEntryRaw::Value(path) | FsScopeEntryRaw::Object { path } => path,
        };
        match app.path().parse(path) {
            Ok(path) => Ok(Self { path: Some(path) }),
            Err(tauri::Error::UnknownPath) => Ok(Self { path: None }),
            Err(error) => Err(io::Error::other(error.to_string())),
        }
    }
}

/// Wat plugin-fs `rename` voor deze webview toelaat, met dezelfde regel als `resolve_path` in
/// `tauri-plugin-fs-2.5.0/src/commands.rs:1528-1570`: de toegestane en verboden paden van de capability
/// (globaal en voor het commando, via [`tauri::Webview::resolve_command_scope`]) in één scope, naast de
/// scope die tijdens het draaien groeit (`fs_scope()`: de bestandsdialoog en `persisted-scope`). Een
/// verbod in een van beide wint; daarna moet een van beide het pad toestaan.
pub(crate) struct FsRenameScope {
    runtime: Option<tauri::scope::fs::Scope>,
    configured: tauri::scope::fs::Scope,
}

impl FsRenameScope {
    /// `None` als de capability `rename` van plugin-fs voor deze webview niet toelaat.
    pub(crate) fn new<R: tauri::Runtime>(webview: &tauri::Webview<R>) -> Option<Self> {
        use tauri::Manager;
        use tauri_plugin_fs::FsExt;
        let resolved = webview
            .resolve_command_scope::<FsScopeEntry>("fs", "rename")
            .ok()??;
        let paths = |entries: &Vec<std::sync::Arc<FsScopeEntry>>| -> Vec<PathBuf> {
            entries.iter().filter_map(|e| e.path.clone()).collect()
        };
        let mut allow = paths(resolved.global_scope().allows());
        allow.extend(paths(resolved.command_scope().allows()));
        let mut deny = paths(resolved.global_scope().denies());
        deny.extend(paths(resolved.command_scope().denies()));
        // plugin-fs neemt `requireLiteralLeadingDot` uit zijn eigen config (`plugins.fs`).
        let require_literal_leading_dot = webview
            .config()
            .plugins
            .0
            .get("fs")
            .and_then(|fs| fs.get("requireLiteralLeadingDot"))
            .and_then(|value| value.as_bool());
        let configured = tauri::scope::fs::Scope::new(
            webview,
            &tauri::utils::config::FsScope::Scope {
                allow,
                deny,
                require_literal_leading_dot,
            },
        )
        .ok()?;
        Some(Self {
            runtime: webview.try_fs_scope(),
            configured,
        })
    }

    pub(crate) fn allows(&self, path: &Path) -> bool {
        let scopes: Vec<&tauri::scope::fs::Scope> =
            self.runtime.iter().chain([&self.configured]).collect();
        !scopes.iter().any(|scope| scope.is_forbidden(path))
            && scopes.iter().any(|scope| scope.is_allowed(path))
    }
}

/// Het Tauri-commando. Het werk (fsync kan even duren) draait buiten de hoofdthread.
#[tauri::command]
pub async fn place_file_exclusive<R: tauri::Runtime>(
    webview: tauri::Webview<R>,
    from: String,
    to: String,
) -> Result<PlaceOutcome, PlaceError> {
    let scope = FsRenameScope::new(&webview);
    tauri::async_runtime::spawn_blocking(move || {
        let in_scope = |path: &Path| scope.as_ref().is_some_and(|scope| scope.allows(path));
        place(&from, &to, &in_scope, &SystemOps)
    })
    .await
    .unwrap_or_else(|e| Err(io_error(io::Error::other(e.to_string()))))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::{Cell, RefCell};
    use std::rc::Rc;
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

        /// De naad voor de scope: alles onder de map van de proef, in de gewone en de echte schrijfwijze
        /// (macOS: `/var` en `/private/var`). De echte scope van plugin-fs toetsen
        /// `place_file_scope_volgt_plugin_fs` en `place_file_weigert_wat_plugin_fs_weigert`.
        fn scope(&self) -> impl Fn(&Path) -> bool {
            let roots = [self.path.clone(), self.real.clone()];
            move |path: &Path| roots.iter().any(|root| path.starts_with(root))
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

    fn exists(path: &Path) -> bool {
        std::fs::symlink_metadata(path).is_ok()
    }

    /// Volgt [`SystemOps`], legt de volgorde vast, kan elke stap laten falen en kan vlak vóór de eerste
    /// stap iets wisselen (na alle controles, vóór de echte systeemaanroep).
    #[derive(Default)]
    struct Recorder {
        events: RefCell<Vec<&'static str>>,
        fail_sync_file: bool,
        rename_error: Option<fn() -> io::Error>,
        error_after_rename: bool,
        before_rename: RefCell<Option<Box<dyn FnOnce()>>>,
        after_rename: RefCell<Option<Box<dyn FnOnce()>>>,
        fail_sync_dir: bool,
    }

    impl PlaceOps for Recorder {
        fn sync_file(&self, source: &File) -> io::Result<()> {
            self.events.borrow_mut().push("sync_file");
            if self.fail_sync_file {
                return Err(io::Error::other("nagebootste fout bij fsync van from"));
            }
            SystemOps.sync_file(source)
        }

        fn rename_exclusive(
            &self,
            dir: &OpenDir,
            source: &File,
            from: &str,
            to: &str,
        ) -> io::Result<()> {
            self.events.borrow_mut().push("rename_exclusive");
            let hook = self.before_rename.borrow_mut().take();
            if let Some(hook) = hook {
                hook();
            }
            if let Some(make) = self.rename_error {
                return Err(make());
            }
            let result = SystemOps.rename_exclusive(dir, source, from, to);
            if result.is_ok() {
                let hook = self.after_rename.borrow_mut().take();
                if let Some(hook) = hook {
                    hook();
                }
            }
            if self.error_after_rename && result.is_ok() {
                return Err(io::Error::other("nagebootste fout na de hernoeming"));
            }
            result
        }

        fn sync_dir(&self, dir: &OpenDir, source: &File) -> io::Result<()> {
            self.events.borrow_mut().push("sync_dir");
            if self.fail_sync_dir {
                return Err(io::Error::other("nagebootste fout bij fsync van de map"));
            }
            SystemOps.sync_dir(dir, source)
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
        assert_eq!(
            json(&PlaceError::SourceChanged),
            r#"{"code":"source-changed"}"#
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

    // Review #972 ronde 2, blokkade 3: `sub/..` wijst naar dezelfde echte map, maar plugin-fs neemt zo'n
    // padtekst niet aan (`SafePathBuf`), dus dit commando ook niet.
    #[test]
    fn place_file_ouderverwijzing_geweigerd() {
        use std::str::FromStr;
        let dir = TempDir::new("schrijfwijze");
        std::fs::create_dir(dir.file("sub")).unwrap();
        let bytes = content(8, 1_000);
        let from = dir.write(TMP, &bytes);
        let sep = std::path::MAIN_SEPARATOR;
        let to = format!("{}{sep}sub{sep}..{sep}{DOEL}", text(&dir.path));
        assert!(tauri_plugin_fs::SafeFilePath::from_str(&to).is_err());
        assert_eq!(
            place(&from, &to, &dir.scope(), &SystemOps),
            refused(RefusalReason::PathShape)
        );
        assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
        assert!(!exists(&dir.file(DOEL)));
    }

    #[cfg(unix)]
    #[test]
    fn place_file_zelfde_map_via_een_link() {
        // Een link in de map van de proef naar die map zelf: de padtekst valt in de scope.
        let dir = TempDir::new("maplink");
        let alias = dir.file("alias");
        std::os::unix::fs::symlink(&dir.path, &alias).unwrap();
        let bytes = content(9, 1_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&alias.join(DOEL));
        let uitkomst = place(&from, &to, &dir.scope(), &SystemOps);
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

    // Blokkade 2 van de review van #972, scenario a: de gecontroleerde bron gaat opzij en een map krijgt
    // haar naam, tussen de controles en de echte systeemstap.
    #[test]
    fn place_file_bronwissel_tussen_controle_en_stap() {
        let dir = TempDir::new("bronwissel");
        let bytes = content(31, 5_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));
        let (bron, opzij) = (dir.file(TMP), dir.file("opzij.bin"));
        let gewisseld = Rc::new(Cell::new(false));
        let vlag = Rc::clone(&gewisseld);
        let ops = Recorder {
            before_rename: RefCell::new(Some(Box::new(move || {
                // Windows: de open bron is niet weg te zetten (geopend zonder FILE_SHARE_DELETE).
                if std::fs::rename(&bron, &opzij).is_ok() {
                    std::fs::create_dir(&bron).unwrap();
                    std::fs::write(bron.join("binnen.txt"), b"binnen").unwrap();
                    vlag.set(true);
                }
            }))),
            ..Recorder::default()
        };
        let uitkomst = place(&from, &to, &dir.scope(), &ops);
        if gewisseld.get() {
            // Unix hernoemt op naam: de stap verplaatste de map die nu onder de hulpnaam stond. Het
            // commando ziet dat en zet niets terug (knownbug 1799).
            assert_eq!(uitkomst, Err(PlaceError::SourceChanged));
            assert!(dir.file(DOEL).is_dir());
            assert_eq!(
                std::fs::read(dir.file(DOEL).join("binnen.txt")).unwrap(),
                b"binnen"
            );
            assert!(!exists(&dir.file(TMP)));
            assert_eq!(std::fs::read(dir.file("opzij.bin")).unwrap(), bytes);
        } else {
            assert_eq!(uitkomst, Ok(PlaceOutcome::Placed));
            assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
        }
        assert_eq!(
            cfg!(unix),
            gewisseld.get(),
            "wissel gelukt: {}",
            gewisseld.get()
        );
    }

    // Blokkade 2, scenario b: de oudermap gaat opzij en haar naam wordt een link naar een andere map.
    #[test]
    fn place_file_mapwissel_tussen_controle_en_stap() {
        let dir = TempDir::new("mapwissel");
        let (werk, ander, opzij) = (dir.file("werk"), dir.file("ander"), dir.file("werk-opzij"));
        std::fs::create_dir(&werk).unwrap();
        std::fs::create_dir(&ander).unwrap();
        let bytes = content(32, 5_000);
        std::fs::write(werk.join(TMP), &bytes).unwrap();
        std::fs::write(ander.join("ander.txt"), b"ander").unwrap();
        let from = text(&werk.join(TMP));
        let to = text(&werk.join(DOEL));
        let gewisseld = Rc::new(Cell::new(false));
        let vlag = Rc::clone(&gewisseld);
        let (w, a, o) = (werk.clone(), ander.clone(), opzij.clone());
        let ops = Recorder {
            before_rename: RefCell::new(Some(Box::new(move || {
                // Windows: de open map is niet te verplaatsen (geopend zonder FILE_SHARE_DELETE).
                if std::fs::rename(&w, &o).is_ok() {
                    #[cfg(unix)]
                    std::os::unix::fs::symlink(&a, &w).unwrap();
                    let _ = &a;
                    vlag.set(true);
                }
            }))),
            ..Recorder::default()
        };
        let uitkomst = place(&from, &to, &dir.scope(), &ops);
        if gewisseld.get() {
            // De stap ging in de open map (nu `werk-opzij`); via het pad van de aanroeper staat de bron
            // niet op het doel. Niets teruggezet: de bron staat op het doel in de open map.
            assert_eq!(uitkomst, Err(PlaceError::SourceChanged));
            assert_eq!(std::fs::read(opzij.join(DOEL)).unwrap(), bytes);
            assert!(!exists(&opzij.join(TMP)));
            assert!(!exists(&ander.join(DOEL)));
            assert!(!exists(&ander.join(TMP)));
            assert_eq!(std::fs::read(ander.join("ander.txt")).unwrap(), b"ander");
        } else {
            assert_eq!(uitkomst, Ok(PlaceOutcome::Placed));
            assert_eq!(std::fs::read(werk.join(DOEL)).unwrap(), bytes);
        }
        assert_eq!(
            cfg!(unix),
            gewisseld.get(),
            "wissel gelukt: {}",
            gewisseld.get()
        );
    }

    // Knownbug 1795: een fout die komt nádat de hernoeming gebeurde (netwerkschijf). Een fout van de stap
    // blijft een fout; het commando vangt dit geval niet (de bron staat dan toch op het doel).
    #[test]
    fn place_file_fout_na_uitgevoerde_hernoeming() {
        let dir = TempDir::new("foutna");
        let bytes = content(33, 2_000);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));
        let ops = Recorder {
            error_after_rename: true,
            ..Recorder::default()
        };
        assert_eq!(
            place(&from, &to, &dir.scope(), &ops),
            Err(PlaceError::Io {
                message: "nagebootste fout na de hernoeming".into()
            })
        );
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
        assert!(!exists(&dir.file(TMP)));
        assert_eq!(*ops.events.borrow(), ["sync_file", "rename_exclusive"]);
    }

    // Review #972 ronde 2, blokkade 2: een harde link van de bron op het doel. Unix: de echte stap weigert
    // (`EEXIST`); dat blijft `target-exists`, ook al is het hetzelfde inode, en beide namen blijven.
    // Windows: `SetFileInformationByHandle` zonder vervangen geeft hier geen fout (gemeten in de CI); de
    // proef legt vast wat er dan op schijf staat.
    #[test]
    fn place_file_harde_link_op_het_doel() {
        let dir = TempDir::new("hardelink");
        let bytes = content(34, 2_000);
        let from = dir.write(TMP, &bytes);
        std::fs::hard_link(dir.file(TMP), dir.file(DOEL)).unwrap();
        let to = text(&dir.file(DOEL));
        let ops = Recorder::default();
        let uitkomst = place(&from, &to, &dir.scope(), &ops);
        let stand = (uitkomst, exists(&dir.file(TMP)), exists(&dir.file(DOEL)));
        if cfg!(unix) {
            assert_eq!(stand, (Err(PlaceError::TargetExists), true, true));
            assert_eq!(std::fs::read(dir.file(TMP)).unwrap(), bytes);
            assert_eq!(*ops.events.borrow(), ["sync_file", "rename_exclusive"]);
        } else {
            assert_eq!(stand, (Ok(PlaceOutcome::Placed), false, true), "Windows");
        }
        assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
    }

    // Review #972 ronde 2, blokkade 1: na de stap zet een ander het doel opzij en een eigen bestand B op
    // `to`. Het commando meldt `source-changed` en verplaatst niets meer: B blijft op `to`, de hulpnaam
    // ontstaat niet opnieuw. Windows: het doel is de open bron (zonder `FILE_SHARE_DELETE`), opzij zetten
    // lukt niet en de bron is geplaatst.
    #[test]
    fn place_file_doelwissel_na_de_stap() {
        let dir = TempDir::new("doelwissel");
        let bytes = content(35, 3_000);
        let ander = content(36, 700);
        let from = dir.write(TMP, &bytes);
        let to = text(&dir.file(DOEL));
        let (doel, opzij, b) = (dir.file(DOEL), dir.file("opzij.ifc"), ander.clone());
        let gewisseld = Rc::new(Cell::new(false));
        let vlag = Rc::clone(&gewisseld);
        let ops = Recorder {
            after_rename: RefCell::new(Some(Box::new(move || {
                if std::fs::rename(&doel, &opzij).is_ok() {
                    std::fs::write(&doel, &b).unwrap();
                    vlag.set(true);
                }
            }))),
            ..Recorder::default()
        };
        let uitkomst = place(&from, &to, &dir.scope(), &ops);
        if gewisseld.get() {
            assert_eq!(uitkomst, Err(PlaceError::SourceChanged));
            assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), ander);
            assert!(!exists(&dir.file(TMP)));
            assert_eq!(std::fs::read(dir.file("opzij.ifc")).unwrap(), bytes);
            assert_eq!(*ops.events.borrow(), ["sync_file", "rename_exclusive"]);
        } else {
            assert_eq!(uitkomst, Ok(PlaceOutcome::Placed));
            assert_eq!(std::fs::read(dir.file(DOEL)).unwrap(), bytes);
        }
        assert_eq!(
            cfg!(unix),
            gewisseld.get(),
            "wissel gelukt: {}",
            gewisseld.get()
        );
    }

    type MockApp = tauri::App<tauri::test::MockRuntime>;
    type MockWindow = tauri::WebviewWindow<tauri::test::MockRuntime>;

    /// Een nep-app van Tauri (`tauri::test`, geen echte webview) met de echte `tauri.conf.json` en alle
    /// capabilities in `src-tauri/capabilities/`, plugin-fs en dit commando, plus het hoofdvenster.
    fn echte_app() -> (MockApp, MockWindow) {
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_fs::init())
            .invoke_handler(tauri::generate_handler![super::place_file_exclusive])
            .build(tauri::generate_context!())
            .expect("nep-app met de echte config en capabilities");
        let config = app
            .config()
            .app
            .windows
            .first()
            .expect("hoofdvenster in tauri.conf.json")
            .clone();
        let window = tauri::WebviewWindowBuilder::from_config(app.handle(), &config)
            .unwrap()
            .build()
            .unwrap();
        (app, window)
    }

    /// De scope die plugin-fs voor `command` gebruikt, opgebouwd zoals [`FsRenameScope::new`] dat voor
    /// `rename` doet (de regel van `resolve_path`, `tauri-plugin-fs-2.5.0/src/commands.rs:1528-1570`).
    /// Met `met_verbod` onwaar alleen de toestemmingen van de capability, zonder runtime-scope: zo is te
    /// zien dat een weigering van het verbod komt en niet van een ontbrekende toestemming.
    /// `None`: de capability staat het commando niet toe.
    fn scope_voor(
        webview: &tauri::Webview<tauri::test::MockRuntime>,
        command: &str,
        met_verbod: bool,
    ) -> Option<FsRenameScope> {
        use tauri_plugin_fs::FsExt;
        let resolved = webview
            .resolve_command_scope::<FsScopeEntry>("fs", command)
            .unwrap()?;
        let paths = |entries: &Vec<Arc<FsScopeEntry>>| -> Vec<PathBuf> {
            entries.iter().filter_map(|e| e.path.clone()).collect()
        };
        let mut allow = paths(resolved.global_scope().allows());
        allow.extend(paths(resolved.command_scope().allows()));
        let mut deny = paths(resolved.global_scope().denies());
        deny.extend(paths(resolved.command_scope().denies()));
        if !met_verbod {
            deny.clear();
        }
        // `tauri.conf.json` laat `plugins.fs` leeg, dus geen `requireLiteralLeadingDot` (zoals `new`).
        let configured = tauri::scope::fs::Scope::new(
            webview,
            &tauri::utils::config::FsScope::Scope {
                allow,
                deny,
                require_literal_leading_dot: None,
            },
        )
        .unwrap();
        Some(FsRenameScope {
            runtime: if met_verbod {
                webview.try_fs_scope()
            } else {
                None
            },
            configured,
        })
    }

    /// Het verbod op de webviewgegevens dat de capabilities per platform in de globale scope van fs zetten
    /// (knownbug 1796), relatief aan `$APPLOCALDATA`: de lijst van `permissions/deny-webview-data.toml` van
    /// tauri-plugin-fs vanaf 2.5.2, met per map ook de map zelf (review #975 ronde 1: `map/**` matcht
    /// `map` niet, `glob-0.3.3/src/lib.rs:640-650`, en `rename`/`remove` toetsen alleen de opgegeven
    /// paden). Linux: de mappen en bestanden van WebKitGTK (de gegevensmap van de webview is daar
    /// `$APPLOCALDATA` zelf, `tauri-2.12.3/src/manager/webview.rs:559-568` en
    /// `wry-0.57.0/src/webkitgtk/web_context.rs:32-47`); Windows: de map van WebView2.
    const VERBOD_LINUX: [&str; 16] = [
        "CacheStorage",
        "CacheStorage/**",
        "cookies",
        "hsts-storage.sqlite",
        "serviceworkers",
        "serviceworkers/**",
        "WebKitCache",
        "WebKitCache/**",
        "databases",
        "databases/**",
        "localstorage",
        "localstorage/**",
        "mediakeys",
        "mediakeys/**",
        "storage",
        "storage/**",
    ];
    const VERBOD_WINDOWS: [&str; 2] = ["EBWebView", "EBWebView/**"];

    /// Het verbod op dit platform. macOS: geen; Tauri geeft WKWebView daar geen gegevensmap
    /// (`webview.rs:559-568` alleen voor Linux en Windows) en wry gebruikt dan de standaardopslag van
    /// WebKit (`wry-0.57.0/src/wkwebview/mod.rs:234-244`), buiten `$APPLOCALDATA`.
    fn verbod_hier() -> &'static [&'static str] {
        if cfg!(target_os = "linux") {
            &VERBOD_LINUX
        } else if cfg!(windows) {
            &VERBOD_WINDOWS
        } else {
            &[]
        }
    }

    /// De beschermde mappen van dit platform (de patronen `map/**`), relatief aan `$APPLOCALDATA`.
    fn mappen_hier() -> Vec<&'static str> {
        verbod_hier()
            .iter()
            .filter_map(|p| p.strip_suffix("/**"))
            .collect()
    }

    /// Een pad onder een verbodspatroon: in de map (`map/**`), of de map of het bestand zelf.
    fn onder(local: &Path, patroon: &str) -> PathBuf {
        match patroon.strip_suffix("/**") {
            Some(map) => local.join(map).join("proef").join("plan.ifc"),
            None => local.join(patroon),
        }
    }

    /// Een aanroep door de IPC van Tauri, zoals een pagina met een lokale oorsprong hem doet.
    fn ipc(
        window: &MockWindow,
        cmd: &str,
        body: serde_json::Value,
    ) -> Result<serde_json::Value, serde_json::Value> {
        ipc_met(
            window,
            cmd,
            tauri::ipc::InvokeBody::Json(body),
            Default::default(),
        )
    }

    /// `write_text_file` van plugin-fs door de IPC: de inhoud als ruwe body en het pad in de kop `path`,
    /// zoals `writeTextFile` van `@tauri-apps/plugin-fs` het stuurt (`commands.rs:1089-1110`).
    fn ipc_schrijf(
        window: &MockWindow,
        path: &Path,
        bytes: &[u8],
    ) -> Result<serde_json::Value, serde_json::Value> {
        let mut headers = tauri::http::HeaderMap::new();
        headers.insert(
            "path",
            tauri::http::HeaderValue::from_str(&text(path)).unwrap(),
        );
        ipc_met(
            window,
            "plugin:fs|write_text_file",
            tauri::ipc::InvokeBody::Raw(bytes.to_vec()),
            headers,
        )
    }

    fn ipc_met(
        window: &MockWindow,
        cmd: &str,
        body: tauri::ipc::InvokeBody,
        headers: tauri::http::HeaderMap,
    ) -> Result<serde_json::Value, serde_json::Value> {
        let url = if cfg!(windows) {
            "http://tauri.localhost"
        } else {
            "tauri://localhost"
        };
        tauri::test::get_ipc_response(
            window,
            tauri::webview::InvokeRequest {
                cmd: cmd.into(),
                callback: tauri::ipc::CallbackFn(0),
                error: tauri::ipc::CallbackFn(1),
                url: url.parse().unwrap(),
                body,
                headers,
                invoke_key: tauri::test::INVOKE_KEY.to_string(),
            },
        )
        .map(|body| body.deserialize::<serde_json::Value>().unwrap())
    }

    /// Ruimt eigen mappen en bestanden van een proef op, ook als de proef faalt.
    struct Opruimen(Vec<PathBuf>);

    impl Drop for Opruimen {
        fn drop(&mut self) {
            for path in &self.0 {
                if std::fs::symlink_metadata(path).is_ok_and(|m| !m.file_type().is_dir()) {
                    let _ = std::fs::remove_file(path);
                } else {
                    let _ = std::fs::remove_dir_all(path);
                }
            }
        }
    }

    // Review #972 ronde 2, blokkade 3: dezelfde invoer door de echte IPC naar plugin-fs `rename` en naar
    // dit commando, met de echte capability. Wat plugin-fs weigert, weigert dit commando ook, en er
    // verandert niets op schijf. Eerst een controle dat beide ingangen via de IPC werken.
    #[test]
    fn place_file_weigert_wat_plugin_fs_weigert() {
        use serde_json::json;
        use tauri::Manager;
        let (app, window) = echte_app();
        let home = app.path().home_dir().unwrap();
        let naam = format!("ops-place-file-{}-ipc", std::process::id());
        let echt = home.join(&naam);
        let _opruimen = Opruimen(vec![echt.clone(), home.join(format!(".{naam}"))]);
        let _ = std::fs::remove_dir_all(&echt);
        std::fs::create_dir_all(echt.join("sub")).unwrap();
        let bytes = content(40, 1_000);
        std::fs::write(echt.join(TMP), &bytes).unwrap();
        let from = text(&echt.join(TMP));

        // Controle: plugin-fs `rename` werkt via deze IPC in deze map.
        std::fs::write(echt.join("a.txt"), b"a").unwrap();
        assert_eq!(
            ipc(
                &window,
                "plugin:fs|rename",
                json!({ "oldPath": text(&echt.join("a.txt")), "newPath": text(&echt.join("b.txt")) })
            ),
            Ok(serde_json::Value::Null)
        );
        assert!(echt.join("b.txt").is_file());

        let sep = std::path::MAIN_SEPARATOR;
        #[allow(unused_mut)]
        let mut gevallen = vec![(
            format!("{}{sep}sub{sep}..{sep}{DOEL}", text(&echt)),
            "path-shape",
        )];
        // Unix: `$HOME/.alias/doel.ifc` met `.alias` een link naar de toegestane map. Het doel bestaat
        // nog niet, dus Tauri toetst de tekst, en `$HOME/**` laat een punt vooraan niet toe.
        #[cfg(unix)]
        {
            let alias = home.join(format!(".{naam}"));
            std::os::unix::fs::symlink(&echt, &alias).unwrap();
            gevallen.push((text(&alias.join(DOEL)), "scope"));
        }
        for (to, reden) in &gevallen {
            let fs = ipc(
                &window,
                "plugin:fs|rename",
                json!({ "oldPath": from, "newPath": to }),
            );
            assert!(fs.is_err(), "plugin-fs nam {to} aan: {fs:?}");
            assert_eq!(
                ipc(
                    &window,
                    "place_file_exclusive",
                    json!({ "from": from, "to": to })
                ),
                Err(json!({ "code": "refused", "reason": reden })),
                "{to}"
            );
            assert_eq!(std::fs::read(echt.join(TMP)).unwrap(), bytes);
            assert!(!exists(&echt.join(DOEL)));
        }

        // Controle: dezelfde bron naar een gewoon doel plaatst dit commando via dezelfde IPC.
        assert_eq!(
            ipc(
                &window,
                "place_file_exclusive",
                json!({ "from": from, "to": text(&echt.join(DOEL)) })
            ),
            Ok(json!({ "code": "placed" }))
        );
        assert_eq!(std::fs::read(echt.join(DOEL)).unwrap(), bytes);
    }

    // Blokkade 1 van de review van #972: de scope is die van plugin-fs `rename`, uit de echte
    // `tauri.conf.json` en de echte capabilities.
    #[test]
    fn place_file_scope_volgt_plugin_fs() {
        use tauri::Manager;
        use tauri_plugin_fs::FsExt;
        let (app, window) = echte_app();
        let webview: &tauri::Webview<_> = window.as_ref();
        let scope = FsRenameScope::new(webview).expect("de capability laat fs rename toe");

        let home = app.path().home_dir().unwrap();
        assert!(scope.allows(&home.join("projecten").join("plan.ifc")));
        // Unix: een map met een punt vooraan valt niet onder `$HOME/**`.
        #[cfg(unix)]
        assert!(!scope.allows(&home.join(".verborgen").join("plan.ifc")));
        #[cfg(unix)]
        let buiten = PathBuf::from("/ops-place-file-buiten/plan.ifc");
        #[cfg(windows)]
        let buiten = PathBuf::from(r"C:\ops-place-file-buiten\plan.ifc");
        assert!(!scope.allows(&buiten));
        // De scope die tijdens het draaien groeit (bestandsdialoog) voegt een pad toe.
        let runtime = app.try_fs_scope().expect("plugin-fs geregistreerd");
        runtime.allow_file(&buiten).unwrap();
        assert!(scope.allows(&buiten));

        // Het verbod op de webviewgegevens (knownbug 1796) staat in de globale scope van fs, precies de
        // lijst van dit platform en niets ruimers. Het standaardverbod van tauri-plugin-fs 2.5.0 levert
        // niets (`[[scope.deny]]` in plaats van `[[permission.scope.deny]]`); de capabilities
        // `webviewgegevens-linux.json` en `-windows.json` zetten het zelf.
        let resolved = webview
            .resolve_command_scope::<FsScopeEntry>("fs", "rename")
            .unwrap()
            .unwrap();
        let local = app.path().app_local_data_dir().unwrap();
        let gewoon = |p: &Path| p.components().collect::<PathBuf>();
        let mut verboden: Vec<PathBuf> = resolved
            .global_scope()
            .denies()
            .iter()
            .filter_map(|e| e.path.as_deref().map(gewoon))
            .collect();
        verboden.sort();
        let mut verwacht: Vec<PathBuf> = verbod_hier()
            .iter()
            .map(|p| gewoon(&local.join(p)))
            .collect();
        verwacht.sort();
        assert_eq!(verboden, verwacht);

        // Per commando: `rename` en `remove` van `$APPLOCALDATA` zelf zijn verboden (Linux en Windows);
        // de andere commando's hebben geen eigen verbod, dus `mkdir`, `read_dir`, lezen en schrijven in de
        // app-datamap blijven (review #975 ronde 1).
        let verbod_op_l = if verbod_hier().is_empty() {
            vec![]
        } else {
            vec![gewoon(&local)]
        };
        for command in [
            "rename",
            "remove",
            "mkdir",
            "read_dir",
            "read_file",
            "write_file",
        ] {
            let resolved = webview
                .resolve_command_scope::<FsScopeEntry>("fs", command)
                .unwrap()
                .unwrap_or_else(|| panic!("de capability laat fs {command} toe"));
            let verboden: Vec<PathBuf> = resolved
                .command_scope()
                .denies()
                .iter()
                .filter_map(|e| e.path.as_deref().map(gewoon))
                .collect();
            if command == "rename" || command == "remove" {
                assert_eq!(verboden, verbod_op_l, "{command}");
            } else {
                assert!(verboden.is_empty(), "{command}: {verboden:?}");
            }
        }
    }

    // Knownbug 1796, proef 1: het verbod geldt voor `rename` (dus dit commando) en voor de lees- en
    // schrijfcommando's van plugin-fs die de capability toestaat.
    #[test]
    fn place_file_webviewgegevens_verboden() {
        use tauri::Manager;
        let (app, window) = echte_app();
        let webview: &tauri::Webview<_> = window.as_ref();
        let local = app.path().app_local_data_dir().unwrap();
        let rename = FsRenameScope::new(webview).expect("de capability laat fs rename toe");
        for patroon in verbod_hier() {
            let pad = onder(&local, patroon);
            assert!(!rename.allows(&pad), "rename: {pad:?}");
            for command in [
                "read_file",
                "read_text_file",
                "read_dir",
                "exists",
                "stat",
                "open",
                "write_file",
                "write_text_file",
                "mkdir",
                "remove",
            ] {
                let scope = scope_voor(webview, command, true)
                    .unwrap_or_else(|| panic!("de capability laat fs {command} toe"));
                assert!(!scope.allows(&pad), "{command}: {pad:?}");
            }
        }
    }

    /// Mappen die een proef onder `$APPLOCALDATA` aanmaakt; weg na de proef, ook na een fout. Alleen wat
    /// de proef zelf maakte: de eigen map helemaal, de mappen erboven alleen als ze er nog niet waren en
    /// weer leeg zijn.
    struct EigenMap {
        eigen: PathBuf,
        nieuw_erboven: Vec<PathBuf>,
    }

    impl EigenMap {
        fn maak(eigen: PathBuf) -> Self {
            let nieuw_erboven = eigen
                .ancestors()
                .skip(1)
                .take_while(|p| !p.exists())
                .map(Path::to_path_buf)
                .collect();
            let _ = std::fs::remove_dir_all(&eigen);
            std::fs::create_dir_all(&eigen).unwrap();
            Self {
                eigen,
                nieuw_erboven,
            }
        }
    }

    impl Drop for EigenMap {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.eigen);
            for map in &self.nieuw_erboven {
                let _ = std::fs::remove_dir(map);
            }
        }
    }

    /// De proeven die in de echte `$APPLOCALDATA` van deze machine mappen maken, hernoemen of verwijderen,
    /// draaien na elkaar: een proef ruimt een map erboven op als hij die zelf maakte en ze weer leeg is.
    static ECHTE_APPDATAMAP: std::sync::Mutex<()> = std::sync::Mutex::new(());

    fn echte_appdatamap() -> std::sync::MutexGuard<'static, ()> {
        ECHTE_APPDATAMAP.lock().unwrap_or_else(|e| e.into_inner())
    }

    // Knownbug 1796, proef 1 en 2 voor het commando zelf: een echt bestand in een echte map onder het
    // verbod. De capability (Linux `$APPDATA/**`, dezelfde map; Windows `$HOME/**`) en de runtime-scope
    // staan het pad toe, en toch weigert `place_file_exclusive` het: het verbod wint.
    #[test]
    fn place_file_weigert_webviewgegevens() {
        use tauri::Manager;
        use tauri_plugin_fs::FsExt;
        let _slot = echte_appdatamap();
        let (app, window) = echte_app();
        let webview: &tauri::Webview<_> = window.as_ref();
        let local = app.path().app_local_data_dir().unwrap();
        // Eerst de mappen, dan de scope: Tauri neemt bij het opbouwen ook de canonieke vorm van een
        // bestaand deel van een patroon op (`tauri-2.12.3/src/scope/fs.rs:92-140`), en het commando toetst
        // eerst de padtekst van de aanroeper en daarna het echte pad van de open map.
        let mappen: Vec<EigenMap> = mappen_hier()
            .into_iter()
            .map(|map| {
                EigenMap::maak(
                    local
                        .join(map)
                        .join(format!("ops-place-file-{}", std::process::id())),
                )
            })
            .collect();
        assert_eq!(mappen.is_empty(), cfg!(target_os = "macos"));
        let runtime = app.try_fs_scope().expect("plugin-fs geregistreerd");
        runtime.allow_directory(&local, true).unwrap();
        let scope = FsRenameScope::new(webview).expect("de capability laat fs rename toe");
        let zonder_verbod = scope_voor(webview, "rename", false).unwrap();
        for map in &mappen {
            let from = map.eigen.join(TMP);
            let to = map.eigen.join(DOEL);
            std::fs::write(&from, b"proef").unwrap();
            let real = std::fs::canonicalize(&map.eigen).unwrap();
            for pad in [from.clone(), to.clone(), real.join(TMP), real.join(DOEL)] {
                assert!(zonder_verbod.allows(&pad), "capability: {pad:?}");
                assert!(runtime.is_allowed(&pad), "runtime-scope: {pad:?}");
                assert!(!scope.allows(&pad), "verbod: {pad:?}");
            }
            assert_eq!(
                place(
                    &text(&from),
                    &text(&to),
                    &|p: &Path| scope.allows(p),
                    &SystemOps
                ),
                refused(RefusalReason::Scope),
                "{from:?}"
            );
            assert_eq!(std::fs::read(&from).unwrap(), b"proef");
            assert!(!exists(&to));
        }
    }

    // Knownbug 1796, proef 2: een toestemming heft het verbod niet op, niet in de capability en niet in
    // de runtime-scope (bestandsdialoog, `persisted-scope`), ook niet voor een lees- of schrijfcommando.
    #[test]
    fn place_file_toestemming_heft_webviewverbod_niet_op() {
        use tauri::Manager;
        use tauri_plugin_fs::FsExt;
        let (app, window) = echte_app();
        let webview: &tauri::Webview<_> = window.as_ref();
        let local = app.path().app_local_data_dir().unwrap();
        let runtime = app.try_fs_scope().expect("plugin-fs geregistreerd");
        runtime.allow_directory(&local, true).unwrap();
        for patroon in verbod_hier() {
            let pad = onder(&local, patroon);
            runtime.allow_file(&pad).unwrap();
            assert!(runtime.is_allowed(&pad), "runtime-scope: {pad:?}");
            for command in ["rename", "read_file", "write_file"] {
                let zonder_verbod = scope_voor(webview, command, false).unwrap();
                assert!(zonder_verbod.allows(&pad), "capability {command}: {pad:?}");
                let scope = scope_voor(webview, command, true).unwrap();
                assert!(!scope.allows(&pad), "verbod {command}: {pad:?}");
            }
            assert!(!FsRenameScope::new(webview).unwrap().allows(&pad));
        }
    }

    /// Wat de app zelf in `appDataDir` leest en schrijft, met de fs-commando's per onderdeel, uit de code:
    /// herstel na een crash (`recoveryPaths.ts`, `recoveryStore.ts`, `atomicWrite.ts`; ook de naam van
    /// een dev-build `recovery.<slug>`), het MCP-register (`discoveryContract.ts`, `discoveryFiles.ts`),
    /// de dev-brug (`devBridge.ts`), de resourcebibliotheek (`libraryStore.ts`), de AI-backup
    /// (`backupService.ts`) en de feedback-schermafbeelding (`feedbackService.ts`). `""` is de map zelf.
    const EIGEN_GEBRUIK: [(&[&str], &[&str]); 7] = [
        // De map zelf: aanmaken, lezen en kijken, nooit hernoemen of verwijderen (gezocht in `src/`).
        (&[""], &["exists", "stat", "read_dir", "mkdir"]),
        (
            &[
                "recovery.documents.json",
                "recovery.documents.json.tmp",
                "recovery.snapshot.doc-mhx1q2k9ab3.mhx1q2k9ab4.ifc",
                "recovery.snapshot.doc-mhx1q2k9ab3.mhx1q2k9ab4.ifc.tmp",
                "recovery.xerarchive.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.bin",
                "recovery.xerarchive.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.bin.tmp",
                "recovery.doc-mhx1q2k9ab3.ifc",
                "recovery.ifc",
                "recovery.t3-proef.documents.json",
            ],
            &[
                "exists",
                "stat",
                "read_dir",
                "read_text_file",
                "read_file",
                "mkdir",
                "write_text_file",
                "write_file",
                "rename",
                "remove",
            ],
        ),
        (
            &[
                "mcp",
                "mcp/open-files.json",
                "mcp/open-files.json.tmp",
                "mcp/runtime.json",
                "mcp/runtime.t3-proef.json",
            ],
            &["mkdir", "read_dir", "open", "rename", "remove", "exists"],
        ),
        (
            &[
                "ops-test",
                "ops-test/cmd.json",
                "ops-test/res.json",
                "ops-test/ready.json",
                "ops-test/feedback-capture.png",
            ],
            &[
                "mkdir",
                "exists",
                "read_text_file",
                "write_text_file",
                "write_file",
                "remove",
            ],
        ),
        (
            &["ops-library.json", "ops-library.json.tmp"],
            &[
                "mkdir",
                "exists",
                "read_text_file",
                "write_text_file",
                "rename",
                "remove",
            ],
        ),
        (
            &[
                "ai-backups",
                "ai-backups/doc-mhx1q2k9ab3",
                "ai-backups/doc-mhx1q2k9ab3/plan-2026-11-16T20-00-00-000Z.ifc",
            ],
            &["mkdir", "read_dir", "write_text_file", "remove"],
        ),
        (
            &["feedback", "feedback/feedback-2026-11-16T20-00-00-000Z.png"],
            &["mkdir", "write_file"],
        ),
    ];

    // Knownbug 1796, proef 3: het herstel, het MCP-register en de dev-brug (en de andere eigen bestanden
    // in `appDataDir`) blijven toegestaan, op elk platform; op Linux is dat dezelfde map als
    // `$APPLOCALDATA`. En geen eigen naam valt onder een verbodspatroon van Linux of Windows.
    #[test]
    fn place_file_eigen_appdata_blijft_toegestaan() {
        use tauri::Manager;
        let (app, window) = echte_app();
        let webview: &tauri::Webview<_> = window.as_ref();
        let data = app.path().app_data_dir().unwrap();
        let rename = FsRenameScope::new(webview).expect("de capability laat fs rename toe");
        let verboden_namen: Vec<&str> = VERBOD_LINUX
            .iter()
            .chain(VERBOD_WINDOWS.iter())
            .map(|p| p.trim_end_matches("/**"))
            .collect();
        for (namen, commands) in EIGEN_GEBRUIK {
            for naam in namen {
                let pad = if naam.is_empty() {
                    data.clone()
                } else {
                    data.join(naam)
                };
                if let Some(eerste) = naam.split('/').next().filter(|e| !e.is_empty()) {
                    assert!(!verboden_namen.contains(&eerste), "eigen naam {naam}");
                }
                // De scope van dit commando zelf (`FsRenameScope`) waar het onderdeel hernoemt.
                if commands.contains(&"rename") {
                    assert!(rename.allows(&pad), "rename: {pad:?}");
                }
                for command in commands.iter() {
                    let scope = scope_voor(webview, command, true)
                        .unwrap_or_else(|| panic!("de capability laat fs {command} toe"));
                    assert!(scope.allows(&pad), "{command}: {pad:?}");
                }
            }
        }
    }

    /// Zet een map terug als een proef haar toch verplaatste (alleen als het verbod ontbreekt, zoals in de
    /// mutatie): staat `weg` er en `terug` niet, dan gaat `weg` terug naar `terug`.
    struct Terugzetten {
        weg: PathBuf,
        terug: PathBuf,
    }

    impl Drop for Terugzetten {
        fn drop(&mut self) {
            if exists(&self.weg) && !exists(&self.terug) {
                let _ = std::fs::rename(&self.weg, &self.terug);
            }
        }
    }

    // Review #975 ronde 1, proef 1: een beschermde map zelf hernoemen (als bron en als doel) en recursief
    // verwijderen, door de echte IPC van plugin-fs: geweigerd, en de map en haar inhoud staan er nog.
    // plugin-fs toetst bij `rename` en `remove` alleen de opgegeven paden (`commands.rs:737-830`), en
    // `map/**` matcht `map` zelf niet; zonder het verbod op de map zelf verhuist of verdwijnt de inhoud.
    #[test]
    fn place_file_ipc_webviewmappen_dicht() {
        use serde_json::json;
        use tauri::Manager;
        let _slot = echte_appdatamap();
        let (app, window) = echte_app();
        let local = app.path().app_local_data_dir().unwrap();
        let eigen = format!("ops-place-file-{}", std::process::id());
        assert_eq!(mappen_hier().is_empty(), cfg!(target_os = "macos"));
        for map in mappen_hier() {
            let beschermd = local.join(map);
            let elders = local.join(format!("{map}-{eigen}"));
            let _opruimen = Opruimen(vec![elders.clone()]);

            // Als doel: een eigen map naar de naam van de beschermde map. Die mag er dan nog niet zijn,
            // anders weigert het systeem het hernoemen al; op de runner van de CI is ze er nooit.
            if exists(&beschermd) {
                assert!(
                    std::env::var_os("CI").is_none(),
                    "{beschermd:?} bestaat al op de runner"
                );
            } else {
                let bron = EigenMap::maak(local.join(format!("{eigen}-bron")));
                std::fs::write(bron.eigen.join("proef.txt"), b"proef").unwrap();
                let verplaatst = Opruimen(vec![beschermd.clone()]);
                let uitkomst = ipc(
                    &window,
                    "plugin:fs|rename",
                    json!({ "oldPath": text(&bron.eigen), "newPath": text(&beschermd) }),
                );
                assert!(uitkomst.is_err(), "rename naar {beschermd:?}: {uitkomst:?}");
                assert!(!exists(&beschermd));
                assert_eq!(
                    std::fs::read(bron.eigen.join("proef.txt")).unwrap(),
                    b"proef"
                );
                drop(verplaatst);
            }

            // Als bron, en recursief verwijderen: de beschermde map met eigen, synthetische inhoud.
            let inhoud = EigenMap::maak(beschermd.join(&eigen));
            let bestand = inhoud.eigen.join("proef.txt");
            std::fs::write(&bestand, b"proef").unwrap();
            let _terug = Terugzetten {
                weg: elders.clone(),
                terug: beschermd.clone(),
            };
            let uitkomst = ipc(
                &window,
                "plugin:fs|rename",
                json!({ "oldPath": text(&beschermd), "newPath": text(&elders) }),
            );
            assert!(uitkomst.is_err(), "rename van {beschermd:?}: {uitkomst:?}");
            assert!(!exists(&elders));
            let uitkomst = ipc(
                &window,
                "plugin:fs|remove",
                json!({ "path": text(&beschermd), "options": { "recursive": true } }),
            );
            assert!(uitkomst.is_err(), "remove van {beschermd:?}: {uitkomst:?}");
            assert_eq!(std::fs::read(&bestand).unwrap(), b"proef");
        }
    }

    // Review #975 ronde 1, proef 2: de app-datamap zelf hernoemen of verwijderen (ook recursief), door de
    // echte IPC: geweigerd op Linux en Windows. Het doel van het hernoemen ligt in de thuismap, die de
    // capability toestaat (eerst een controle daarvan); zonder het verbod verhuist de hele map. macOS:
    // geen verbod, want daar staan geen webviewgegevens in die map.
    #[cfg(any(target_os = "linux", windows))]
    #[test]
    fn place_file_ipc_appdatamap_zelf_dicht() {
        use serde_json::json;
        use tauri::Manager;
        let _slot = echte_appdatamap();
        let (app, window) = echte_app();
        let local = app.path().app_local_data_dir().unwrap();
        let home = app.path().home_dir().unwrap();
        let eigen = format!("ops-place-file-{}", std::process::id());
        let inhoud = EigenMap::maak(local.join(format!("{eigen}-l")));
        let bestand = inhoud.eigen.join("proef.txt");
        std::fs::write(&bestand, b"proef").unwrap();
        let elders = home.join(format!("{eigen}-appdatamap"));
        let _terug = Terugzetten {
            weg: elders.clone(),
            terug: local.clone(),
        };
        let a = home.join(format!("{eigen}-a"));
        let b = home.join(format!("{eigen}-b"));
        let _opruimen = Opruimen(vec![a.clone(), b.clone()]);

        // Controle: plugin-fs hernoemt via deze IPC een eigen map in de thuismap.
        std::fs::create_dir_all(&a).unwrap();
        assert_eq!(
            ipc(
                &window,
                "plugin:fs|rename",
                json!({ "oldPath": text(&a), "newPath": text(&b) })
            ),
            Ok(serde_json::Value::Null)
        );
        assert!(b.is_dir());

        let uitkomst = ipc(
            &window,
            "plugin:fs|rename",
            json!({ "oldPath": text(&local), "newPath": text(&elders) }),
        );
        assert!(uitkomst.is_err(), "rename van {local:?}: {uitkomst:?}");
        assert!(!exists(&elders));
        for opties in [json!({}), json!({ "recursive": true })] {
            let uitkomst = ipc(
                &window,
                "plugin:fs|remove",
                json!({ "path": text(&local), "options": opties.clone() }),
            );
            assert!(
                uitkomst.is_err(),
                "remove {opties} van {local:?}: {uitkomst:?}"
            );
        }
        assert_eq!(std::fs::read(&bestand).unwrap(), b"proef");
    }

    // Review #975 ronde 1, proef 4: het herstel blijft werken, door de echte IPC en op elk platform, in de
    // map waar het herstel schrijft (`appDataDir`) en in `$APPLOCALDATA` (op Linux en macOS dezelfde
    // map): de map aanmaken, een halffabricaat schrijven, lezen, hernoemen naar de echte naam, de map
    // lezen en het bestand verwijderen. Met de namen van het herstel (`recovery.<slug>.documents.json` en
    // `.tmp`, `recoveryPaths.ts`), met een eigen slug: nooit het herstel van een echte app hier.
    #[test]
    fn place_file_ipc_herstel_blijft_werken() {
        use serde_json::json;
        use tauri::Manager;
        let _slot = echte_appdatamap();
        let (app, window) = echte_app();
        let mut mappen = vec![app.path().app_data_dir().unwrap()];
        let local = app.path().app_local_data_dir().unwrap();
        if !mappen.contains(&local) {
            mappen.push(local);
        }
        let base = format!("recovery.ops-place-file-{}", std::process::id());
        let inhoud = br#"{"version":5,"documents":[]}"#;
        for map in mappen {
            let naam = format!("{base}.documents.json");
            let manifest = map.join(&naam);
            let tmp = map.join(format!("{naam}.tmp"));
            let _opruimen = Opruimen(vec![manifest.clone(), tmp.clone()]);
            let null = Ok(serde_json::Value::Null);
            assert_eq!(
                ipc(
                    &window,
                    "plugin:fs|mkdir",
                    json!({ "path": text(&map), "options": { "recursive": true } })
                ),
                null,
                "mkdir {map:?}"
            );
            assert_eq!(ipc_schrijf(&window, &tmp, inhoud), null, "schrijven");
            let gelezen = ipc(
                &window,
                "plugin:fs|read_text_file",
                json!({ "path": text(&tmp) }),
            )
            .expect("lezen");
            assert_eq!(serde_json::from_value::<Vec<u8>>(gelezen).unwrap(), inhoud);
            assert_eq!(
                ipc(
                    &window,
                    "plugin:fs|rename",
                    json!({ "oldPath": text(&tmp), "newPath": text(&manifest) })
                ),
                null,
                "hernoemen"
            );
            assert_eq!(
                ipc(
                    &window,
                    "plugin:fs|exists",
                    json!({ "path": text(&manifest) })
                ),
                Ok(json!(true))
            );
            let lijst = ipc(&window, "plugin:fs|read_dir", json!({ "path": text(&map) }))
                .expect("de map lezen");
            assert!(
                lijst
                    .as_array()
                    .unwrap()
                    .iter()
                    .any(|e| e["name"] == json!(naam)),
                "{naam} in {map:?}"
            );
            assert_eq!(
                ipc(
                    &window,
                    "plugin:fs|remove",
                    json!({ "path": text(&manifest) })
                ),
                null,
                "verwijderen"
            );
            assert!(!exists(&manifest) && !exists(&tmp));
        }
    }

    // Blokkade 1: de regel van plugin-fs met een verbod erin. Echte `tauri::scope::fs::Scope`'s uit een
    // nep-app; het verbod komt hier van de proef, zodat de regel ook op macOS getoetst wordt (daar zet de
    // capability geen verbod).
    #[test]
    fn place_file_scope_verbod_wint() {
        use tauri::Manager;
        use tauri_plugin_fs::FsExt;
        let app = tauri::test::mock_builder()
            .plugin(tauri_plugin_fs::init())
            .build(tauri::test::mock_context(tauri::test::noop_assets()))
            .expect("nep-app");
        let configured = tauri::scope::fs::Scope::new(
            &app,
            &tauri::utils::config::FsScope::Scope {
                allow: vec![PathBuf::from("$HOME"), PathBuf::from("$HOME/**")],
                deny: vec![PathBuf::from("$HOME/verboden/**")],
                require_literal_leading_dot: None,
            },
        )
        .unwrap();
        let runtime = app.try_fs_scope().expect("plugin-fs geregistreerd");
        let scope = FsRenameScope {
            runtime: Some(runtime.clone()),
            configured,
        };
        let home = app.path().home_dir().unwrap();
        let verboden = home.join("verboden").join("plan.ifc");
        assert!(scope.allows(&home.join("toegestaan").join("plan.ifc")));
        assert!(!scope.allows(&verboden));
        // Een toestemming in de runtime-scope heft een verbod niet op.
        runtime.allow_file(&verboden).unwrap();
        assert!(!scope.allows(&verboden));
        // En een verbod in de runtime-scope wint van de capability.
        let ander = home.join("toegestaan").join("ander.ifc");
        runtime.forbid_file(&ander).unwrap();
        assert!(!scope.allows(&ander));
    }
}
