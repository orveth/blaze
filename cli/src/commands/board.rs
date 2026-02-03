//! `blaze board` - Show board overview (column summary).

use crate::client::Client;
use crate::error::Result;
use crate::output::{print_board_summary, OutputFormat};

pub async fn run(client: &Client, format: OutputFormat) -> Result<()> {
    let cards = client.list_cards(None).await?;
    print_board_summary(&cards, format);
    Ok(())
}
