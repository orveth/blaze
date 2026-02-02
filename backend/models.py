"""Pydantic models for the Kanban board."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class Priority(str, Enum):
    """Card priority levels."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"  # Highest priority


class Column(str, Enum):
    """Board columns (workflow stages)."""
    BACKLOG = "backlog"
    TODO = "todo"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    DONE = "done"


class CardBase(BaseModel):
    """Base card fields for creation/updates."""
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Priority = Priority.MEDIUM
    due_date: Optional[datetime] = None
    tags: list[str] = Field(default_factory=list)


class CardCreate(CardBase):
    """Fields for creating a new card."""
    column: Column = Column.BACKLOG


class CardUpdate(BaseModel):
    """Fields for updating an existing card (all optional)."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    priority: Optional[Priority] = None
    due_date: Optional[datetime] = None
    tags: Optional[list[str]] = None
    column: Optional[Column] = None


class CardMove(BaseModel):
    """Request to move a card to a different column."""
    column: Column


class Card(CardBase):
    """Full card model with all fields."""
    id: str
    column: Column
    created_at: datetime
    updated_at: datetime
    position: int = 0

    class Config:
        from_attributes = True


class BoardStats(BaseModel):
    """Board statistics summary."""
    total_cards: int
    by_column: dict[str, int]
    by_priority: dict[str, int]
    overdue_count: int


class Board(BaseModel):
    """Full board state."""
    columns: dict[str, list[Card]]
    stats: BoardStats
