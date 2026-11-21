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
//! scope (de thuismap). Een pad daarbuiten geeft de gewone leesfout (knownbug 1762).

use std::ffi::OsString;
use std::path::{Component, Path, PathBuf};

/// Rust → webview: een lijst paden. Dezelfde naam staat in `src/state/launchFiles.ts`.
pub const OPEN_FILES_EVENT: &str = "ops:open-files";
/// Webview → Rust: de webview luistert. Dezelfde naam staat in `src/state/launchFiles.ts`.
pub const OPEN_FILES_READY_EVENT: &str = "ops:open-files-ready";

/// De bestandspaden uit een opdrachtregel. Het eerste argument is het programma zelf. Een argument dat met
/// `-` begint is een optie, geen bestand (macOS geeft bijvoorbeeld `-psn_0_12345` mee bij een start vanuit
/// Finder). Een relatief pad gaat uit van `cwd`, de werkmap van de start die het argument meegaf. `.` en
/// `..` worden zonder bestandssysteem weggewerkt: plugin-fs weigert een pad met `..`. Een pad dat geen
/// geldige tekst is (alleen mogelijk op Unix) valt weg: de webview kan het niet als tekst krijgen.
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
            let path = Path::new(&arg);
            let full = if path.is_absolute() { path.to_path_buf() } else { cwd.join(path) };
            normalize(&full).into_os_string().into_string().ok()
        })
        .collect()
}

/// `.` weg en `..` tegen het vorige deel weggestreept, zonder het bestandssysteem te raadplegen. Een `..`
/// boven de wortel blijft bij de wortel.
fn normalize(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for component in path.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                if matches!(out.components().next_back(), Some(Component::Normal(_))) {
                    out.pop();
                } else if !out.has_root() {
                    out.push("..");
                }
            }
            other => out.push(other.as_os_str()),
        }
    }
    out
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

    /// Een absolute werkmap op elk platform (op Windows met stationsletter).
    fn base() -> PathBuf {
        std::env::temp_dir().join("ops-start")
    }

    fn s(path: PathBuf) -> String {
        path.into_os_string().into_string().unwrap()
    }

    #[test]
    fn launch_files_slaat_het_programma_en_opties_over() {
        let abs = s(base().join("plan.ifc"));
        let got = launch_file_paths(["ops.exe", "-psn_0_12345", "--verbose", "", abs.as_str()], &base());
        assert_eq!(got, vec![abs]);
    }

    #[test]
    fn launch_files_zonder_bestand_geeft_niets() {
        assert!(launch_file_paths(["ops.exe"], &base()).is_empty());
        assert!(launch_file_paths(Vec::<String>::new(), &base()).is_empty());
    }

    #[test]
    fn launch_files_relatief_pad_gaat_uit_van_de_werkmap() {
        let cwd = base().join("werk");
        let got = launch_file_paths(["ops", "plan.ifc", "./sub/b.ifc", "../c.ifc"], &cwd);
        assert_eq!(got, vec![s(cwd.join("plan.ifc")), s(cwd.join("sub").join("b.ifc")), s(base().join("c.ifc"))]);
    }

    #[test]
    fn launch_files_absoluut_pad_blijft_staan() {
        let abs = s(base().join("map met spatie").join("Plan.IFC"));
        let got = launch_file_paths(["ops", abs.as_str()], Path::new("/ergens/anders"));
        assert_eq!(got, vec![abs]);
    }

    #[test]
    fn launch_files_dubbele_punten_in_een_absoluut_pad_vallen_weg() {
        let raw = s(base().join("a").join("..").join(".").join("b.ifc"));
        assert_eq!(launch_file_paths(["ops", raw.as_str()], &base()), vec![s(base().join("b.ifc"))]);
    }

    #[cfg(windows)]
    #[test]
    fn launch_files_windowspad_van_een_dubbelklik() {
        let got = launch_file_paths(["C:\\Program Files\\OPS\\ops.exe", "C:\\Users\\a\\Documents\\Plan.ifc"], Path::new("C:\\Windows\\System32"));
        assert_eq!(got, vec!["C:\\Users\\a\\Documents\\Plan.ifc".to_string()]);
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
