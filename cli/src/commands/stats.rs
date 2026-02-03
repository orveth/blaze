//! `blaze stats` - Show detailed board statistics.

use crate::client::Client;
use crate::error::Result;
use crate::output::{print_stats, OutputFormat};

pub async fn run(client: &Client, format: OutputFormat) -> Result<()> {
    let stats = client.stats().await?;
    print_stats(&stats, format);
    Ok(())
}
