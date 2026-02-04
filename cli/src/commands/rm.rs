//! `blaze rm` - Delete a card.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_json;
use serde::Serialize;
use std::io::{self, Write};

#[derive(Serialize)]
struct DeleteResult {
    deleted: bool,
    id: String,
    title: String,
}

pub async fn run(client: &Client, card_id: &str, force: bool) -> Result<()> {
    // Fetch card details for confirmation
    let card = client.get_card(card_id).await?;

    if !force {
        eprint!(
            "Delete card \"{}\" ({})? [y/N] ",
            card.title,
            &card.id[..8.min(card.id.len())]
        );
        io::stderr().flush().unwrap();

        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();
        
        if !input.trim().eq_ignore_ascii_case("y") {
            let result = DeleteResult {
                deleted: false,
                id: card.id,
                title: card.title,
            };
            print_json(&result);
            return Ok(());
        }
    }

    client.delete_card(card_id).await?;
    let result = DeleteResult {
        deleted: true,
        id: card.id,
        title: card.title,
    };
    print_json(&result);
    Ok(())
}
