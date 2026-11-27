use std::collections::BTreeSet;
use std::path::Path;
use std::process::ExitCode;

use ifcx_project::{load_files, seal_files, Files, LoadedProject};
use serde_json::{json, Value};

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

fn controleer_pakket(id: &str, bestanden: Files) -> Uitkomst {
    let pakket = match seal_files(PROJECT, id, bestanden) {
        Ok(pakket) => pakket,
        Err(fout) => return Uitkomst::Afgekeurd(fout.code),
    };
    let project = match load_files(pakket) {
        Ok(project) => project,
        Err(fout) => return Uitkomst::Afgekeurd(fout.code),
    };
    if !project.warnings.is_empty() {
        return Uitkomst::Afgekeurd(meldingen(&project));
    }
    Uitkomst::Geladen(format!(
        "{} nodes, {} verwijzingen, geen meldingen",
        project.nodes.len(),
        project.links.len()
    ))
}

fn ontbrekende_modeldoelen(document: &Value) -> BTreeSet<&str> {
    let Some(data) = document["data"].as_array() else {
        return BTreeSet::new();
    };
    if !data.iter().any(|entry| {
        let attributen = &entry["attributes"];
        attributen["openaec::planning::workplan"].is_object()
            && attributen["openaec::ops::modelSource"].is_object()
    }) {
        return BTreeSet::new();
    }
    let eigen: BTreeSet<_> = data.iter().filter_map(|entry| entry["path"].as_str()).collect();
    data.iter()
        .filter(|entry| entry["attributes"]["openaec::ops::task"].is_object())
        .filter_map(|entry| entry["attributes"]["openaec::links"].as_array())
        .flatten()
        .filter(|link| link["relation"] == "schedules")
        .filter_map(|link| link["target"].as_str())
        .filter(|doel| !eigen.contains(doel))
        .collect()
}

fn controleer(pad: &Path) -> Result<Uitkomst, String> {
    let bytes = std::fs::read(pad)
        .map_err(|fout| format!("{} is niet te lezen ({:?})", pad.display(), fout.kind()))?;
    let naam = pad
        .file_name()
        .and_then(|naam| naam.to_str())
        .ok_or_else(|| format!("{} heeft geen bruikbare bestandsnaam", pad.display()))?
        .to_owned();
    let Ok(document) = serde_json::from_slice::<Value>(&bytes) else {
        return Ok(Uitkomst::Afgekeurd("INVALID_JSON".into()));
    };
    let Some(id) = document.pointer("/header/id").and_then(|id| id.as_str()) else {
        return Ok(Uitkomst::Afgekeurd("INVALID_HEADER".into()));
    };
    let modelnaam = format!("modeldoelen-{naam}");
    let mut bestanden = Files::new();
    bestanden.insert(naam, bytes);
    let doelen = ontbrekende_modeldoelen(&document);
    if doelen.is_empty() {
        return Ok(controleer_pakket(id, bestanden));
    }
    match controleer_pakket(id, bestanden.clone()) {
        Uitkomst::Afgekeurd(code) if code == "MISSING_REFERENCE" => {}
        Uitkomst::Afgekeurd(code) => return Ok(Uitkomst::Afgekeurd(code)),
        Uitkomst::Geladen(_) => {
            return Ok(Uitkomst::Afgekeurd("Ontbrekende schedules-doelen zijn aanvaard".into()));
        }
    }
    let model_id = format!("{id}:modeldoelen");
    let met_model = |weggelaten: Option<&str>| {
        let data: Vec<_> = doelen.iter().copied()
            .filter(|doel| Some(*doel) != weggelaten)
            .map(|doel| json!({ "path": doel }))
            .collect();
        let model = json!({
            "header": { "id": model_id, "ifcxVersion": "ifcx_alpha", "dataVersion": "1.0.0" },
            "imports": [{ "uri": id }], "schemas": {}, "data": data
        });
        let mut pakket = bestanden.clone();
        pakket.insert(modelnaam.clone(), model.to_string().into_bytes());
        controleer_pakket(&model_id, pakket)
    };
    for doel in &doelen {
        match met_model(Some(doel)) {
            Uitkomst::Afgekeurd(code) if code == "MISSING_REFERENCE" => {}
            Uitkomst::Afgekeurd(code) => return Ok(Uitkomst::Afgekeurd(format!("zonder {doel}: {code}"))),
            Uitkomst::Geladen(_) => return Ok(Uitkomst::Afgekeurd(format!("Het pakket zonder {doel} is aanvaard"))),
        }
    }
    Ok(match met_model(None) {
        Uitkomst::Geladen(info) => Uitkomst::Geladen(format!(
            "alleen MISSING_REFERENCE; met schedules-doelen {}: {info}", doelen.into_iter().collect::<Vec<_>>().join(", ")
        )),
        fout => fout,
    })
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
