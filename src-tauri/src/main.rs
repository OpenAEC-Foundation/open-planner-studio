#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
#[cfg(target_os = "linux")]
mod desktop_integration;
mod launch_files;
mod mcp_bridge;

use std::sync::Mutex;
use tauri::{Emitter, Listener, Manager};

/// Meegegeven bestanden die nog naar de webview moeten (issue #1091, zie `launch_files`).
struct LaunchState(Mutex<launch_files::LaunchQueue>);

/// Geef nieuwe paden aan de wachtrij en stuur wat nu weg mag naar de webview. Een vergiftigde mutex
/// (een paniek in een andere draad) houdt de paden niet tegen: de wachtrij zelf is dan nog heel.
fn deliver_launch_files(app: &tauri::AppHandle, take: impl FnOnce(&mut launch_files::LaunchQueue) -> Vec<String>) {
    let Some(state) = app.try_state::<LaunchState>() else { return };
    let paths = {
        let mut queue = state.0.lock().unwrap_or_else(|e| e.into_inner());
        take(&mut *queue)
    };
    if !paths.is_empty() {
        let _ = app.emit(launch_files::OPEN_FILES_EVENT, paths);
    }
}

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

/// Vangnet voor het verborgen startvenster (issue #895).
///
/// `tauri.conf.json` maakt het hoofdvenster verborgen aan; de webview toont het zelf zodra de eerste
/// weergave af is, of met een foutscherm als de start mislukt (`src/startup/appWindow.ts`). Draait er
/// helemaal geen JavaScript (een kapotte bundel, een webview die niet laadt), dan zou het proces
/// onzichtbaar blijven. Daarom toont deze draad het venster na 10 s alsnog als het dan nog verborgen
/// is. Geen command: niets in de webview kan dit aanroepen.
fn reveal_window_fallback(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(10));
        if let Some(w) = app.get_webview_window("main") {
            if !w.is_visible().unwrap_or(true) {
                let _ = w.show();
            }
        }
    });
}

/// Proces-id van de app voor de webview, als initialisatiescript (issue #570).
///
/// De MCP-plugin leest `runtime.json` en `open-files.json` in `<appDataDir>/mcp/` en herkent een
/// achtergebleven bestand aan een proces-id dat niet meer leeft (`docs/mcp-ontdekking.md`). Geen
/// JS-API van Tauri of een plugin geeft dat id, en een command hiervoor zou nieuw publiek oppervlak
/// zijn (AGENTS.md: precies vier commands). Daarom zet deze plugin zonder commands het id vóór de
/// eerste regel app-code als alleen-lezen `window.__OPS_PROCESS__.pid`, net zoals `tauri-plugin-os`
/// zijn platformgegevens injecteert. Alleen het hoofdframe; het id is geen geheim.
fn process_info_plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    tauri::plugin::Builder::new("ops-process-info")
        .js_init_script(format!(
            "Object.defineProperty(window, '__OPS_PROCESS__', {{ value: Object.freeze({{ pid: {} }}), writable: false, configurable: false }});",
            std::process::id()
        ))
        .build()
}

fn main() {
    // Installatietype één keer per proces bepalen, vroeg en buiten de UI-thread (zie
    // `commands::install_kind`): later kan het programmapad al vervangen zijn door een pakketupdate.
    std::thread::spawn(commands::warm_install_kind);
    // AppImage: menu-item en logo voor de gebruiker neerzetten (zie `desktop_integration`).
    #[cfg(target_os = "linux")]
    std::thread::spawn(desktop_integration::integrate_appimage);

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
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            focus_existing_window(app);
            // Een tweede start met een bestand (issue #1091): open het in dit venster. Een relatief pad
            // gaat uit van de werkmap van die tweede start, niet van deze.
            let paths = launch_files::launch_file_paths(argv, std::path::Path::new(&cwd));
            deliver_launch_files(app, |queue| queue.offer(paths));
        }));
    }

    builder
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // De kiezer verleent toegang buiten $HOME alleen voor deze sessie. Bewaar die
        // toestemming voor Recent na een herstart; deze plugin moet ná fs staan.
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(process_info_plugin())
        // MCP-bridge-state (fase 1, Tauri-only): één actieve bridge of geen.
        .manage(mcp_bridge::BridgeState::default())
        // Bestanden uit de opdrachtregel van deze start (issue #1091). Ze wachten tot de webview luistert.
        .manage(LaunchState(Mutex::new(launch_files::LaunchQueue::new(launch_files::launch_file_paths(
            std::env::args_os(),
            &std::env::current_dir().unwrap_or_default(),
        )))))
        .setup(|app| {
            reveal_window_fallback(app.handle().clone());
            // Het klaarsignaal van de webview (`src/state/launchFiles.ts`): een event, geen command.
            let handle = app.handle().clone();
            app.listen_any(launch_files::OPEN_FILES_READY_EVENT, move |_| {
                deliver_launch_files(&handle, launch_files::LaunchQueue::mark_ready);
            });
            Ok(())
        })
        // Alles wat hier staat is aanroepbaar via `window.__TAURI_INTERNALS__.invoke(...)`
        // en dus ook vanuit extensiecode in dezelfde realm. De vroegere
        // `read_file`/`write_file` waren daarmee een ongevalideerd lees-/schrijf-primitief
        // op het hele bestandssysteem, buiten de `plugin-fs`-scope om, zonder één gebruiker
        // in de frontend — daarom weg (bevinding K6a). Houd dit oppervlak klein.
        // `install_kind` is wél in gebruik: platform-introspectie voor de in-app updater
        // (env-read, geen domeinlogica). De twee mcp_bridge-commands sturen de MCP-bridge.
        // `place_file_exclusive` plaatst één bestand exclusief onder een nieuwe naam in dezelfde
        // map, alleen met een eigen hulpnaam en binnen de fs-scope (#804, knownbug 1131).
        .invoke_handler(tauri::generate_handler![
            commands::install_kind,
            commands::place_file::place_file_exclusive,
            mcp_bridge::mcp_bridge_start,
            mcp_bridge::mcp_bridge_stop,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Planner Studio");
}
