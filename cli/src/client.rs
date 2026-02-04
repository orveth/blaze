//! HTTP client for the Blaze API.

use crate::error::{BlazeError, Result};
use crate::types::*;
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::Client as HttpClient;
use serde::de::DeserializeOwned;

/// Blaze API client
pub struct Client {
    http: HttpClient,
    base_url: String,
    token: Option<String>,
}

impl Client {
    /// Create a new API client
    pub fn new(base_url: &str, token: Option<String>) -> Result<Self> {
        let http = HttpClient::builder()
            .build()
            .map_err(BlazeError::Http)?;

        Ok(Self {
            http,
            base_url: base_url.trim_end_matches('/').to_string(),
            token,
        })
    }

    /// Get headers including auth if token is set
    fn headers(&self) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Some(ref token) = self.token {
            if let Ok(value) = HeaderValue::from_str(&format!("Bearer {}", token)) {
                headers.insert(AUTHORIZATION, value);
            }
        }
        headers
    }

    /// Make a GET request
    async fn get<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .get(&url)
            .headers(self.headers())
            .send()
            .await?;

        self.handle_response(resp).await
    }

    /// Make a POST request with JSON body
    #[allow(dead_code)]
    async fn post<B: serde::Serialize, T: DeserializeOwned>(&self, path: &str, body: &B) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .post(&url)
            .headers(self.headers())
            .json(body)
            .send()
            .await?;

        self.handle_response(resp).await
    }

    /// Make a PUT request with JSON body
    #[allow(dead_code)]
    async fn put<B: serde::Serialize, T: DeserializeOwned>(&self, path: &str, body: &B) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .put(&url)
            .headers(self.headers())
            .json(body)
            .send()
            .await?;

        self.handle_response(resp).await
    }

    /// Make a PATCH request with JSON body
    #[allow(dead_code)]
    async fn patch<B: serde::Serialize, T: DeserializeOwned>(&self, path: &str, body: &B) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .patch(&url)
            .headers(self.headers())
            .json(body)
            .send()
            .await?;

        self.handle_response(resp).await
    }

    /// Make a DELETE request
    #[allow(dead_code)]
    async fn delete(&self, path: &str) -> Result<()> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .delete(&url)
            .headers(self.headers())
            .send()
            .await?;

        if resp.status() == reqwest::StatusCode::NO_CONTENT {
            return Ok(());
        }

        let status = resp.status().as_u16();
        if !resp.status().is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(BlazeError::Api {
                status,
                message: text,
            });
        }

        Ok(())
    }

    /// Handle API response, extracting errors
    async fn handle_response<T: DeserializeOwned>(&self, resp: reqwest::Response) -> Result<T> {
        let status = resp.status();

        if status == reqwest::StatusCode::UNAUTHORIZED {
            return Err(BlazeError::Auth("Invalid or missing token".into()));
        }

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(BlazeError::Api {
                status: status.as_u16(),
                message: text,
            });
        }

        let body = resp.json().await?;
        Ok(body)
    }

    // --- API Methods ---

    /// Health check (no auth required)
    pub async fn health(&self) -> Result<HealthResponse> {
        self.get("/health").await
    }

    /// List all cards
    pub async fn list_cards(&self, column: Option<Column>) -> Result<Vec<Card>> {
        let path = match column {
            Some(col) => format!("/api/cards?column={}", col),
            None => "/api/cards".to_string(),
        };
        self.get(&path).await
    }

    /// Resolve a potentially short card ID to a full ID.
    /// Supports prefix matching if the given ID is shorter than the full length.
    async fn resolve_card_id(&self, short_id: &str) -> Result<String> {
        // If it looks like a full ID (12 chars), use it directly
        if short_id.len() >= 12 {
            return Ok(short_id.to_string());
        }

        // Otherwise, fetch all cards and find matches
        let cards = self.list_cards(None).await?;
        let matches: Vec<&Card> = cards
            .iter()
            .filter(|card| card.id.starts_with(short_id))
            .collect();

        match matches.len() {
            0 => Err(BlazeError::Api {
                status: 404,
                message: format!("No card found matching ID prefix '{}'", short_id),
            }),
            1 => Ok(matches[0].id.clone()),
            _ => Err(BlazeError::Api {
                status: 400,
                message: format!(
                    "Ambiguous ID prefix '{}': matches {} cards. Use a longer prefix.",
                    short_id,
                    matches.len()
                ),
            }),
        }
    }

    /// Get a single card (supports short ID prefix matching)
    pub async fn get_card(&self, id: &str) -> Result<Card> {
        let full_id = self.resolve_card_id(id).await?;
        self.get(&format!("/api/cards/{}", full_id)).await
    }

    /// Create a new card
    #[allow(dead_code)]
    pub async fn create_card(&self, card: &CardCreate) -> Result<Card> {
        self.post("/api/cards", card).await
    }

    /// Update a card (supports short ID prefix matching)
    #[allow(dead_code)]
    pub async fn update_card(&self, id: &str, update: &CardUpdate) -> Result<Card> {
        let full_id = self.resolve_card_id(id).await?;
        self.put(&format!("/api/cards/{}", full_id), update).await
    }

    /// Move a card to a different column (supports short ID prefix matching)
    #[allow(dead_code)]
    pub async fn move_card(&self, id: &str, column: Column) -> Result<Card> {
        let full_id = self.resolve_card_id(id).await?;
        self.patch(&format!("/api/cards/{}/move", full_id), &CardMove { column }).await
    }

    /// Delete a card (supports short ID prefix matching)
    #[allow(dead_code)]
    pub async fn delete_card(&self, id: &str) -> Result<()> {
        let full_id = self.resolve_card_id(id).await?;
        self.delete(&format!("/api/cards/{}", full_id)).await
    }

    /// Get board statistics
    pub async fn stats(&self) -> Result<BoardStats> {
        self.get("/api/board/stats").await
    }
}
