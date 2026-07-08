//! WellBeing Companion — native shell.
//!
//! The Rust layer is deliberately small and boring: tray icon, autostart,
//! close-to-tray, and a dedicated always-on-top reminder popup window that is
//! shown WITHOUT stealing focus. All health logic lives in the frontend; it
//! talks to this layer exclusively through the commands below.

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow, WindowEvent,
};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};

const MAIN: &str = "main";
const POPUP: &str = "popup";

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(MAIN)
}

fn popup_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(POPUP)
}

fn show_main_window(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Pin the popup to the bottom-right corner of the work area (above the
/// taskbar/tray), on whatever monitor the popup would appear on.
fn position_popup(w: &WebviewWindow) {
    let monitor = w
        .primary_monitor()
        .ok()
        .flatten()
        .or_else(|| w.current_monitor().ok().flatten());
    let Some(m) = monitor else { return };
    let Ok(size) = w.outer_size() else { return };
    let wa = m.work_area();
    let margin = (16.0 * m.scale_factor()).round() as i32;
    let x = wa.position.x + wa.size.width as i32 - size.width as i32 - margin;
    let y = wa.position.y + wa.size.height as i32 - size.height as i32 - margin;
    let _ = w.set_position(PhysicalPosition::new(x, y));
}

#[tauri::command]
fn show_main(app: AppHandle) {
    show_main_window(&app);
}

#[tauri::command]
fn hide_main(app: AppHandle) {
    if let Some(w) = main_window(&app) {
        let _ = w.hide();
    }
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

/// Show the reminder popup. `payload` is an opaque JSON blob owned by the
/// frontend ({kind,title,body,icon,accent,timeoutMs,actions}); we forward it
/// verbatim to the popup webview after positioning + showing the window.
#[tauri::command]
fn show_popup(app: AppHandle, payload: serde_json::Value) -> Result<(), String> {
    let w = popup_window(&app).ok_or("popup window missing")?;
    position_popup(&w);
    w.emit("popup:show", &payload).map_err(|e| e.to_string())?;
    w.show().map_err(|e| e.to_string())?;
    // Re-assert on every show — some window managers drop the flag.
    let _ = w.set_always_on_top(true);
    Ok(())
}

#[tauri::command]
fn hide_popup(app: AppHandle) {
    if let Some(w) = popup_window(&app) {
        let _ = w.hide();
    }
}

/// A button was clicked in the popup (or its timeout elapsed). Hide the popup,
/// forward the action to the main window, and bring the app up when the user
/// asked to start the break.
#[tauri::command]
fn popup_action(app: AppHandle, action: String, kind: String) {
    if let Some(w) = popup_window(&app) {
        let _ = w.hide();
    }
    if action == "open" {
        show_main_window(&app);
    }
    let _ = app.emit_to(
        MAIN,
        "popup:action",
        serde_json::json!({ "action": action, "kind": kind }),
    );
}

#[tauri::command]
fn set_autostart(app: AppHandle, enable: bool) -> Result<bool, String> {
    let manager = app.autolaunch();
    if enable {
        manager.enable().map_err(|e| e.to_string())?;
    } else {
        manager.disable().map_err(|e| e.to_string())?;
    }
    Ok(enable)
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second launch (e.g. autostart already running, user opens the
            // shortcut): surface the existing instance instead.
            show_main_window(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .invoke_handler(tauri::generate_handler![
            show_main,
            hide_main,
            quit_app,
            show_popup,
            hide_popup,
            popup_action,
            set_autostart,
            get_autostart,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Tray -------------------------------------------------------
            let open_i = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
            let break_i =
                MenuItem::with_id(app, "break", "Take a break now", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit WellBeing", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_i, &break_i, &sep, &quit_i])?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("WellBeing Companion")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => show_main_window(app),
                    "break" => {
                        show_main_window(app);
                        let _ = app.emit_to(MAIN, "tray:break", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            // Startup visibility ------------------------------------------
            // Autostart launches us with `--hidden`: stay in the tray.
            // A normal launch shows the dashboard.
            let hidden = std::env::args().any(|a| a == "--hidden" || a == "--minimized");
            if !hidden {
                show_main_window(app.handle());
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Close-to-tray for the main window only; keep the app alive.
            if window.label() == MAIN {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
