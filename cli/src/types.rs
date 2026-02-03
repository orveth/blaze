//! Type definitions matching the Blaze API.

use chrono::{DateTime, Utc};
use clap::ValueEnum;
use serde::{Deserialize, Serialize};
use std::fmt;

/// Card priority levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

impl fmt::Display for Priority {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Priority::Low => write!(f, "low"),
            Priority::Medium => write!(f, "medium"),
            Priority::High => write!(f, "high"),
            Priority::Urgent => write!(f, "urgent"),
        }
    }
}

impl Priority {
    /// Get colored emoji representation
    pub fn emoji(&self) -> &'static str {
        match self {
            Priority::Low => "🟢",
            Priority::Medium => "🟡",
            Priority::High => "🟠",
            Priority::Urgent => "🔴",
        }
    }
}

/// Board columns (workflow stages)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "snake_case")]
#[clap(rename_all = "snake_case")]
pub enum Column {
    Backlog,
    Todo,
    InProgress,
    Review,
    Done,
}

impl fmt::Display for Column {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Column::Backlog => write!(f, "backlog"),
            Column::Todo => write!(f, "todo"),
            Column::InProgress => write!(f, "in_progress"),
            Column::Review => write!(f, "review"),
            Column::Done => write!(f, "done"),
        }
    }
}

impl Column {
    /// Human-readable display name
    pub fn display_name(&self) -> &'static str {
        match self {
            Column::Backlog => "Backlog",
            Column::Todo => "Todo",
            Column::InProgress => "In Progress",
            Column::Review => "Review",
            Column::Done => "Done",
        }
    }
}

/// Full card model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Card {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub priority: Priority,
    pub column: Column,
    pub due_date: Option<DateTime<Utc>>,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default)]
    pub position: i32,
}

/// Request body for creating a card
#[derive(Debug, Serialize)]
pub struct CardCreate {
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    pub priority: Priority,
    pub column: Column,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due_date: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
}

/// Request body for updating a card
#[derive(Debug, Default, Serialize)]
pub struct CardUpdate {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<Priority>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub column: Option<Column>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub due_date: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// Request body for moving a card
#[derive(Debug, Serialize)]
pub struct CardMove {
    pub column: Column,
}

/// Board statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardStats {
    pub total_cards: i32,
    pub by_column: std::collections::HashMap<String, i32>,
    pub by_priority: std::collections::HashMap<String, i32>,
    pub overdue_count: i32,
}

/// Health check response
#[derive(Debug, Deserialize)]
pub struct HealthResponse {
    pub status: String,
}
