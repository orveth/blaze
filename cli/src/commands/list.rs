//! `blaze list` - List cards with optional filters.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_cards;
use crate::types::{Card, Column, Priority};
use chrono::Utc;

/// Filter options for listing cards
pub struct ListFilters {
    pub column: Option<Column>,
    pub priorities: Vec<Priority>,
    pub tags: Vec<String>,
    pub overdue: bool,
    pub include_archived: bool,
}

impl Default for ListFilters {
    fn default() -> Self {
        Self {
            column: None,
            priorities: Vec::new(),
            tags: Vec::new(),
            overdue: false,
            include_archived: false,
        }
    }
}

pub async fn run(client: &Client, filters: ListFilters) -> Result<()> {
    // Fetch cards (API supports column and include_archived filters)
    let cards = client.list_cards(filters.column, filters.include_archived).await?;

    // Apply client-side filters
    let filtered: Vec<Card> = cards
        .into_iter()
        .filter(|card| {
            // Priority filter
            if !filters.priorities.is_empty() && !filters.priorities.contains(&card.priority) {
                return false;
            }

            // Tag filter (card must have at least one matching tag)
            if !filters.tags.is_empty() {
                let has_matching_tag = filters.tags.iter().any(|t| card.tags.contains(t));
                if !has_matching_tag {
                    return false;
                }
            }

            // Overdue filter
            if filters.overdue {
                match &card.due_date {
                    Some(due) => {
                        if due >= &Utc::now() {
                            return false;
                        }
                    }
                    None => return false, // No due date = not overdue
                }
            }

            true
        })
        .collect();

    print_cards(&filtered);
    Ok(())
}
