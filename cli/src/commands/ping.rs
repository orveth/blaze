//! `blaze ping` - Check API connectivity.

use crate::client::Client;
use crate::error::Result;
use colored::Colorize;

pub async fn run(url: &str) -> Result<()> {
    let client = Client::new(url, None)?;

    match client.health().await {
        Ok(resp) => {
            if resp.status == "ok" {
                println!("{} Connected to {}", "✓".green(), url);
                Ok(())
            } else {
                println!("{} Unexpected status: {}", "⚠".yellow(), resp.status);
                Ok(())
            }
        }
        Err(e) => {
            println!("{} Failed to connect to {}", "✗".red(), url);
            println!("  {}", e);
            Err(e)
        }
    }
}
