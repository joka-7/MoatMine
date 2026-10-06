// The desktop app is a thin shell: it loads the same Next.js UI (static export)
// and talks to the same Render API as the web app. No business logic lives here.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // open news / note links in the system browser instead of inside the app window
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Folio desktop");
}
