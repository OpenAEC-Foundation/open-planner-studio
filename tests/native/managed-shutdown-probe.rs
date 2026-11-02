// CI-proces voor dezelfde afsluitbeslissing als de echte Linux-app, zonder GTK of Tauri te bouwen.
#[path = "../../src-tauri/src/linux_shutdown.rs"]
mod linux_shutdown;

use std::io::{self, BufRead, Write};
use std::sync::mpsc;

fn main() {
    let (sender, receiver) = mpsc::channel();
    std::thread::spawn(move || {
        for line in io::stdin().lock().lines() {
            if matches!(line.as_deref(), Ok("complete")) {
                let _ = sender.send(());
                break;
            }
        }
    });
    linux_shutdown::wait_for_confirmation(
        &receiver,
        linux_shutdown::RETRY_INTERVAL,
        || {
            println!("shutdown");
            io::stdout().flush().unwrap();
        },
        |code| std::process::exit(code),
    );
    // Terugkeer van de signaalthread beëindigt ook in de app het hoofdproces niet.
    loop {
        std::thread::park();
    }
}
