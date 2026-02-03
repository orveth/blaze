//! `blaze rm` - Delete a card.

use crate::client::Client;
use crate::error::Result;
use colored::Colorize;
use std::io::{self, Write};

pub async fn run(client: &Client, card_id: &str, force: bool) -> Result<()> {
    // Fetch card details for confirmation
    let card = client.get_card(card_id).await?;

    if !force {
        print!(
            "{} Delete card \"{}\" ({})? [y/N] ",
            "⚠".yellow(),
            card.title,
            &card.id[..8.min(card.id.len())]
        );
        io::stdout().flush().unwrap();

        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();
        
        if !input.trim().eq_ignore_ascii_case("y") {
            println!("{}", "Cancelled.".dimmed());
            return Ok(());
        }
    }

    client.delete_card(card_id).await?;
    println!("{} Deleted card \"{}\"", "✓".green(), card.title);
    Ok(())
}
