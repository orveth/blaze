"""FastAPI application for the Kanban board."""

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from .auth import verify_token, get_api_token
from .models import (
    Board,
    BoardStats,
    Card,
    CardCreate,
    CardMove,
    CardUpdate,
    Column,
)
from .storage import get_storage

app = FastAPI(
    title="Kanban Board API",
    description="A simple kanban board with drag-and-drop support",
    version="0.1.0",
)

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health Check ---

@app.get("/health")
async def health_check():
    """Health check endpoint (no auth required)."""
    return {"status": "ok"}


# --- Card Endpoints ---

@app.get("/api/cards", response_model=list[Card])
async def list_cards(
    column: Column | None = None,
    _: str = Depends(verify_token),
):
    """List all cards, optionally filtered by column."""
    storage = get_storage()
    return storage.list_cards(column=column)


@app.get("/api/cards/{card_id}", response_model=Card)
async def get_card(
    card_id: str,
    _: str = Depends(verify_token),
):
    """Get a single card by ID."""
    storage = get_storage()
    card = storage.get_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found",
        )
    return card


@app.post("/api/cards", response_model=Card, status_code=status.HTTP_201_CREATED)
async def create_card(
    card_data: CardCreate,
    _: str = Depends(verify_token),
):
    """Create a new card."""
    storage = get_storage()
    return storage.create_card(
        title=card_data.title,
        description=card_data.description,
        priority=card_data.priority,
        column=card_data.column,
        due_date=card_data.due_date,
        tags=card_data.tags,
    )


@app.put("/api/cards/{card_id}", response_model=Card)
async def update_card(
    card_id: str,
    card_data: CardUpdate,
    _: str = Depends(verify_token),
):
    """Update a card's fields."""
    storage = get_storage()
    
    # Build updates dict from non-None fields
    updates = {}
    if card_data.title is not None:
        updates["title"] = card_data.title
    if card_data.description is not None:
        updates["description"] = card_data.description
    if card_data.priority is not None:
        updates["priority"] = card_data.priority
    if card_data.due_date is not None:
        updates["due_date"] = card_data.due_date
    if card_data.tags is not None:
        updates["tags"] = card_data.tags
    if card_data.column is not None:
        updates["column"] = card_data.column
    
    card = storage.update_card(card_id, **updates)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found",
        )
    return card


@app.patch("/api/cards/{card_id}/move", response_model=Card)
async def move_card(
    card_id: str,
    move_data: CardMove,
    _: str = Depends(verify_token),
):
    """Move a card to a different column."""
    storage = get_storage()
    card = storage.move_card(card_id, move_data.column)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found",
        )
    return card


@app.delete("/api/cards/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: str,
    _: str = Depends(verify_token),
):
    """Delete a card."""
    storage = get_storage()
    if not storage.delete_card(card_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found",
        )
    return None


# --- Board Endpoints ---

@app.get("/api/board")
async def get_board(
    _: str = Depends(verify_token),
):
    """Get full board state organized by columns."""
    storage = get_storage()
    columns = storage.get_board()
    stats = storage.get_stats()
    
    return {
        "columns": {col: [card.model_dump() for card in cards] for col, cards in columns.items()},
        "stats": stats,
    }


@app.get("/api/board/stats", response_model=BoardStats)
async def get_board_stats(
    _: str = Depends(verify_token),
):
    """Get board statistics."""
    storage = get_storage()
    return storage.get_stats()


# --- Static Files (Frontend) ---

frontend_path = Path(__file__).parent.parent / "frontend"

if frontend_path.exists():
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")
    
    @app.get("/")
    async def serve_frontend():
        """Serve the frontend index.html."""
        index_path = frontend_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        return {"message": "Frontend not found. API is running at /api/"}


# --- Startup ---

@app.on_event("startup")
async def startup_event():
    """Initialize storage and display token on startup."""
    token = get_api_token()
    print(f"\n{'='*50}")
    print("Kanban Board API started!")
    print(f"API Token: {token}")
    print(f"{'='*50}\n")
