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

    /// Get a single card
    pub async fn get_card(&self, id: &str) -> Result<Card> {
        self.get(&format!("/api/cards/{}", id)).await
    }

    /// Create a new card
    #[allow(dead_code)]
    pub async fn create_card(&self, card: &CardCreate) -> Result<Card> {
        self.post("/api/cards", card).await
    }

    /// Update a card
    #[allow(dead_code)]
    pub async fn update_card(&self, id: &str, update: &CardUpdate) -> Result<Card> {
        self.put(&format!("/api/cards/{}", id), update).await
    }

    /// Move a card to a different column
    #[allow(dead_code)]
    pub async fn move_card(&self, id: &str, column: Column) -> Result<Card> {
        self.patch(&format!("/api/cards/{}/move", id), &CardMove { column }).await
    }

    /// Delete a card
    #[allow(dead_code)]
    pub async fn delete_card(&self, id: &str) -> Result<()> {
        self.delete(&format!("/api/cards/{}", id)).await
    }

    /// Get board statistics
    pub async fn stats(&self) -> Result<BoardStats> {
        self.get("/api/board/stats").await
    }

    // --- Plan Methods ---

    /// List all plans
    pub async fn list_plans(&self, status: Option<PlanStatus>) -> Result<Vec<Plan>> {
        let path = match status {
            Some(s) => format!("/api/plans?status={}", s),
            None => "/api/plans".to_string(),
        };
        self.get(&path).await
    }

    /// Get a single plan
    pub async fn get_plan(&self, id: &str) -> Result<Plan> {
        self.get(&format!("/api/plans/{}", id)).await
    }

    /// Create a new plan
    #[allow(dead_code)]
    pub async fn create_plan(&self, plan: &PlanCreate) -> Result<Plan> {
        self.post("/api/plans", plan).await
    }

    /// Update a plan
    #[allow(dead_code)]
    pub async fn update_plan(&self, id: &str, update: &PlanUpdate) -> Result<Plan> {
        self.patch(&format!("/api/plans/{}", id), update).await
    }

    /// Delete a plan
    #[allow(dead_code)]
    pub async fn delete_plan(&self, id: &str) -> Result<()> {
        self.delete(&format!("/api/plans/{}", id)).await
    }

    /// Add a file to a plan
    #[allow(dead_code)]
    pub async fn add_plan_file(&self, plan_id: &str, file: &PlanFileCreate) -> Result<Plan> {
        self.post(&format!("/api/plans/{}/files", plan_id), file).await
    }

    /// Get a file from a plan
    pub async fn get_plan_file(&self, plan_id: &str, filename: &str) -> Result<PlanFile> {
        self.get(&format!("/api/plans/{}/files/{}", plan_id, filename)).await
    }

    /// Update a file in a plan
    #[allow(dead_code)]
    pub async fn update_plan_file(&self, plan_id: &str, filename: &str, update: &PlanFileUpdate) -> Result<Plan> {
        self.patch(&format!("/api/plans/{}/files/{}", plan_id, filename), update).await
    }

    /// Delete a file from a plan
    #[allow(dead_code)]
    pub async fn delete_plan_file(&self, plan_id: &str, filename: &str) -> Result<Plan> {
        self.delete_with_response(&format!("/api/plans/{}/files/{}", plan_id, filename)).await
    }
}

impl Client {
    /// Make a DELETE request that returns a response body
    async fn delete_with_response<T: DeserializeOwned>(&self, path: &str) -> Result<T> {
        let url = format!("{}{}", self.base_url, path);
        let resp = self
            .http
            .delete(&url)
            .headers(self.headers())
            .send()
            .await?;

        self.handle_response(resp).await
    }
}
