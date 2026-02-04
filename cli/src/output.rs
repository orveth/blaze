//! Output formatting for CLI commands - JSON only.

use crate::types::{BoardStats, Card, Column};
use serde::Serialize;

/// Print a list of cards as JSON
pub fn print_cards(cards: &[Card]) {
    print_json(cards);
}

/// Print a single card as JSON
pub fn print_card_detail(card: &Card) {
    print_json(card);
}

/// Print board summary as JSON
pub fn print_board_summary(cards: &[Card]) {
    let summary = build_board_summary(cards);
    print_json(&summary);
}

fn build_board_summary(cards: &[Card]) -> Vec<ColumnSummary> {
    let columns = [
        Column::Backlog,
        Column::Todo,
        Column::InProgress,
        Column::Review,
        Column::Done,
    ];

    columns
        .iter()
        .map(|col| {
            let count = cards.iter().filter(|c| c.column == *col).count();
            ColumnSummary {
                column: col.display_name().to_string(),
                count,
            }
        })
        .collect()
}

#[derive(Serialize)]
struct ColumnSummary {
    column: String,
    count: usize,
}

/// Print board statistics as JSON
pub fn print_stats(stats: &BoardStats) {
    print_json(stats);
}

/// Print any serializable value as JSON
pub fn print_json<T: Serialize + ?Sized>(value: &T) {
    match serde_json::to_string_pretty(value) {
        Ok(json) => println!("{}", json),
        Err(e) => eprintln!("Error serializing to JSON: {}", e),
    }
}
