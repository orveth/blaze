//! `blaze stats` - Show detailed board statistics.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_stats;

pub async fn run(client: &Client) -> Result<()> {
    let stats = client.stats().await?;
    print_stats(&stats);
    Ok(())
}
