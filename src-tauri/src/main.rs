#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_os::init())
        // Bewuste native IPC-escape-hatch — deze commands zijn vandaag ongebruikt
        // door de frontend (die gebruikt de JS-fs/dialog-plugins). Zie
        // commands/mod.rs voordat je ze verwijdert.
        .invoke_handler(tauri::generate_handler![
            commands::read_file,
            commands::write_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Planner Studio");
}
