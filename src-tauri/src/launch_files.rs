//! Bestanden die bij het starten zijn meegegeven (issue #1091).
//!
//! `Open Planner Studio.exe C:\werk\plan.ifc`, of een dubbelklik op een bestand dat de gebruiker zelf aan de
//! app heeft gekoppeld (de installer zet die koppeling bewust niet). Bij de eerste start komen de paden uit
//! `std::env::args_os`; bij een tweede start uit de single-instance-callback, met de werkmap van díe start.
//! De webview opent ze via de gewone openroute (`src/state/launchFiles.ts`).
//!
//! Geen command (AGENTS.md: precies vier): de paden gaan als event `ops:open-files` naar het venster.
//! Een event dat verstuurd wordt voordat de webview luistert, gaat verloren; daarom houdt
//! [`LaunchQueue`] de paden vast tot de webview `ops:open-files-ready` stuurt.
//!
//! Deze module gebruikt alleen `std`, zodat de proef ook los te draaien is
//! (`rustc --edition 2021 --test src-tauri/src/launch_files.rs`). De bedrading met Tauri staat in `main.rs`.
//!
//! De fs-scope verandert hier niet: de webview leest het pad met plugin-fs, dus alleen binnen de bestaande
//! scope (de thuismap). Een pad daarbuiten geeft de gewone leesfout (knownbug 2030).

use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

/// Rust → webview: een lijst paden. Dezelfde naam staat in `src/state/launchFiles.ts`.
pub const OPEN_FILES_EVENT: &str = "ops:open-files";
/// Webview → Rust: de webview luistert. Dezelfde naam staat in `src/state/launchFiles.ts`.
pub const OPEN_FILES_READY_EVENT: &str = "ops:open-files-ready";

/// De bestandspaden uit een opdrachtregel. Het eerste argument is het programma zelf. Een argument dat met
/// `-` begint is een optie, geen bestand (macOS geeft bijvoorbeeld `-psn_0_12345` mee bij een start vanuit
/// Finder). Een relatief pad gaat uit van `cwd`, de werkmap van de start die het argument meegaf; `..` wijst
/// naar de map die het besturingssysteem bedoelt ([`resolve_parent_dirs`]). Een pad dat geen geldige tekst is
/// (alleen mogelijk op Unix) valt weg: de webview kan het niet als tekst krijgen.
pub fn launch_file_paths<I, S>(argv: I, cwd: &Path) -> Vec<String>
where
    I: IntoIterator<Item = S>,
    S: Into<OsString>,
{
    argv.into_iter()
        .skip(1)
        .filter_map(|arg| arg.into().into_string().ok())
        .filter(|arg| !arg.is_empty() && !arg.starts_with('-'))
        .filter_map(|arg| {
            // `components()` laat een `.` midden in het pad weg; zo komt er geen `/./` in de tekst.
            let full: PathBuf = absolute_in(Path::new(&arg), cwd).components().collect();
            resolve_parent_dirs(full).into_os_string().into_string().ok()
        })
        .collect()
}

/// Het pad vanaf `cwd`. Windows kent ook een pad met station maar zonder wortel (`C:plan.ifc`): dat gaat uit van
/// de werkmap op dat station. Is dat het station van `cwd`, dan van `cwd`; van een ander station is de werkmap
/// van die start niet bekend, en dan blijft het pad staan (en geeft het de gewone leesfout).
fn absolute_in(path: &Path, cwd: &Path) -> PathBuf {
    if path.is_absolute() {
        return path.to_path_buf();
    }
    #[cfg(windows)]
    {
        use std::path::Prefix;
        let disk = |p: &Path| match p.components().next() {
            Some(Component::Prefix(prefix)) => match prefix.kind() {
                Prefix::Disk(d) | Prefix::VerbatimDisk(d) => Some(d.to_ascii_uppercase()),
                _ => None,
            },
            _ => None,
        };
        if !path.has_root() {
            if let Some(drive) = disk(path) {
                if disk(cwd) != Some(drive) {
                    return path.to_path_buf();
                }
                let mut rest = path.components();
                rest.next();
                return cwd.join(rest.as_path());
            }
        }
    }
    cwd.join(path)
}

