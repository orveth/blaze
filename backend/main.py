"""FastAPI application for the Blaze task board."""

import logging
import secrets
import hashlib
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

from .auth import verify_token, get_api_token
from .models import (
    BoardStats,
    Card,
    CardCreate,
    CardMove,
    CardUpdate,
    Column,
    Plan,
    PlanCreate,
    PlanUpdate,
    PlanStatus,
    PlanFile,
    PlanFileCreate,
    PlanFileUpdate,
)
from .storage import get_storage

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


# --- WebSocket Connection Manager ---


class ConnectionManager:
    """Manages active WebSocket connections and broadcasting."""

    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.add(websocket)
        logger.info(f"WebSocket connected. Active: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """Unregister a WebSocket connection."""
        self.active_connections.discard(websocket)
        logger.info(f"WebSocket disconnected. Active: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Broadcast a JSON message to all connected clients."""
        if not self.active_connections:
            return

        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send to WebSocket: {e}")
                dead.add(ws)

        # Clean up dead connections
        self.active_connections -= dead


manager = ConnectionManager()


# Lifespan (replaces deprecated on_event)
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    token = get_api_token()
    logger.info("=" * 50)
    logger.info("Blaze API started")
    logger.info(f"API Token: {token}")
    logger.info("=" * 50)
    yield
    logger.info("Blaze API shutting down")


app = FastAPI(
    title="Blaze API",
    description="A simple kanban board with drag-and-drop support",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Auth Models ---


class LoginRequest(BaseModel):
    password: str


class LoginResponse(BaseModel):
    token: str


# --- Health Check ---


@app.get("/health")
async def health_check():
    """Health check endpoint (no auth required)."""
    return {"status": "ok"}


# --- Authentication ---


@app.post("/api/auth", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate with password and receive API token."""
    expected_token = get_api_token()

    if not secrets.compare_digest(request.password, expected_token):
        logger.warning("Failed login attempt")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password",
        )

    logger.info("Successful login")
    return LoginResponse(token=expected_token)


# --- Card Endpoints ---


@app.get("/api/cards", response_model=list[Card])
async def list_cards(
    column: Column | None = None,
    include_archived: bool = False,
    _: str = Depends(verify_token),
):
    """List all cards, optionally filtered by column."""
    storage = get_storage()
    return storage.list_cards(column=column, include_archived=include_archived)


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
    card = storage.create_card(
        title=card_data.title,
        description=card_data.description,
        priority=card_data.priority,
        column=card_data.column,
        due_date=card_data.due_date,
        tags=card_data.tags,
    )
    logger.info(f"Created card: {card.id} - {card.title}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "card_created",
        "card": card.model_dump(mode='json')
    })
    
    return card


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
    logger.info(f"Updated card: {card_id}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "card_updated",
        "card": card.model_dump(mode='json')
    })
    
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
    logger.info(f"Moved card {card_id} to {move_data.column.value}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "card_moved",
        "card": card.model_dump(mode='json')
    })
    
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
    logger.info(f"Deleted card: {card_id}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "card_deleted",
        "card_id": card_id
    })
    
    return None


@app.patch("/api/cards/{card_id}/archive", response_model=Card)
async def archive_card(
    card_id: str,
    _: str = Depends(verify_token),
):
    """Archive a card."""
    storage = get_storage()
    card = storage.archive_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found",
        )
    logger.info(f"Archived card: {card_id}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "card_archived",
        "card": card.model_dump(mode='json')
    })
    
    return card


@app.patch("/api/cards/{card_id}/unarchive", response_model=Card)
async def unarchive_card(
    card_id: str,
    _: str = Depends(verify_token),
):
    """Unarchive a card."""
    storage = get_storage()
    card = storage.unarchive_card(card_id)
    if not card:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Card {card_id} not found",
        )
    logger.info(f"Unarchived card: {card_id}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "card_unarchived",
        "card": card.model_dump(mode='json')
    })
    
    return card


@app.post("/api/columns/{column}/archive")
async def archive_column(
    column: Column,
    _: str = Depends(verify_token),
):
    """Archive all cards in a column."""
    storage = get_storage()
    count = storage.archive_column(column)
    logger.info(f"Archived {count} cards from {column.value}")
    
    # Broadcast to connected clients
    await manager.broadcast({
        "type": "column_archived",
        "column": column.value,
        "count": count
    })
    
    return {"archived_count": count}


# --- Plan Endpoints ---


@app.post("/api/plans", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def create_plan(
    plan_data: PlanCreate,
    _: str = Depends(verify_token),
):
    """Create a new plan."""
    storage = get_storage()
    files = [{"name": f.name, "content": f.content} for f in plan_data.files] if plan_data.files else None
    plan = storage.create_plan(
        title=plan_data.title,
        files=files,
    )
    logger.info(f"Created plan: {plan.id} - {plan.title}")
    return plan


@app.get("/api/plans", response_model=list[Plan])
async def list_plans(
    status_filter: str | None = None,
    _: str = Depends(verify_token),
):
    """List all plans, optionally filtered by status."""
    storage = get_storage()
    
    plan_status = None
    if status_filter:
        try:
            plan_status = PlanStatus(status_filter)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status_filter}",
            )
    
    plans = storage.list_plans(status=plan_status)
    return plans


@app.get("/api/plans/{plan_id}", response_model=Plan)
async def get_plan(
    plan_id: str,
    _: str = Depends(verify_token),
):
    """Get a specific plan by ID."""
    storage = get_storage()
    plan = storage.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    return plan


@app.patch("/api/plans/{plan_id}", response_model=Plan)
async def update_plan(
    plan_id: str,
    plan_data: PlanUpdate,
    _: str = Depends(verify_token),
):
    """Update a plan's title or status."""
    storage = get_storage()
    
    plan = storage.update_plan(
        plan_id,
        title=plan_data.title,
        status=plan_data.status,
    )
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    logger.info(f"Updated plan: {plan_id}")
    return plan


@app.delete("/api/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(
    plan_id: str,
    _: str = Depends(verify_token),
):
    """Delete a plan."""
    storage = get_storage()
    if not storage.delete_plan(plan_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    logger.info(f"Deleted plan: {plan_id}")
    return None


# --- Plan File Endpoints ---


@app.post("/api/plans/{plan_id}/files", response_model=Plan, status_code=status.HTTP_201_CREATED)
async def add_plan_file(
    plan_id: str,
    file_data: PlanFileCreate,
    _: str = Depends(verify_token),
):
    """Add a file to a plan."""
    storage = get_storage()
    
    # Check plan exists first
    plan = storage.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    
    result = storage.add_plan_file(plan_id, name=file_data.name, content=file_data.content)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"File '{file_data.name}' already exists in plan",
        )
    logger.info(f"Added file '{file_data.name}' to plan {plan_id}")
    return result


@app.get("/api/plans/{plan_id}/files/{filename}", response_model=PlanFile)
async def get_plan_file(
    plan_id: str,
    filename: str,
    _: str = Depends(verify_token),
):
    """Get a specific file from a plan."""
    storage = get_storage()
    
    # Check plan exists first
    plan = storage.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    
    file = storage.get_plan_file(plan_id, filename)
    if not file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{filename}' not found in plan",
        )
    return file


@app.patch("/api/plans/{plan_id}/files/{filename}", response_model=Plan)
async def update_plan_file(
    plan_id: str,
    filename: str,
    file_data: PlanFileUpdate,
    _: str = Depends(verify_token),
):
    """Update a file within a plan."""
    storage = get_storage()
    
    # Check plan exists first
    plan = storage.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    
    result = storage.update_plan_file(
        plan_id,
        filename,
        name=file_data.name,
        content=file_data.content,
    )
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{filename}' not found in plan",
        )
    logger.info(f"Updated file '{filename}' in plan {plan_id}")
    return result


@app.delete("/api/plans/{plan_id}/files/{filename}", response_model=Plan)
async def delete_plan_file(
    plan_id: str,
    filename: str,
    _: str = Depends(verify_token),
):
    """Delete a file from a plan."""
    storage = get_storage()
    
    # Check plan exists first
    plan = storage.get_plan(plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Plan {plan_id} not found",
        )
    
    result = storage.delete_plan_file(plan_id, filename)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{filename}' not found in plan",
        )
    logger.info(f"Deleted file '{filename}' from plan {plan_id}")
    return result


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
        "columns": {
            col: [card.model_dump() for card in cards] for col, cards in columns.items()
        },
        "stats": stats,
    }


