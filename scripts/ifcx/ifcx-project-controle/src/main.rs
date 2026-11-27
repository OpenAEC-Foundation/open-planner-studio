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
                "{} op {}",
                melding.code,
                melding.node.as_deref().unwrap_or("het pakket")
            )
        })
        .collect();
    if project.warnings.len() > MAX_GENOEMD {
        regels.push(format!("en nog {}", project.warnings.len() - MAX_GENOEMD));
    }
    format!("meldingen: {}", regels.join("; "))
}

fn controleer(pad: &Path) -> Result<Uitkomst, String> {
    let bytes = std::fs::read(pad)
        .map_err(|fout| format!("{} is niet te lezen ({:?})", pad.display(), fout.kind()))?;
    let naam = pad
        .file_name()
        .and_then(|naam| naam.to_str())
        .ok_or_else(|| format!("{} heeft geen bruikbare bestandsnaam", pad.display()))?
        .to_owned();
    let Ok(document) = serde_json::from_slice::<serde_json::Value>(&bytes) else {
        return Ok(Uitkomst::Afgekeurd("INVALID_JSON".into()));
    };
    let Some(id) = document.pointer("/header/id").and_then(|id| id.as_str()) else {
        return Ok(Uitkomst::Afgekeurd("INVALID_HEADER".into()));
    };
    let mut bestanden = Files::new();
    bestanden.insert(naam, bytes);
    let pakket = match seal_files(PROJECT, id, bestanden) {
        Ok(pakket) => pakket,
        Err(fout) => return Ok(Uitkomst::Afgekeurd(fout.code)),
    };
    let project = match load_files(pakket) {
        Ok(project) => project,
        Err(fout) => return Ok(Uitkomst::Afgekeurd(fout.code)),
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
    std::panic::set_hook(Box::new(|_| {
        eprintln!("Het controleprogramma brak af. De melding staat niet in de log, omdat ze uit ifcx-explorer kan komen.");
    }));
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