/// `..` zoals het besturingssysteem het leest.
///
/// Windows haalt `..` weg zonder het bestandssysteem te raadplegen (de Win32-padnormalisatie, vóór het bestand
/// geopend wordt), dus hier ook: tegen het vorige deel weggestreept, nooit boven de wortel uit.
#[cfg(windows)]
fn resolve_parent_dirs(path: PathBuf) -> PathBuf {
    if !path.components().any(|c| c == Component::ParentDir) {
        return path;
    }
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::ParentDir => {
                if matches!(out.components().next_back(), Some(Component::Normal(_))) {
                    out.pop();
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Op Unix volgt `..` de echte bovenliggende map: na `link/..` sta je in de map boven het doel van de link, niet
/// in de map van de link. Daarom lost het besturingssysteem de map van het bestand op (`canonicalize`), alleen als
/// het pad `..` bevat; de bestandsnaam zelf blijft staan, zoals Bestand → Openen hem geeft. Lukt dat niet (de map
/// bestaat niet), dan blijft het pad zoals het was en geeft lezen de gewone foutmelding. Een pad zonder `..` blijft
/// ongemoeid, ook als er een link in zit.
#[cfg(not(windows))]
fn resolve_parent_dirs(path: PathBuf) -> PathBuf {
    if !path.components().any(|c| c == Component::ParentDir) {
        return path;
    }
    match (path.parent(), path.file_name()) {
        (Some(dir), Some(name)) => match dir.canonicalize() {
            Ok(real) => real.join(name),
            Err(_) => path,
        },
        _ => path,
    }
}

/// De paden die nog naar de webview moeten. Tot het klaarsignaal verzamelt de wachtrij; daarna gaat elk
/// nieuw pad meteen door.
#[derive(Debug)]
pub struct LaunchQueue {
    ready: bool,
    pending: Vec<String>,
}

impl LaunchQueue {
    pub fn new(initial: Vec<String>) -> Self {
        Self { ready: false, pending: initial }
    }

    /// Nieuwe paden (een tweede start). Geeft terug wat nu verstuurd moet worden: niets zolang de webview
    /// nog niet luistert.
    pub fn offer(&mut self, paths: Vec<String>) -> Vec<String> {
        if paths.is_empty() {
            return Vec::new();
        }
        if self.ready {
            paths
        } else {
            self.pending.extend(paths);
            Vec::new()
        }
    }

    /// Het klaarsignaal van de webview. Geeft wat klaarlag, één keer; een tweede signaal (de webview
    /// herladen) geeft niets opnieuw.
    pub fn mark_ready(&mut self) -> Vec<String> {
        self.ready = true;
        std::mem::take(&mut self.pending)
    }
}

#[cfg(test)]
mod launch_files_tests {
    use super::*;

    /// Een eigen, echte map per proef (de oplossing van `..` op Unix kijkt naar het bestandssysteem). Op Unix in
    /// de echte vorm (macOS: `/var` is `/private/var`), zodat de verwachting niet van een link afhangt.
    fn fresh(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("ops-launch-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        #[cfg(not(windows))]
        let dir = dir.canonicalize().unwrap();
        dir
    }

    fn s(path: PathBuf) -> String {
        path.into_os_string().into_string().unwrap()
    }

    #[test]
    fn launch_files_slaat_het_programma_en_opties_over() {
        let base = fresh("opties");
        let abs = s(base.join("plan.ifc"));
        let got = launch_file_paths(["ops.exe", "-psn_0_12345", "--verbose", "", abs.as_str()], &base);
        assert_eq!(got, vec![abs]);
    }

    #[test]
    fn launch_files_zonder_bestand_geeft_niets() {
        let base = fresh("leeg");
        assert!(launch_file_paths(["ops.exe"], &base).is_empty());
        assert!(launch_file_paths(Vec::<String>::new(), &base).is_empty());
    }

    #[test]
    fn launch_files_relatief_pad_gaat_uit_van_de_werkmap() {
        let base = fresh("relatief");
        let cwd = base.join("werk");
        std::fs::create_dir_all(&cwd).unwrap();
        let got = launch_file_paths(["ops", "plan.ifc", "./sub/b.ifc", "../c.ifc"], &cwd);
        assert_eq!(got, vec![s(cwd.join("plan.ifc")), s(cwd.join("sub").join("b.ifc")), s(base.join("c.ifc"))]);
    }

    #[test]
    fn launch_files_absoluut_pad_blijft_staan() {
        let base = fresh("absoluut");
        let abs = s(base.join("map met spatie").join("Plan.IFC"));
        let got = launch_file_paths(["ops", abs.as_str()], Path::new("/ergens/anders"));
        assert_eq!(got, vec![abs]);
    }

    #[test]
    fn launch_files_dubbele_punten_in_een_absoluut_pad_vallen_weg() {
        let base = fresh("punten");
        std::fs::create_dir_all(base.join("a")).unwrap();
        let raw = s(base.join("a").join("..").join(".").join("b.ifc"));
        assert_eq!(launch_file_paths(["ops", raw.as_str()], &base), vec![s(base.join("b.ifc"))]);
    }

    /// Review van #1116: `link/..` is op Unix de map boven het DOEL van de link. Weggestreept zou de app
    /// `plan.ifc` naast de link openen (en opslaan), terwijl het besturingssysteem `shared/plan.ifc` bedoelt.
    #[cfg(unix)]
    #[test]
    fn launch_files_dubbele_punt_na_een_link_volgt_het_besturingssysteem() {
        let base = fresh("link");
        std::fs::create_dir_all(base.join("shared").join("current")).unwrap();
        std::os::unix::fs::symlink(base.join("shared").join("current"), base.join("linked")).unwrap();
        std::fs::write(base.join("shared").join("plan.ifc"), "bedoeld").unwrap();
        std::fs::write(base.join("plan.ifc"), "niet bedoeld").unwrap();
        let got = launch_file_paths(["ops", "linked/../plan.ifc"], &base);
        assert_eq!(got, vec![s(base.join("shared").join("plan.ifc"))]);
        assert_eq!(std::fs::read_to_string(&got[0]).unwrap(), std::fs::read_to_string(base.join("linked/../plan.ifc")).unwrap());
    }

    /// Review van #1116: `nope/../plan.ifc` geeft het besturingssysteem een leesfout; het pad blijft dus staan en
    /// opent niet stil `plan.ifc`.
    #[cfg(unix)]
    #[test]
    fn launch_files_dubbele_punt_na_een_ontbrekende_map_blijft_staan() {
        let base = fresh("ontbrekend");
        std::fs::write(base.join("plan.ifc"), "x").unwrap();
        let got = launch_file_paths(["ops", "nope/../plan.ifc"], &base);
        assert_eq!(got, vec![s(base.join("nope").join("..").join("plan.ifc"))]);
        assert!(std::fs::read_to_string(&got[0]).is_err(), "het besturingssysteem leest dit pad ook niet");
    }

    #[cfg(windows)]
    #[test]
    fn launch_files_windowspad_van_een_dubbelklik() {
        let got = launch_file_paths(["C:\\Program Files\\OPS\\ops.exe", "C:\\Users\\a\\Documents\\Plan.ifc"], Path::new("C:\\Windows\\System32"));
        assert_eq!(got, vec!["C:\\Users\\a\\Documents\\Plan.ifc".to_string()]);
    }

    /// Windows streept `..` zelf weg (Win32-padnormalisatie), ook na een link.
    #[cfg(windows)]
    #[test]
    fn launch_files_windows_streept_dubbele_punten_weg() {
        let got = launch_file_paths(["ops", "C:\\werk\\a\\..\\b.ifc", "..\\..\\..\\c.ifc"], Path::new("C:\\werk"));
        assert_eq!(got, vec!["C:\\werk\\b.ifc".to_string(), "C:\\c.ifc".to_string()]);
    }

    /// Review van #1116: `C:plan.ifc` gaat uit van de werkmap op station C:. `PathBuf::join` gooide die weg.
    #[cfg(windows)]
    #[test]
    fn launch_files_windows_station_zonder_wortel() {
        let got = launch_file_paths(["ops", "C:plan.ifc", "c:sub\\b.ifc", "D:elders.ifc", "\\wortel.ifc"], Path::new("C:\\werk"));
        assert_eq!(got, vec![
            "C:\\werk\\plan.ifc".to_string(),
            "C:\\werk\\sub\\b.ifc".to_string(),
            "D:elders.ifc".to_string(),
            "C:\\wortel.ifc".to_string(),
        ]);
    }

    #[test]
    fn launch_files_wachtrij_houdt_vast_tot_de_webview_luistert() {
        let mut queue = LaunchQueue::new(vec!["eerste.ifc".into()]);
        assert!(queue.offer(vec!["tweede.ifc".into()]).is_empty(), "vóór het klaarsignaal gaat niets weg");
        assert_eq!(queue.mark_ready(), vec!["eerste.ifc".to_string(), "tweede.ifc".to_string()]);
        assert!(queue.mark_ready().is_empty(), "een tweede klaarsignaal geeft niets opnieuw");
        assert_eq!(queue.offer(vec!["derde.ifc".into()]), vec!["derde.ifc".to_string()]);
        assert!(queue.offer(Vec::new()).is_empty());
    }
}
