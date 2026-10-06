#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod mcp_bridge;

use tauri::Manager;

/// Haal het bestaande venster naar voren (bevinding K5).
///
/// Wordt aangeroepen vanuit de single-instance-callback, dus IN het al draaiende proces: de
/// tweede start heeft zichzelf op dat moment al beëindigd. Zonder dit zou een tweede start
/// visueel niets doen — de gebruiker klikt op het icoon, er gebeurt niets, en hij klikt nog
/// eens. Het venster kan geminimaliseerd én verborgen zijn, dus alle drie de stappen.
fn focus_existing_window(app: &tauri::AppHandle) {
    // Het venster uit tauri.conf.json heeft geen expliciet `label`, dus Tauri noemt het "main".
    // De terugval dekt het geval dat daar ooit een ander label komt te staan.
    let window = app
        .get_webview_window("main")
        .or_else(|| app.webview_windows().into_values().next());
    if let Some(w) = window {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn main() {
    let mut builder = tauri::Builder::default();

    // ── Single instance (bevinding K5) ──────────────────────────────────────────────────────
    // Twee tegelijk draaiende vensters delen dezelfde `appDataDir` en daarmee dezelfde
    // recovery-snapshots: elke auto-save-ronde overschreef het manifest van de ander en ruimde
    // diens snapshots op. De recovery-laag is daar inmiddels defensief tegen (eigenaarschap in
    // het manifest, opruimen alleen binnen de eigen boekhouding), maar de echte oplossing is
    // dat het scenario niet meer bestaat.
    //
    // Deze plugin hoort volgens de plugin-README als EERSTE geregistreerd te worden ("plugins
    // run in the order they were added in to the builder"), vandaar de losse `builder` hierboven
    // in plaats van één doorlopende keten.
    //
    // Uitzondering: een dev-instantie (`OPS_DEV_INSTANCE`, gezet door scripts/tauri-dev.mjs).
    // Meerdere worktrees moeten hun desktop-build tegelijk kunnen draaien — dat is een
    // vastgelegde werkwijze (zie AGENTS.md) — en die instanties zijn al van elkaar geïsoleerd
    // via de worktree-slug in de recovery-bestandsnamen. De check staat bewust op runtime en
    // niet op `debug_assertions`, zodat deze tak gewoon meecompileert in `cargo check`.
    if std::env::var_os("OPS_DEV_INSTANCE").is_none() {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            focus_existing_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        // MCP-bridge-state (fase 1, Tauri-only): één actieve bridge of geen.
        .manage(mcp_bridge::BridgeState::default())
        // Alles wat hier staat is aanroepbaar via `window.__TAURI_INTERNALS__.invoke(...)`
        // en dus ook vanuit extensiecode in dezelfde realm. De vroegere
        // `read_file`/`write_file` waren daarmee een ongevalideerd lees-/schrijf-primitief
        // op het hele bestandssysteem, buiten de `plugin-fs`-scope om, zonder één gebruiker
        // in de frontend — daarom weg (bevinding K6a). Houd dit oppervlak klein.
        // `install_kind` is wél in gebruik: platform-introspectie voor de in-app updater
        // (env-read, geen domeinlogica). De twee mcp_bridge-commands sturen de MCP-bridge.
        .invoke_handler(tauri::generate_handler![
            commands::install_kind,
            mcp_bridge::mcp_bridge_start,
            mcp_bridge::mcp_bridge_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Planner Studio");
}
