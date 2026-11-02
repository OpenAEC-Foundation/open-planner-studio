//! Contract voor OpenAEC Linux (Blueprint #61). Geen eigen container of nieuwe commands.
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{Emitter, Listener};
use tauri_plugin_fs::FsExt;

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Environment {
    pub managed: bool,
    pub directory: Option<PathBuf>,
    pub initial_file: Option<PathBuf>,
    pub mcp: Option<Mcp>,
}

#[derive(Clone, serde::Serialize)]
pub struct Mcp {
    pub port: u16,
    pub token: String,
}

static ENVIRONMENT: OnceLock<Environment> = OnceLock::new();

pub fn managed() -> bool {
    ENVIRONMENT.get().is_some_and(|e| e.managed)
}

pub fn prepare() -> Result<(), Box<dyn std::error::Error>> {
    let cwd = std::env::current_dir()?;
    // AppRun zet cwd op APPDIR/usr voor de WebKit-helpers. Niet terug veranderen: gebruik de
    // oorspronkelijke shellmap alleen voor het oplossen van het startargument.
    let start_dir = if std::env::var_os("APPDIR").is_some() {
        ["OWD", "PWD"]
            .into_iter()
            .filter_map(std::env::var_os)
            .map(PathBuf::from)
            .find(|p| p.is_absolute())
            .unwrap_or(cwd.clone())
    } else {
        cwd.clone()
    };
    let initial_file = std::env::args_os().nth(1).map(|p| start_dir.join(p));
    let directory = std::env::var_os("OPENAEC_MAP")
        .map(|p| std::fs::canonicalize(start_dir.join(p)))
        .transpose()?;
    if let Some(dir) = &directory {
        if !dir.is_dir() {
            return Err("OPENAEC_MAP is geen map".into());
        }
    }
    let managed = std::env::var("OPENAEC_BEHEERD").as_deref() == Ok("1");
    let mcp = parse_mcp(
        std::env::var("OPENAEC_MCP_POORT").ok(),
        std::env::var("OPENAEC_MCP_GEHEIM").ok(),
    )?;
    // WebKit-kindprocessen en extern geopende programma's erven dit geheim niet.
    std::env::remove_var("OPENAEC_MCP_GEHEIM");
    if managed {
        if std::env::var_os("WAYLAND_DISPLAY").is_some()
            && std::env::var_os("APPDIR").is_some()
            && std::env::var("GDK_BACKEND").as_deref() == Ok("x11")
        {
            // De linuxdeploy-GTK-hook forceert x11; OpenAEC Linux levert alleen Wayland.
            std::env::set_var("GDK_BACKEND", "wayland");
        }
        // CPU-rendering werkt ook zonder /dev/dri. Laat een expliciete beheerderkeuze staan.
        for (key, value) in [
            ("LIBGL_ALWAYS_SOFTWARE", "1"),
            ("WEBKIT_DISABLE_DMABUF_RENDERER", "1"),
            ("WEBKIT_DISABLE_COMPOSITING_MODE", "1"),
        ] {
            if std::env::var_os(key).is_none() {
                std::env::set_var(key, value);
            }
        }
        std::env::set_var("OPS_NO_DESKTOP_INTEGRATION", "1");
    }
    let _ = ENVIRONMENT.set(Environment {
        managed,
        directory,
        initial_file,
        mcp,
    });
    Ok(())
}

fn parse_mcp(
    port: Option<String>,
    token: Option<String>,
) -> Result<Option<Mcp>, Box<dyn std::error::Error>> {
    match (port, token) {
        (None, None) => Ok(None),
        (Some(port), Some(token)) => {
            let port = port
                .parse::<u16>()
                .ok()
                .filter(|p| *p > 0)
                .ok_or("OPENAEC_MCP_POORT moet tussen 1 en 65535 liggen")?;
            if token.len() < 32
                || token.len() > 4096
                || !token.bytes().all(|b| (0x21..=0x7e).contains(&b))
            {
                return Err(
                    "OPENAEC_MCP_GEHEIM moet 32 tot 4096 zichtbare ASCII-tekens bevatten".into(),
                );
            }
            Ok(Some(Mcp { port, token }))
        }
        _ => Err("OPENAEC_MCP_POORT en OPENAEC_MCP_GEHEIM zijn samen verplicht".into()),
    }
}

pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    let env = ENVIRONMENT
        .get()
        .expect("Linux-omgeving vóór Tauri initialiseren")
        .clone();
    let script = format!(
        "Object.defineProperty(window, '__OPS_LINUX__', {{value:Object.freeze({}),writable:false,configurable:false}});",
        serde_json::to_string(&env).expect("Linux-omgeving serialiseren")
    );
    tauri::plugin::Builder::new("ops-linux-environment")
        .js_init_script(script)
        .setup(move |app, _| {
            if let Some(dir) = &env.directory {
                app.fs_scope().allow_directory(dir, true)?;
            }
            if let Some(path) = &env.initial_file {
                app.fs_scope().allow_file(path)?;
            }
            if env.managed {
                let mut signals =
                    signal_hook::iterator::Signals::new([signal_hook::consts::SIGTERM])?;
                let app = app.clone();
                std::thread::spawn(move || {
                    if signals.forever().next().is_none() {
                        return;
                    }
                    eprintln!("[openaec] SIGTERM: wacht op herstelopslag");
                    let (tx, rx) = std::sync::mpsc::channel();
                    let listener = app.listen("openaec://shutdown-complete", move |_| {
                        let _ = tx.send(());
                    });
                    // Ook tijdens het opstarten: herhaal tot de webview zijn luisteraar heeft.
                    let confirmed = crate::linux_shutdown::wait_for_confirmation(
                        &rx,
                        crate::linux_shutdown::RETRY_INTERVAL,
                        || {
                            let _ = app.emit("openaec://shutdown", ());
                        },
                        |code| {
                            app.unlisten(listener);
                            app.exit(code);
                        },
                    );
                    if !confirmed {
                        eprintln!(
                            "[openaec] herstelopslag niet bevestigd; afsluiten met foutstatus"
                        );
                    }
                });
            }
            eprintln!("[openaec] managed={}", env.managed);
            Ok(())
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mcp_is_explicit_and_validated_without_echoing_secrets() {
        assert!(parse_mcp(None, None).unwrap().is_none());
        assert!(parse_mcp(Some("3877".into()), None).is_err());
        assert!(parse_mcp(None, Some("a".repeat(64))).is_err());
        for port in ["0", "65536", "-1", " 3877", ""] {
            assert!(parse_mcp(Some(port.into()), Some("a".repeat(64))).is_err());
        }
        for token in [
            "kort".into(),
            "a".repeat(4097),
            format!("{}\n", "a".repeat(64)),
        ] {
            assert!(parse_mcp(Some("3877".into()), Some(token)).is_err());
        }
        assert_eq!(
            parse_mcp(Some("3877".into()), Some("a".repeat(64)))
                .unwrap()
                .unwrap()
                .port,
            3877
        );
    }
}
