use std::path::Path;
use std::process::ExitCode;

use ifcx_project::{load_files, seal_files, Files, LoadedProject};

const PROJECT: &str = "ops-controle";
const MAX_GENOEMD: usize = 5;

enum Uitkomst {
    Geladen(String),
    Afgekeurd(String),
}

fn meldingen(project: &LoadedProject) -> String {
    let mut regels: Vec<String> = project
        .warnings
        .iter()
        .take(MAX_GENOEMD)
        .map(|melding| {
            format!(
                "{}: {} ({})",
                melding.code,
                melding.message,
                melding.node.as_deref().unwrap_or("-")
            )
        })
        .collect();
    if project.warnings.len() > MAX_GENOEMD {
        regels.push(format!("en nog {}", project.warnings.len() - MAX_GENOEMD));
    }
    regels.join("; ")
}

fn controleer(pad: &Path) -> Result<Uitkomst, String> {
    let bytes =
        std::fs::read(pad).map_err(|fout| format!("{} is niet te lezen: {fout}", pad.display()))?;
    let naam = pad
        .file_name()
        .and_then(|naam| naam.to_str())
        .ok_or_else(|| format!("{} heeft geen bruikbare bestandsnaam", pad.display()))?
        .to_owned();
    let document: serde_json::Value = match serde_json::from_slice(&bytes) {
        Ok(document) => document,
        Err(fout) => return Ok(Uitkomst::Afgekeurd(format!("INVALID_JSON: {fout}"))),
    };
    let Some(id) = document.pointer("/header/id").and_then(|id| id.as_str()) else {
        return Ok(Uitkomst::Afgekeurd("INVALID_HEADER: header.id ontbreekt".into()));
    };
    let mut bestanden = Files::new();
    bestanden.insert(naam, bytes);
    let pakket = match seal_files(PROJECT, id, bestanden) {
        Ok(pakket) => pakket,
        Err(fout) => return Ok(Uitkomst::Afgekeurd(fout.to_string())),
    };
    let project = match load_files(pakket) {
        Ok(project) => project,
        Err(fout) => return Ok(Uitkomst::Afgekeurd(fout.to_string())),
    };
    if !project.warnings.is_empty() {
        return Ok(Uitkomst::Afgekeurd(meldingen(&project)));
    }
    Ok(Uitkomst::Geladen(format!(
        "{} nodes, {} verwijzingen, geen meldingen",
        project.nodes.len(),
        project.links.len()
    )))
}

fn main() -> ExitCode {
    let paden: Vec<String> = std::env::args().skip(1).collect();
    if paden.is_empty() {
        eprintln!("gebruik: ifcx-project-controle <bestand.ifcx>...");
        return ExitCode::from(2);
    }
    let mut afgekeurd = 0usize;
    for pad in &paden {
        match controleer(Path::new(pad)) {
            Ok(Uitkomst::Geladen(samenvatting)) => println!("OK {pad}: {samenvatting}"),
            Ok(Uitkomst::Afgekeurd(reden)) => {
                afgekeurd += 1;
                println!("XX {pad}: {reden}");
            }
            Err(fout) => {
                eprintln!("{fout}");
                return ExitCode::from(2);
            }
        }
    }
    println!(
        "ifcx-explorer (ifcx-project): {} geladen, {afgekeurd} afgekeurd",
        paden.len() - afgekeurd
    );
    if afgekeurd > 0 {
        ExitCode::from(1)
    } else {
        ExitCode::SUCCESS
    }
}
