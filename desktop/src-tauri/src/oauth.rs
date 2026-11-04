//! Google sign-in through the system browser: OAuth 2.0 authorization code with PKCE.
//!
//! Google refuses its sign-in page inside embedded app windows, so the app opens the browser,
//! gets the authorization code back (a loopback request on desktop, a deep link on Android) and
//! hands it to the web UI, which exchanges it for an ID token and signs in to Firebase with it.

use std::fmt;

use serde::{Deserialize, Serialize};
use url::Url;

const AUTH_ENDPOINT: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPE: &str = "openid email profile";

/// What the web UI asks for. `redirect_uri` is only given on Android, where the app's own
/// scheme (Google's reversed client id) is the redirect; on desktop the app picks a free port.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OAuthRequest {
    pub client_id: String,
    pub code_challenge: String,
    pub state: String,
    #[cfg_attr(desktop, allow(dead_code))] // read on Android only
    pub redirect_uri: Option<String>,
}

/// The authorization code and the redirect URI it was issued for (the token exchange needs both).
#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct OAuthResponse {
    pub code: String,
    pub redirect_uri: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum OAuthError {
    /// Google redirected back with an `error` (for example the user pressed Cancel).
    Denied(String),
    /// The redirect carried a different `state` than the one we sent: not our request.
    StateMismatch,
    MissingCode,
    BadRequest,
    TimedOut,
    Browser(String),
    Io(String),
}

impl fmt::Display for OAuthError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Denied(reason) => write!(f, "Google sign-in was not completed ({reason})"),
            Self::StateMismatch => write!(f, "the sign-in response did not match the request"),
            Self::MissingCode => write!(f, "the sign-in response had no code"),
            Self::BadRequest => write!(f, "the sign-in response could not be read"),
            Self::TimedOut => write!(f, "Google sign-in timed out"),
            Self::Browser(e) => write!(f, "could not open the browser: {e}"),
            Self::Io(e) => write!(f, "could not wait for the browser: {e}"),
        }
    }
}

impl std::error::Error for OAuthError {}

/// The Google consent URL for one sign-in attempt.
pub fn auth_url(
    client_id: &str,
    redirect_uri: &str,
    code_challenge: &str,
    state: &str,
) -> Result<Url, OAuthError> {
    Url::parse_with_params(
        AUTH_ENDPOINT,
        &[
            ("client_id", client_id),
            ("redirect_uri", redirect_uri),
            ("response_type", "code"),
            ("scope", SCOPE),
            ("code_challenge", code_challenge),
            ("code_challenge_method", "S256"),
            ("state", state),
        ],
    )
    .map_err(|_| OAuthError::BadRequest)
}

/// The authorization code in a redirect, after checking that it answers our request.
pub fn code_from_redirect(redirect: &Url, expected_state: &str) -> Result<String, OAuthError> {
    let param = |name: &str| {
        redirect
            .query_pairs()
            .find(|(key, _)| key == name)
            .map(|(_, value)| value.into_owned())
    };
    if let Some(reason) = param("error") {
        return Err(OAuthError::Denied(reason));
    }
    if param("state").as_deref() != Some(expected_state) {
        return Err(OAuthError::StateMismatch);
    }
    param("code")
        .filter(|code| !code.is_empty())
        .ok_or(OAuthError::MissingCode)
}

/// The full URL a browser requested, from the first line of its HTTP request (`GET /?code=… HTTP/1.1`).
#[cfg(any(desktop, test))]
pub fn redirect_from_request_line(line: &str, origin: &str) -> Result<Url, OAuthError> {
    let mut parts = line.split_whitespace();
    match (parts.next(), parts.next()) {
        (Some("GET"), Some(target)) if target.starts_with('/') => {
            Url::parse(&format!("{origin}{target}")).map_err(|_| OAuthError::BadRequest)
        }
        _ => Err(OAuthError::BadRequest),
    }
}

#[cfg(desktop)]
mod desktop {
    use std::io::{Read, Write};
    use std::net::{TcpListener, TcpStream};
    use std::time::{Duration, Instant};

