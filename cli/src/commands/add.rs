//! `blaze add` - Create a new card.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_card_detail;
use crate::types::{CardCreate, Column, Priority};
use chrono::{NaiveDate, TimeZone, Utc};

pub struct AddOptions {
    pub title: String,
    pub description: Option<String>,
    pub column: Column,
    pub priority: Priority,
    pub tags: Vec<String>,
    pub due: Option<String>,
}

pub async fn run(client: &Client, options: AddOptions) -> Result<()> {
    // Parse due date if provided
    let due_date = match options.due {
        Some(ref s) => {
            let date = NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .map_err(|_| crate::error::BlazeError::InvalidInput(
                    format!("Invalid date format '{}'. Use YYYY-MM-DD", s)
                ))?;
            // Set to end of day UTC
            Some(Utc.from_utc_datetime(&date.and_hms_opt(23, 59, 59).unwrap()))
        }
        None => None,
    };

    let card = CardCreate {
        title: options.title,
        description: options.description,
        column: options.column,
        priority: options.priority,
        tags: options.tags,
        due_date,
    };

    let created = client.create_card(&card).await?;
    print_card_detail(&created);
    Ok(())
}
