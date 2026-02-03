//! Output formatting for CLI commands.

use crate::types::{BoardStats, Card, Column};
use clap::ValueEnum;
use colored::Colorize;
use serde::Serialize;
use tabled::{
    settings::{object::Columns, Alignment, Modify, Style},
    Table, Tabled,
};

/// Output format options
#[derive(Debug, Clone, Copy, Default, ValueEnum)]
pub enum OutputFormat {
    /// Human-readable table format
    #[default]
    Table,
    /// JSON format for scripting
    Json,
    /// Quiet mode (IDs only)
    Quiet,
}

/// Row representation for the cards table
#[derive(Tabled)]
struct CardRow {
    #[tabled(rename = "ID")]
    id: String,
    #[tabled(rename = "TITLE")]
    title: String,
    #[tabled(rename = "PRIORITY")]
    priority: String,
    #[tabled(rename = "COLUMN")]
    column: String,
    #[tabled(rename = "DUE")]
    due: String,
    #[tabled(rename = "TAGS")]
    tags: String,
}

impl From<&Card> for CardRow {
    fn from(card: &Card) -> Self {
        let priority_str = format!("{} {}", card.priority.emoji(), card.priority);
        let due_str = match &card.due_date {
            Some(dt) => {
                let now = chrono::Utc::now();
                if dt < &now {
                    format!("{}", dt.format("%b %d").to_string().red())
                } else {
                    dt.format("%b %d").to_string()
                }
            }
            None => "-".to_string(),
        };
        let tags_str = if card.tags.is_empty() {
            "-".to_string()
        } else {
            card.tags.join(", ")
        };

        Self {
            id: card.id[..8.min(card.id.len())].to_string(),
            title: truncate(&card.title, 40),
            priority: priority_str,
            column: card.column.display_name().to_string(),
            due: due_str,
            tags: truncate(&tags_str, 20),
        }
    }
}

/// Truncate string with ellipsis if too long
fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}…", &s[..max_len - 1])
    }
}

/// Print a list of cards in the specified format
pub fn print_cards(cards: &[Card], format: OutputFormat) {
    match format {
        OutputFormat::Table => print_cards_table(cards),
        OutputFormat::Json => print_json(cards),
        OutputFormat::Quiet => print_cards_quiet(cards),
    }
}

fn print_cards_table(cards: &[Card]) {
    if cards.is_empty() {
        println!("{}", "No cards found.".dimmed());
        return;
    }

    let rows: Vec<CardRow> = cards.iter().map(CardRow::from).collect();
    let table = Table::new(rows)
        .with(Style::rounded())
        .with(Modify::new(Columns::first()).with(Alignment::left()))
        .to_string();

    println!("{}", table);
}

fn print_cards_quiet(cards: &[Card]) {
    for card in cards {
        println!("{}", card.id);
    }
}

/// Print a single card in detail
pub fn print_card_detail(card: &Card, format: OutputFormat) {
    match format {
        OutputFormat::Table => print_card_detail_table(card),
        OutputFormat::Json => print_json(card),
        OutputFormat::Quiet => println!("{}", card.id),
    }
}

fn print_card_detail_table(card: &Card) {
    println!("{}", "─".repeat(50).dimmed());
    println!(
        "{} {} {}",
        card.priority.emoji(),
        card.title.bold(),
        format!("({})", &card.id[..8.min(card.id.len())]).dimmed()
    );
    println!("{}", "─".repeat(50).dimmed());

    println!("  {} {}", "Column:".dimmed(), card.column.display_name());
    println!("  {} {}", "Priority:".dimmed(), card.priority);

    if let Some(ref desc) = card.description {
        println!();
        println!("  {}", "Description:".dimmed());
        for line in desc.lines() {
            println!("    {}", line);
        }
    }

    if let Some(ref due) = card.due_date {
        let now = chrono::Utc::now();
        let due_str = if due < &now {
            format!("{} (overdue)", due.format("%Y-%m-%d %H:%M")).red().to_string()
        } else {
            due.format("%Y-%m-%d %H:%M").to_string()
        };
        println!("  {} {}", "Due:".dimmed(), due_str);
    }

    if !card.tags.is_empty() {
        let tags: Vec<String> = card.tags.iter().map(|t| format!("#{}", t)).collect();
        println!("  {} {}", "Tags:".dimmed(), tags.join(" "));
    }

    println!();
    println!(
        "  {} {}",
        "Created:".dimmed(),
        card.created_at.format("%Y-%m-%d %H:%M")
    );
    println!(
        "  {} {}",
        "Updated:".dimmed(),
        card.updated_at.format("%Y-%m-%d %H:%M")
    );
}

