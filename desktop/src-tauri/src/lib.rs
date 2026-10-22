// The desktop app is a thin shell: it loads the same Next.js UI (static export)
// and talks to the same Render API as the web app. No business logic lives here.
// The one thing it does for the UI is the browser leg of Google sign-in (see oauth.rs).

mod oauth;

use oauth::{OAuthRequest, OAuthResponse};
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;

fn open_in_browser(app: &AppHandle, url: &str) -> Result<(), String> {
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

/// Desktop: open Google's page in the browser and wait for it to redirect to a loopback port.
#[cfg(desktop)]
#[tauri::command]
async fn google_oauth(app: AppHandle, request: OAuthRequest) -> Result<OAuthResponse, String> {
    tauri::async_runtime::spawn_blocking(move || {
        oauth::desktop_sign_in(|url| open_in_browser(&app, url), &request)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| e.to_string())
}

/// Android: open Google's page in the browser and wait for the app's deep link to come back.
#[cfg(mobile)]
#[tauri::command]
async fn google_oauth(
    app: AppHandle,
    waiting: tauri::State<'_, mobile::PendingRedirect>,
    request: OAuthRequest,
) -> Result<OAuthResponse, String> {
    mobile::sign_in(&app, &waiting, request)
        .await
        .map_err(|e| e.to_string())
}

#[cfg(mobile)]
mod mobile {
    use std::sync::mpsc::{channel, Sender};
    use std::sync::Mutex;
    use std::time::Duration;

    use tauri::AppHandle;
    use url::Url;

    use super::{open_in_browser, OAuthRequest, OAuthResponse};
    use crate::oauth::{auth_url, code_from_redirect, OAuthError};

    const WAIT: Duration = Duration::from_secs(180);

    /// Where the deep-link handler delivers the redirect of the sign-in that is in progress.
    #[derive(Default)]
    pub struct PendingRedirect(pub Mutex<Option<Sender<Url>>>);

    pub async fn sign_in(
        app: &AppHandle,
        waiting: &PendingRedirect,
        request: OAuthRequest,
    ) -> Result<OAuthResponse, OAuthError> {
        let redirect_uri = request.redirect_uri.clone().ok_or(OAuthError::BadRequest)?;
        let url = auth_url(
            &request.client_id,
            &redirect_uri,
            &request.code_challenge,
            &request.state,
        )?;
        let (tx, rx) = channel();
        *waiting
            .0
            .lock()
            .map_err(|_| OAuthError::Io("lock poisoned".into()))? = Some(tx);
        open_in_browser(app, url.as_str()).map_err(OAuthError::Browser)?;
        let state = request.state.clone();
        let expected = redirect_uri.clone();
        let code = tauri::async_runtime::spawn_blocking(move || loop {
            let redirect = rx.recv_timeout(WAIT).map_err(|_| OAuthError::TimedOut)?;
            // anything else that opens the app (a stray link) is not our answer
            if redirect.as_str().starts_with(&expected) {
                return code_from_redirect(&redirect, &state);
            }
        })
        .await
        .map_err(|e| OAuthError::Io(e.to_string()))??;
        Ok(OAuthResponse { code, redirect_uri })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        // open news / note links in the system browser instead of inside the app window
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![google_oauth]);

    #[cfg(mobile)]
    let builder = builder
        .plugin(tauri_plugin_deep_link::init())
        .manage(mobile::PendingRedirect::default())
        .setup(|app| {
            use tauri::Manager;
            use tauri_plugin_deep_link::DeepLinkExt;
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                let waiting = handle.state::<mobile::PendingRedirect>();
                let Ok(slot) = waiting.0.lock() else { return };
                if let Some(tx) = slot.as_ref() {
                    for url in event.urls() {
                        let _ = tx.send(url);
                    }
                }
            });
            Ok(())
        });

    builder
        .run(tauri::generate_context!())
        .expect("error while running MoatMine desktop");
}
