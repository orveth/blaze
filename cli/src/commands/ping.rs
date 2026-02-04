//! `blaze ping` - Check API connectivity.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_json;
use serde::Serialize;

#[derive(Serialize)]
struct PingResult {
    ok: bool,
    url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

pub async fn run(url: &str) -> Result<()> {
    let client = Client::new(url, None)?;

    match client.health().await {
        Ok(resp) => {
            let result = PingResult {
                ok: resp.status == "ok",
                url: url.to_string(),
                error: if resp.status != "ok" {
                    Some(format!("Unexpected status: {}", resp.status))
                } else {
                    None
                },
            };
            print_json(&result);
            Ok(())
        }
        Err(e) => {
            let result = PingResult {
                ok: false,
                url: url.to_string(),
                error: Some(e.to_string()),
            };
            print_json(&result);
            Err(e)
        }
    }
}
