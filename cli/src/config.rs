//! Configuration file handling for Blaze CLI.
//!
//! Config location: ~/.config/blaze/config.toml
//! Token location: ~/.config/blaze/token (separate file, not in config.toml)

use crate::error::{BlazeError, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Config {
    /// API base URL
    pub url: Option<String>,
    /// API token (loaded separately from token file)
    #[serde(skip)]
    pub token: Option<String>,
}

impl Config {
    /// Get the config directory path (~/.config/blaze/)
    pub fn dir() -> Option<PathBuf> {
        dirs::config_dir().map(|d| d.join("blaze"))
    }

    /// Get the config file path
    pub fn path() -> Option<PathBuf> {
        Self::dir().map(|d| d.join("config.toml"))
    }

    /// Get the token file path
    pub fn token_path() -> Option<PathBuf> {
        Self::dir().map(|d| d.join("token"))
    }

    /// Load config from disk (or return defaults)
    pub fn load() -> Result<Self> {
        let mut config = Self::load_config_file()?;
        config.token = Self::load_token()?;
        Ok(config)
    }

    /// Load just the config.toml file
    fn load_config_file() -> Result<Self> {
        let path = match Self::path() {
            Some(p) => p,
            None => return Ok(Self::default()),
        };

        if !path.exists() {
            return Ok(Self::default());
        }

        let content = fs::read_to_string(&path).map_err(|e| {
            BlazeError::Config(format!("Failed to read {}: {}", path.display(), e))
        })?;

        let config: Config = toml::from_str(&content)?;
        Ok(config)
    }

    /// Load token from separate file
    fn load_token() -> Result<Option<String>> {
        let path = match Self::token_path() {
            Some(p) => p,
            None => return Ok(None),
        };

        if !path.exists() {
            return Ok(None);
        }

        let token = fs::read_to_string(&path)
            .map_err(|e| BlazeError::Config(format!("Failed to read token: {}", e)))?
            .trim()
            .to_string();

        if token.is_empty() {
            Ok(None)
        } else {
            Ok(Some(token))
        }
    }

    /// Save config to disk
    pub fn save(&self) -> Result<()> {
        let dir = Self::dir().ok_or_else(|| BlazeError::Config("No config directory".into()))?;
        fs::create_dir_all(&dir)?;

        // Save config.toml
        let path = Self::path().unwrap();
        let content = toml::to_string_pretty(self)
            .map_err(|e| BlazeError::Config(format!("Failed to serialize config: {}", e)))?;
        fs::write(&path, content)?;

        Ok(())
    }

    /// Save token to separate file
    pub fn save_token(token: &str) -> Result<()> {
        let dir = Self::dir().ok_or_else(|| BlazeError::Config("No config directory".into()))?;
        fs::create_dir_all(&dir)?;

        let path = Self::token_path().unwrap();
        fs::write(&path, token)?;

        Ok(())
    }
}
