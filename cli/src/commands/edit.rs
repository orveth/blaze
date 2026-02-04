//! `blaze edit` - Update an existing card.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_card_detail;
use crate::types::{CardUpdate, Column, Priority};
use chrono::{NaiveDate, TimeZone, Utc};

pub struct EditOptions {
    pub card_id: String,
    pub title: Option<String>,
    pub description: Option<String>,
    pub column: Option<Column>,
    pub priority: Option<Priority>,
    pub tags_add: Vec<String>,
    pub tags_remove: Vec<String>,
    pub due: Option<String>,
    pub clear_due: bool,
}

pub async fn run(client: &Client, options: EditOptions) -> Result<()> {
    // If we're modifying tags, fetch current card first
    let tags = if !options.tags_add.is_empty() || !options.tags_remove.is_empty() {
        let current = client.get_card(&options.card_id).await?;
        let mut tags = current.tags;
        
        // Add new tags
        for tag in &options.tags_add {
            if !tags.contains(tag) {
                tags.push(tag.clone());
            }
        }
        
        // Remove tags
        tags.retain(|t| !options.tags_remove.contains(t));
        
        Some(tags)
    } else {
        None
    };

    // Parse due date if provided
    let due_date = if options.clear_due {
        // Explicitly clear the due date - but we need a way to signal this
        // For now, we'll skip it if clear_due is set and let the API handle it
        None
    } else {
        match options.due {
            Some(ref s) => {
                let date = NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .map_err(|_| crate::error::BlazeError::InvalidInput(
                        format!("Invalid date format '{}'. Use YYYY-MM-DD", s)
                    ))?;
                Some(Utc.from_utc_datetime(&date.and_hms_opt(23, 59, 59).unwrap()))
            }
            None => None,
        }
    };

    let update = CardUpdate {
        title: options.title,
        description: options.description,
        column: options.column,
        priority: options.priority,
        tags,
        due_date,
    };

    // Check if any fields are being updated
    if update.title.is_none()
        && update.description.is_none()
        && update.column.is_none()
        && update.priority.is_none()
        && update.tags.is_none()
        && update.due_date.is_none()
        && !options.clear_due
    {
        return Err(crate::error::BlazeError::InvalidInput(
            "No fields to update. Specify at least one option.".into()
        ));
    }

    let updated = client.update_card(&options.card_id, &update).await?;
    print_card_detail(&updated);
    Ok(())
}
