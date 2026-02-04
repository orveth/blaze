//! `blaze move` and `blaze done` - Move cards between columns.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_card_detail;
use crate::types::Column;

pub async fn run(client: &Client, card_id: &str, column: Column) -> Result<()> {
    let moved = client.move_card(card_id, column).await?;
    print_card_detail(&moved);
    Ok(())
}

/// Shortcut for moving to done
pub async fn run_done(client: &Client, card_id: &str) -> Result<()> {
    run(client, card_id, Column::Done).await
}
