#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        // Bewuste native IPC-escape-hatch — `read_file`/`write_file` zijn vandaag
        // ongebruikt door de frontend (die gebruikt de JS-fs/dialog-plugins). Zie
        // commands/mod.rs voordat je ze verwijdert. `install_kind` is wél in
        // gebruik: platform-introspectie voor de in-app updater (env-read, geen
        // domeinlogica).
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
            commands::install_kind,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Planner Studio");
}