@app.get("/api/board/stats", response_model=BoardStats)
async def get_board_stats(
    _: str = Depends(verify_token),
):
    """Get board statistics."""
    storage = get_storage()
    return storage.get_stats()


# --- WebSocket ---


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time board updates."""
    await manager.connect(websocket)
    try:
        # Keep connection alive and handle ping/pong
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


# --- Static Files ---

frontend_path = Path(__file__).parent.parent / "frontend"


def get_file_hash(filepath: Path) -> str:
    """Get a short hash of file contents for cache busting."""
    if filepath.exists():
        content = filepath.read_bytes()
        return hashlib.md5(content).hexdigest()[:8]
    return "0"


def get_versioned_html() -> str:
    """Read index.html and inject version hashes into static file URLs."""
    index_path = frontend_path / "index.html"
    if not index_path.exists():
        return ""
    
    html = index_path.read_text()
    
    # Get hashes for each static file
    static_files = ["style.css", "filters.js", "sync.js", "app.js"]
    for filename in static_files:
        file_hash = get_file_hash(frontend_path / filename)
        # Replace href="/static/file.ext" with href="/static/file.ext?v=hash"
        html = html.replace(
            f'"/static/{filename}"',
            f'"/static/{filename}?v={file_hash}"'
        )
    
    return html


@app.get("/")
async def serve_index():
    """Serve the frontend index.html with cache-busted static URLs."""
    html = get_versioned_html()
    
    if html:
        return HTMLResponse(
            content=html,
            headers={"Cache-Control": "no-cache, must-revalidate"}
        )
    return {"message": "Frontend not found. API is running at /api/"}


@app.get("/plans")
async def serve_plans():
    """Serve the plans page."""
    plans_path = frontend_path / "plans.html"
    if plans_path.exists():
        return FileResponse(
            plans_path,
            media_type="text/html",
            headers={"Cache-Control": "no-cache, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="Plans page not found")


@app.get("/doc/{plan_id}/{filename:path}")
async def serve_document(plan_id: str, filename: str):
    """Serve the document viewer page."""
    doc_path = frontend_path / "document.html"
    if doc_path.exists():
        return FileResponse(
            doc_path,
            media_type="text/html",
            headers={"Cache-Control": "no-cache, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="Document viewer not found")


@app.get("/sw.js")
async def serve_service_worker():
    """Serve service worker from root for proper scope."""
    sw_path = frontend_path / "sw.js"
    if sw_path.exists():
        return FileResponse(
            sw_path,
            media_type="application/javascript",
            headers={"Cache-Control": "no-cache, must-revalidate"}
        )
    raise HTTPException(status_code=404, detail="Service worker not found")


@app.get("/manifest.json")
async def serve_manifest():
    """Serve PWA manifest from root."""
    manifest_path = frontend_path / "manifest.json"
    if manifest_path.exists():
        return FileResponse(
            manifest_path,
            media_type="application/manifest+json",
            headers={"Cache-Control": "public, max-age=86400"}
        )
    raise HTTPException(status_code=404, detail="Manifest not found")


@app.get("/icon-{size}.png")
async def serve_icon(size: str):
    """Serve PWA icons from root."""
    if size not in ["192", "512"]:
        raise HTTPException(status_code=404, detail="Invalid icon size")
    
    icon_path = frontend_path / f"icon-{size}.png"
    if icon_path.exists():
        return FileResponse(
            icon_path,
            media_type="image/png",
            headers={"Cache-Control": "public, max-age=31536000"}
        )
    raise HTTPException(status_code=404, detail="Icon not found")


# Custom static files handler with cache headers
class CachedStaticFiles(StaticFiles):
    """StaticFiles with aggressive caching (files are cache-busted via query params)."""
    
    async def get_response(self, path: str, scope):
        response = await super().get_response(path, scope)
        # Long cache since URLs are versioned with content hash
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


# Mount static files for CSS/JS
if frontend_path.exists():
    app.mount("/static", CachedStaticFiles(directory=frontend_path), name="static")
