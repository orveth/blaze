//! Blaze CLI - Command-line interface for the Blaze task board.
//! 
//! All output is JSON for machine parsing and full ID visibility.

mod client;
mod commands;
mod config;
mod error;
mod output;
mod types;

use clap::{Parser, Subcommand};
use commands::{add, board, edit, list, move_card, ping, rm, show, stats};
use types::{Column, Priority};

#[derive(Parser)]
#[command(name = "blaze")]
#[command(about = "CLI for Blaze task board (JSON output)", long_about = None)]
#[command(version)]
struct Cli {
    /// API base URL
    #[arg(long, global = true, env = "BLAZE_URL")]
    url: Option<String>,

    /// API token
    #[arg(long, global = true, env = "BLAZE_TOKEN")]
    token: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Check API connectivity
    Ping,

    /// List cards (with optional filters)
    List {
        /// Filter by column
        #[arg(short, long)]
        column: Option<Column>,

        /// Filter by priority (comma-separated: high,urgent)
        #[arg(short, long, value_delimiter = ',')]
        priority: Vec<Priority>,

        /// Filter by tag (cards with any matching tag)
        #[arg(short, long, value_delimiter = ',')]
        tag: Vec<String>,

        /// Show only overdue cards
        #[arg(long)]
        overdue: bool,
    },

    /// Show card details
    Show {
        /// Card ID
        card_id: String,
    },

    /// Show board overview (column counts)
    Board,

    /// Show detailed board statistics
    Stats,

    /// Create a new card
    Add {
        /// Card title
        title: String,

        /// Card description
        #[arg(short, long)]
        desc: Option<String>,

        /// Column to place the card in
        #[arg(short, long, default_value = "todo")]
        column: Column,

        /// Priority level
        #[arg(short, long, default_value = "medium")]
        priority: Priority,

        /// Tags (comma-separated)
        #[arg(short, long, value_delimiter = ',')]
        tag: Vec<String>,

        /// Due date (YYYY-MM-DD)
        #[arg(long)]
        due: Option<String>,
    },

    /// Update an existing card
    Edit {
        /// Card ID
        card_id: String,

        /// New title
        #[arg(long)]
        title: Option<String>,

        /// New description
        #[arg(long)]
        desc: Option<String>,

        /// Move to column
        #[arg(short, long)]
        column: Option<Column>,

        /// Set priority
        #[arg(short, long)]
        priority: Option<Priority>,

        /// Add tag (prefix with + or just the tag name)
        #[arg(long = "tag", value_name = "TAG")]
        tags_add: Vec<String>,

        /// Remove tag (prefix with -)
        #[arg(long = "untag", value_name = "TAG")]
        tags_remove: Vec<String>,

        /// Set due date (YYYY-MM-DD)
        #[arg(long)]
        due: Option<String>,

        /// Clear due date
        #[arg(long)]
        clear_due: bool,
    },

    /// Move a card to a different column
    Move {
        /// Card ID
        card_id: String,

        /// Target column
        column: Column,
    },

    /// Mark a card as done (shortcut for move to done)
    Done {
        /// Card ID
        card_id: String,
    },

    /// Delete a card
    Rm {
        /// Card ID
        card_id: String,

        /// Skip confirmation prompt
        #[arg(short, long)]
        force: bool,
    },
}

#[tokio::main]
async fn main() {
    if let Err(e) = run().await {
        eprintln!("Error: {e}");
        std::process::exit(1);
    }
}

async fn run() -> error::Result<()> {
    let cli = Cli::parse();

    // Load config, with CLI args taking precedence
    let cfg = config::Config::load()?;
    let url = cli
        .url
        .or(cfg.url)
        .unwrap_or_else(|| "http://localhost:8080".to_string());
    let token = cli.token.or(cfg.token);

    match cli.command {
        Commands::Ping => ping::run(&url).await,

        Commands::List {
            column,
            priority,
            tag,
            overdue,
        } => {
            let client = client::Client::new(&url, token)?;
            let filters = list::ListFilters {
                column,
                priorities: priority,
                tags: tag,
                overdue,
            };
            list::run(&client, filters).await
        }

        Commands::Show { card_id } => {
            let client = client::Client::new(&url, token)?;
            show::run(&client, &card_id).await
        }

        Commands::Board => {
            let client = client::Client::new(&url, token)?;
            board::run(&client).await
        }

        Commands::Stats => {
            let client = client::Client::new(&url, token)?;
            stats::run(&client).await
        }

        Commands::Add {
            title,
            desc,
            column,
            priority,
            tag,
            due,
        } => {
            let client = client::Client::new(&url, token)?;
            let options = add::AddOptions {
                title,
                description: desc,
                column,
                priority,
                tags: tag,
                due,
            };
            add::run(&client, options).await
        }

        Commands::Edit {
            card_id,
            title,
            desc,
            column,
            priority,
            tags_add,
            tags_remove,
            due,
            clear_due,
        } => {
            let client = client::Client::new(&url, token)?;
            let options = edit::EditOptions {
                card_id,
                title,
                description: desc,
                column,
                priority,
                tags_add,
                tags_remove,
                due,
                clear_due,
            };
            edit::run(&client, options).await
        }

        Commands::Move { card_id, column } => {
            let client = client::Client::new(&url, token)?;
            move_card::run(&client, &card_id, column).await
        }

        Commands::Done { card_id } => {
            let client = client::Client::new(&url, token)?;
            move_card::run_done(&client, &card_id).await
        }

        Commands::Rm { card_id, force } => {
            let client = client::Client::new(&url, token)?;
            rm::run(&client, &card_id, force).await
        }
    }
}
