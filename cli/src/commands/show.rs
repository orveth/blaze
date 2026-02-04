//! `blaze show <id>` - Show card details.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_card_detail;

pub async fn run(client: &Client, card_id: &str) -> Result<()> {
    let card = client.get_card(card_id).await?;
    print_card_detail(&card);
    Ok(())
}
