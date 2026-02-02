"""Simple token-based authentication for the Kanban board."""

import os
import secrets
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

# Security scheme
security = HTTPBearer(auto_error=False)

# Token storage - in production, use environment variable or secrets file
_api_token: Optional[str] = None


def get_api_token() -> str:
    """Get or generate the API token."""
    global _api_token
    
    # First, check environment variable
    env_token = os.environ.get("KANBAN_API_TOKEN")
    if env_token:
        _api_token = env_token
        return _api_token
    
    # Check token file
    token_file = os.environ.get("KANBAN_TOKEN_FILE", "data/.token")
    if os.path.exists(token_file):
        with open(token_file, "r") as f:
            _api_token = f.read().strip()
            return _api_token
    
    # Generate new token and save
    _api_token = secrets.token_urlsafe(32)
    os.makedirs(os.path.dirname(token_file) or ".", exist_ok=True)
    with open(token_file, "w") as f:
        f.write(_api_token)
    
    print(f"Generated new API token: {_api_token}")
    print(f"Token saved to: {token_file}")
    
    return _api_token


def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> str:
    """Verify the bearer token and return it if valid."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    expected_token = get_api_token()
    
    if not secrets.compare_digest(credentials.credentials, expected_token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return credentials.credentials


# Optional auth - allows unauthenticated access but provides token if present
def optional_auth(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> Optional[str]:
    """Optionally verify token - returns None if no token provided."""
    if credentials is None:
        return None
    
    try:
        return verify_token(credentials)
    except HTTPException:
        return None