    use super::{
        code_from_redirect, redirect_from_request_line, OAuthError, OAuthRequest, OAuthResponse,
    };

    const WAIT: Duration = Duration::from_secs(180);
    const PAGE: &str = "<!doctype html><meta charset=\"utf-8\"><title>MoatMine</title>\
        <body style=\"font-family:sans-serif;text-align:center;margin-top:20vh\">\
        <h2>You can close this tab</h2><p>Return to the MoatMine app.</p></body>";

    /// Waits on `listener` for the browser's redirect and returns the authorization code.
    ///
    /// Requests that carry neither a code nor an error (a favicon fetch, a port scan) are
    /// answered and ignored. A request with the wrong `state` ends the attempt.
    pub fn serve_redirect(
        listener: &TcpListener,
        state: &str,
        wait: Duration,
    ) -> Result<String, OAuthError> {
        let port = listener
            .local_addr()
            .map_err(|e| OAuthError::Io(e.to_string()))?
            .port();
        let origin = format!("http://127.0.0.1:{port}");
        listener
            .set_nonblocking(true)
            .map_err(|e| OAuthError::Io(e.to_string()))?;
        let deadline = Instant::now() + wait;
        loop {
            match listener.accept() {
                Ok((stream, _)) => {
                    if let Some(result) = handle(stream, &origin, state) {
                        return result;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    if Instant::now() >= deadline {
                        return Err(OAuthError::TimedOut);
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
                Err(e) => return Err(OAuthError::Io(e.to_string())),
            }
        }
    }

    fn handle(
        mut stream: TcpStream,
        origin: &str,
        state: &str,
    ) -> Option<Result<String, OAuthError>> {
        stream.set_nonblocking(false).ok()?;
        stream.set_read_timeout(Some(Duration::from_secs(5))).ok()?;
        let mut buf = [0u8; 4096];
        let read = stream.read(&mut buf).ok()?;
        let request = String::from_utf8_lossy(&buf[..read]);
        let line = request.lines().next().unwrap_or_default();
        let redirect = redirect_from_request_line(line, origin).ok();
        let result = redirect
            .as_ref()
            .filter(|url| url.query_pairs().any(|(k, _)| k == "code" || k == "error"))
            .map(|url| code_from_redirect(url, state));
        let status = if result.is_some() {
            "200 OK"
        } else {
            "404 Not Found"
        };
        let body = if result.is_some() { PAGE } else { "" };
        let _ = write!(
            stream,
            "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        result
    }

    /// Opens Google's consent page and waits for the browser to come back to a loopback port.
    pub fn sign_in(
        open: impl FnOnce(&str) -> Result<(), String>,
        request: &OAuthRequest,
    ) -> Result<OAuthResponse, OAuthError> {
        let listener =
            TcpListener::bind(("127.0.0.1", 0)).map_err(|e| OAuthError::Io(e.to_string()))?;
        let port = listener
            .local_addr()
            .map_err(|e| OAuthError::Io(e.to_string()))?
            .port();
        let redirect_uri = format!("http://127.0.0.1:{port}");
        let url = super::auth_url(
            &request.client_id,
            &redirect_uri,
            &request.code_challenge,
            &request.state,
        )?;
        open(url.as_str()).map_err(OAuthError::Browser)?;
        let code = serve_redirect(&listener, &request.state, WAIT)?;
        Ok(OAuthResponse { code, redirect_uri })
    }
}

#[cfg(desktop)]
pub use desktop::sign_in as desktop_sign_in;

#[cfg(test)]
mod tests {
    use super::*;

    fn url(s: &str) -> Url {
        Url::parse(s).unwrap()
    }

    #[test]
    fn auth_url_carries_every_parameter_google_needs() {
        let u = auth_url(
            "id.apps.googleusercontent.com",
            "http://127.0.0.1:5000",
            "chal",
            "st&te",
        )
        .unwrap();
        let q: std::collections::HashMap<_, _> = u.query_pairs().into_owned().collect();
        assert_eq!(u.host_str(), Some("accounts.google.com"));
        assert_eq!(q["client_id"], "id.apps.googleusercontent.com");
        assert_eq!(q["redirect_uri"], "http://127.0.0.1:5000");
        assert_eq!(q["response_type"], "code");
        assert_eq!(q["scope"], "openid email profile");
        assert_eq!(q["code_challenge"], "chal");
        assert_eq!(q["code_challenge_method"], "S256");
        assert_eq!(q["state"], "st&te");
    }

    #[test]
    fn code_from_redirect_checks_the_answer_before_returning_the_code() {
        let cases = [
            ("http://x/?code=abc&state=s1", Ok("abc".to_string())),
            ("http://x/?state=s1&code=a%2Fb", Ok("a/b".to_string())),
            (
                "http://x/?code=abc&state=other",
                Err(OAuthError::StateMismatch),
            ),
            ("http://x/?code=abc", Err(OAuthError::StateMismatch)),
            ("http://x/?state=s1", Err(OAuthError::MissingCode)),
            ("http://x/?state=s1&code=", Err(OAuthError::MissingCode)),
            (
                "http://x/?error=access_denied&state=s1",
                Err(OAuthError::Denied("access_denied".into())),
            ),
        ];
        for (redirect, expected) in cases {
            assert_eq!(
                code_from_redirect(&url(redirect), "s1"),
                expected,
                "{redirect}"
            );
        }
    }

    #[test]
    fn redirect_from_request_line_accepts_only_a_plain_get_for_a_path() {
        let ok = redirect_from_request_line("GET /?code=1&state=2 HTTP/1.1", "http://127.0.0.1:9")
            .unwrap();
        assert_eq!(ok.as_str(), "http://127.0.0.1:9/?code=1&state=2");
        for bad in [
            "",
            "POST /?code=1 HTTP/1.1",
            "GET http://evil/?code=1 HTTP/1.1",
            "GET",
            "garbage",
        ] {
            assert_eq!(
                redirect_from_request_line(bad, "http://127.0.0.1:9"),
                Err(OAuthError::BadRequest),
                "{bad}"
            );
        }
    }

    #[cfg(desktop)]
    mod loopback {
        use std::io::{Read, Write};
        use std::net::{TcpListener, TcpStream};
        use std::time::Duration;

        use super::super::desktop::serve_redirect;
        use super::super::OAuthError;

        /// Sends each request to a listener on a thread and returns what the listener resolved to.
        fn run(
            requests: &[&str],
            state: &str,
            wait: Duration,
        ) -> (Result<String, OAuthError>, Vec<String>) {
            let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
            let port = listener.local_addr().unwrap().port();
            let client = {
                let requests: Vec<String> = requests.iter().map(|r| r.to_string()).collect();
                std::thread::spawn(move || {
                    requests
                        .iter()
                        .map(|path| {
                            let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
                            write!(s, "GET {path} HTTP/1.1\r\nHost: x\r\n\r\n").unwrap();
                            let mut reply = String::new();
                            s.read_to_string(&mut reply).unwrap();
                            reply.lines().next().unwrap_or_default().to_string()
                        })
                        .collect::<Vec<_>>()
                })
            };
            let result = serve_redirect(&listener, state, wait);
            (result, client.join().unwrap())
        }

        #[test]
        fn returns_the_code_and_ignores_unrelated_requests_first() {
            let (result, replies) = run(
                &["/favicon.ico", "/?code=abc&state=s"],
                "s",
                Duration::from_secs(5),
            );
            assert_eq!(result, Ok("abc".to_string()));
            assert_eq!(replies, ["HTTP/1.1 404 Not Found", "HTTP/1.1 200 OK"]);
        }

        #[test]
        fn rejects_a_redirect_with_the_wrong_state() {
            let (result, _) = run(&["/?code=abc&state=evil"], "s", Duration::from_secs(5));
            assert_eq!(result, Err(OAuthError::StateMismatch));
        }

        #[test]
        fn times_out_when_the_browser_never_comes_back() {
            let (result, _) = run(&[], "s", Duration::from_millis(200));
            assert_eq!(result, Err(OAuthError::TimedOut));
        }
    }
}