/// Print board summary (column counts)
pub fn print_board_summary(cards: &[Card], format: OutputFormat) {
    match format {
        OutputFormat::Table => print_board_table(cards),
        OutputFormat::Json => {
            let summary = build_board_summary(cards);
            print_json(&summary);
        }
        OutputFormat::Quiet => {
            // Just print column counts as "column:count" lines
            let summary = build_board_summary(cards);
            for (col, count) in summary {
                println!("{}:{}", col, count);
            }
        }
    }
}

fn build_board_summary(cards: &[Card]) -> Vec<(String, usize)> {
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
            (col.display_name().to_string(), count)
        })
        .collect()
}

fn print_board_table(cards: &[Card]) {
    let columns = [
        Column::Backlog,
        Column::Todo,
        Column::InProgress,
        Column::Review,
        Column::Done,
    ];

    let total = cards.len();

    println!();
    println!("  {}", "BOARD OVERVIEW".bold());
    println!("  {}", "─".repeat(30).dimmed());

    for col in &columns {
        let count = cards.iter().filter(|c| c.column == *col).count();
        let bar_width = if total > 0 { (count * 20) / total.max(1) } else { 0 };
        let bar = "█".repeat(bar_width);
        let bar_colored = match col {
            Column::Backlog => bar.dimmed().to_string(),
            Column::Todo => bar.blue().to_string(),
            Column::InProgress => bar.yellow().to_string(),
            Column::Review => bar.cyan().to_string(),
            Column::Done => bar.green().to_string(),
        };

        println!(
            "  {:12} {:>3}  {}",
            col.display_name(),
            count,
            bar_colored
        );
    }

    println!("  {}", "─".repeat(30).dimmed());
    println!("  {:12} {:>3}", "Total".bold(), total);
    println!();
}

/// Print board statistics
pub fn print_stats(stats: &BoardStats, format: OutputFormat) {
    match format {
        OutputFormat::Table => print_stats_table(stats),
        OutputFormat::Json => print_json(stats),
        OutputFormat::Quiet => {
            println!("total:{}", stats.total_cards);
            println!("overdue:{}", stats.overdue_count);
        }
    }
}

fn print_stats_table(stats: &BoardStats) {
    println!();
    println!("  {}", "BOARD STATISTICS".bold());
    println!("  {}", "─".repeat(40).dimmed());

    println!("  {} {}", "Total cards:".dimmed(), stats.total_cards);

    if stats.overdue_count > 0 {
        println!(
            "  {} {}",
            "Overdue:".dimmed(),
            stats.overdue_count.to_string().red()
        );
    } else {
        println!("  {} 0", "Overdue:".dimmed());
    }

    println!();
    println!("  {}", "By Column:".dimmed());
    let col_order = ["backlog", "todo", "in_progress", "review", "done"];
    for col_name in &col_order {
        let count = stats.by_column.get(*col_name).unwrap_or(&0);
        let display = match *col_name {
            "backlog" => "Backlog",
            "todo" => "Todo",
            "in_progress" => "In Progress",
            "review" => "Review",
            "done" => "Done",
            _ => col_name,
        };
        println!("    {:12} {}", display, count);
    }

    println!();
    println!("  {}", "By Priority:".dimmed());
    let pri_order = ["urgent", "high", "medium", "low"];
    for pri_name in &pri_order {
        let count = stats.by_priority.get(*pri_name).unwrap_or(&0);
        let emoji = match *pri_name {
            "urgent" => "🔴",
            "high" => "🟠",
            "medium" => "🟡",
            "low" => "🟢",
            _ => "",
        };
        println!("    {} {:8} {}", emoji, pri_name, count);
    }

    println!();
}

/// Print any serializable value as JSON
pub fn print_json<T: Serialize + ?Sized>(value: &T) {
    match serde_json::to_string_pretty(value) {
        Ok(json) => println!("{}", json),
        Err(e) => eprintln!("Error serializing to JSON: {}", e),
    }
}
