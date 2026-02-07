//! `blaze agent` - Agent workflow commands.

use crate::client::Client;
use crate::error::Result;
use crate::output::print_cards;
use crate::types::{AgentStatus, Card};
use serde::Serialize;

/// List cards ready for agent work
pub async fn list(client: &Client) -> Result<()> {
    let cards = client.list_agent_ready().await?;
    print_cards(&cards);
    Ok(())
}

/// Start working on a card (set status to in_progress)
pub async fn start(client: &Client, card_id: &str) -> Result<()> {
    let card = client.update_agent_status(card_id, AgentStatus::InProgress, None).await?;
    // Add initial progress entry
    let card = client.add_agent_progress(card_id, "Started work").await?;
    println!("{}", serde_json::to_string_pretty(&card)?);
    Ok(())
}

/// Add a progress entry
pub async fn progress(client: &Client, card_id: &str, message: &str) -> Result<()> {
    let card = client.add_agent_progress(card_id, message).await?;
    println!("{}", serde_json::to_string_pretty(&card)?);
    Ok(())
}

/// Mark card as blocked
pub async fn block(client: &Client, card_id: &str, reason: &str) -> Result<()> {
    let card = client.update_agent_status(card_id, AgentStatus::Blocked, Some(reason.to_string())).await?;
    // Add progress entry about blocking
    let card = client.add_agent_progress(card_id, &format!("Blocked: {}", reason)).await?;
    println!("{}", serde_json::to_string_pretty(&card)?);
    Ok(())
}

/// Mark card as done (set status to needs_review)
pub async fn done(client: &Client, card_id: &str) -> Result<()> {
    // Add completion progress entry
    let card = client.add_agent_progress(card_id, "Completed work").await?;
    let card = client.update_agent_status(card_id, AgentStatus::NeedsReview, None).await?;
    println!("{}", serde_json::to_string_pretty(&card)?);
    Ok(())
}

/// Check/uncheck an acceptance criterion
pub async fn check(client: &Client, card_id: &str, index: usize, checked: bool) -> Result<()> {
    let card = client.toggle_criterion(card_id, index, checked).await?;
    println!("{}", serde_json::to_string_pretty(&card)?);
    Ok(())
}
