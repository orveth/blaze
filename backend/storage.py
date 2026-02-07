"""Thread-safe JSON file storage for the Kanban board."""

import fcntl
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

from .models import Card, Column, Priority, Plan, PlanStatus, PlanFile, AgentStatus, AgentProgressEntry
from .utils import generate_id, now_utc


class Storage:
    """Thread-safe JSON file storage with file locking."""

    def __init__(self, data_path: str | Path | None = None):
        if data_path is None:
            data_dir = os.environ.get("BLAZE_DATA_DIR", "data")
            data_path = Path(data_dir) / "board.json"
        self.data_path = Path(data_path)
        self.data_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        """Create the data file with default structure if it doesn't exist."""
        if not self.data_path.exists():
            default_data = {
                "cards": {},
                "column_order": {col.value: [] for col in Column},
                "plans": {},
            }
            self._write_data(default_data)

    def _read_data(self) -> dict:
        """Read data from file with shared lock."""
        with open(self.data_path, "r") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_SH)
            try:
                return json.load(f)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    def _write_data(self, data: dict) -> None:
        """Write data to file with exclusive lock."""
        with open(self.data_path, "w") as f:
            fcntl.flock(f.fileno(), fcntl.LOCK_EX)
            try:
                json.dump(data, f, indent=2, default=str)
            finally:
                fcntl.flock(f.fileno(), fcntl.LOCK_UN)

    def _card_to_dict(self, card: Card) -> dict:
        """Convert Card model to dict for storage."""
        return {
            "id": card.id,
            "title": card.title,
            "description": card.description,
            "priority": card.priority.value,
            "column": card.column.value,
            "due_date": card.due_date.isoformat() if card.due_date else None,
            "tags": card.tags,
            "created_at": card.created_at.isoformat(),
            "updated_at": card.updated_at.isoformat(),
            "position": card.position,
            "archived": card.archived,
            # Agent workflow fields
            "agent_assignable": card.agent_assignable,
            "agent_status": card.agent_status.value if card.agent_status else None,
            "agent_progress": [
                {"timestamp": e.timestamp.isoformat(), "message": e.message}
                for e in card.agent_progress
            ],
            "acceptance_criteria": card.acceptance_criteria,
            "acceptance_checked": card.acceptance_checked,
            "blocked_reason": card.blocked_reason,
        }

    def _dict_to_card(self, data: dict) -> Card:
        """Convert stored dict to Card model."""
        # Parse agent progress entries
        agent_progress = []
        for entry in data.get("agent_progress", []):
            agent_progress.append(AgentProgressEntry(
                timestamp=datetime.fromisoformat(entry["timestamp"]),
                message=entry["message"],
            ))
        
        # Parse agent status
        agent_status = None
        if data.get("agent_status"):
            agent_status = AgentStatus(data["agent_status"])
        
        return Card(
            id=data["id"],
            title=data["title"],
            description=data.get("description"),
            priority=Priority(data["priority"]),
            column=Column(data["column"]),
            due_date=datetime.fromisoformat(data["due_date"]) if data.get("due_date") else None,
            tags=data.get("tags", []),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            position=data.get("position", 0),
            archived=data.get("archived", False),
            # Agent workflow fields
            agent_assignable=data.get("agent_assignable", False),
            agent_status=agent_status,
            agent_progress=agent_progress,
            acceptance_criteria=data.get("acceptance_criteria", []),
            acceptance_checked=data.get("acceptance_checked", []),
            blocked_reason=data.get("blocked_reason"),
        )

    def _plan_to_dict(self, plan: Plan) -> dict:
        """Convert Plan model to dict for storage."""
        return {
            "id": plan.id,
            "title": plan.title,
            "description": plan.description,
            "status": plan.status.value,
            "files": [{"name": f.name, "content": f.content} for f in plan.files],
            "archived": plan.archived,
            "created_at": plan.created_at.isoformat(),
            "updated_at": plan.updated_at.isoformat(),
            "position": plan.position,
        }

    def _dict_to_plan(self, data: dict) -> Plan:
        """Convert stored dict to Plan model."""
        # Handle migration from old description-based format
        files_data = data.get("files", [])
        if not files_data and data.get("description"):
            # Migrate old single description to files format
            files_data = [{"name": "plan.md", "content": data["description"]}]

        files = [PlanFile(name=f["name"], content=f["content"]) for f in files_data]

        return Plan(
            id=data["id"],
            title=data["title"],
            description=data.get("description"),
            status=PlanStatus(data.get("status", "draft")),
            files=files,
            archived=data.get("archived", False),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            position=data.get("position", 0),
        )

    def list_cards(self, column: Optional[Column] = None, include_archived: bool = False) -> list[Card]:
        """List all cards, optionally filtered by column.
        
        Args:
            column: Filter by column (optional)
            include_archived: Include archived cards (default: False)
        """
        data = self._read_data()
        cards = [self._dict_to_card(c) for c in data["cards"].values()]
        
        # Filter out archived cards unless explicitly requested
        if not include_archived:
            cards = [c for c in cards if not c.archived]
        
        if column:
            cards = [c for c in cards if c.column == column]
        
        # Sort by column order then position
        column_order = data.get("column_order", {})
        def sort_key(card: Card) -> tuple:
            col_cards = column_order.get(card.column.value, [])
            try:
                pos = col_cards.index(card.id)
            except ValueError:
                pos = 999
            return (list(Column).index(card.column), pos)
        
        return sorted(cards, key=sort_key)

    def get_card(self, card_id: str) -> Optional[Card]:
        """Get a single card by ID."""
        data = self._read_data()
        card_data = data["cards"].get(card_id)
        return self._dict_to_card(card_data) if card_data else None

    def create_card(self, title: str, description: Optional[str] = None,
                    priority: Priority = Priority.MEDIUM,
                    column: Column = Column.BACKLOG,
                    due_date: Optional[datetime] = None,
                    tags: Optional[list[str]] = None,
                    agent_assignable: bool = False,
                    acceptance_criteria: Optional[list[str]] = None) -> Card:
        """Create a new card."""
        now = now_utc()
        criteria = acceptance_criteria or []
        card = Card(
            id=generate_id(),
            title=title,
            description=description,
            priority=priority,
            column=column,
            due_date=due_date,
            tags=tags or [],
            created_at=now,
            updated_at=now,
            position=0,
            agent_assignable=agent_assignable,
            agent_status=AgentStatus.READY if agent_assignable else None,
            acceptance_criteria=criteria,
            acceptance_checked=[False] * len(criteria),  # Initialize all as unchecked
        )

        data = self._read_data()
        data["cards"][card.id] = self._card_to_dict(card)
        
        # Add to column order
        if card.column.value not in data["column_order"]:
            data["column_order"][card.column.value] = []
        data["column_order"][card.column.value].append(card.id)
        
        self._write_data(data)
        return card

    def update_card(self, card_id: str, **updates) -> Optional[Card]:
        """Update a card's fields."""
        data = self._read_data()
        
        if card_id not in data["cards"]:
            return None
        
        card_data = data["cards"][card_id]
        old_column = card_data["column"]
        
        for key, value in updates.items():
            if value is not None:
                if key == "priority" and isinstance(value, Priority):
                    card_data[key] = value.value
                elif key == "column" and isinstance(value, Column):
                    card_data[key] = value.value
                elif key == "due_date" and isinstance(value, datetime):
                    card_data[key] = value.isoformat()
                else:
                    card_data[key] = value
        
        card_data["updated_at"] = now_utc().isoformat()
        
        # Handle column change
        new_column = card_data["column"]
        if old_column != new_column:
            if card_id in data["column_order"].get(old_column, []):
                data["column_order"][old_column].remove(card_id)
            if new_column not in data["column_order"]:
                data["column_order"][new_column] = []
            data["column_order"][new_column].append(card_id)
        
        self._write_data(data)
        return self._dict_to_card(card_data)

    def move_card(self, card_id: str, column: Column) -> Optional[Card]:
        """Move a card to a different column."""
        return self.update_card(card_id, column=column)

    def archive_card(self, card_id: str) -> Optional[Card]:
        """Archive a card."""
        return self.update_card(card_id, archived=True)

    def unarchive_card(self, card_id: str) -> Optional[Card]:
        """Unarchive a card."""
        return self.update_card(card_id, archived=False)

    def archive_column(self, column: Column) -> int:
        """Archive all cards in a column. Returns count of archived cards."""
        data = self._read_data()
        count = 0
        
        for card_id, card_data in data["cards"].items():
            if card_data["column"] == column.value and not card_data.get("archived", False):
                card_data["archived"] = True
                card_data["updated_at"] = now_utc().isoformat()
                count += 1
        
        self._write_data(data)
        return count

    def delete_card(self, card_id: str) -> bool:
        """Delete a card."""
        data = self._read_data()
        
        if card_id not in data["cards"]:
            return False
        
        card_column = data["cards"][card_id]["column"]
        del data["cards"][card_id]
        
        # Remove from column order
        if card_id in data["column_order"].get(card_column, []):
            data["column_order"][card_column].remove(card_id)
        
        self._write_data(data)
        return True

    # Plan methods

    def create_plan(self, title: str, description: str | None = None, files: list[dict] | None = None) -> Plan:
        """Create a new plan.

        Args:
            title: Plan title
            description: Optional plan description
            files: Optional list of {"name": str, "content": str} dicts
        """
        data = self._read_data()

        # Ensure plans key exists
        if "plans" not in data:
            data["plans"] = {}

        plan_id = generate_id()
        now = now_utc()

        plan_files = []
        if files:
            plan_files = [PlanFile(name=f["name"], content=f.get("content", "")) for f in files]

        plan = Plan(
            id=plan_id,
            title=title,
            description=description,
            status=PlanStatus.DRAFT,
            files=plan_files,
            created_at=now,
            updated_at=now,
            position=len(data["plans"]),
        )

        data["plans"][plan_id] = self._plan_to_dict(plan)
        self._write_data(data)
        return plan

    def get_plan(self, plan_id: str) -> Optional[Plan]:
        """Get a plan by ID."""
        data = self._read_data()
        
        if "plans" not in data:
            return None
        
        plan_data = data["plans"].get(plan_id)
        return self._dict_to_plan(plan_data) if plan_data else None

    def list_plans(
        self,
        status: Optional[PlanStatus] = None,
        include_archived: bool = False
    ) -> list[Plan]:
        """List all plans, optionally filtered by status."""
        data = self._read_data()
        
        if "plans" not in data:
            return []
        
        plans = [self._dict_to_plan(p) for p in data["plans"].values()]
        
        # Filter by archived status
        if not include_archived:
            plans = [p for p in plans if not p.archived]
        
        if status:
            plans = [p for p in plans if p.status == status]
        
        # Sort by position
        return sorted(plans, key=lambda p: p.position)

    def update_plan(
        self,
        plan_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        status: Optional[PlanStatus] = None,
    ) -> Optional[Plan]:
        """Update a plan's title, description, or status."""
        data = self._read_data()

        if "plans" not in data or plan_id not in data["plans"]:
            return None

        plan_data = data["plans"][plan_id]

        if title is not None:
            plan_data["title"] = title
        if description is not None:
            plan_data["description"] = description
        if status is not None:
            plan_data["status"] = status.value

        plan_data["updated_at"] = now_utc().isoformat()

        self._write_data(data)
        return self._dict_to_plan(plan_data)

    def add_plan_file(self, plan_id: str, name: str, content: str = "") -> Optional[Plan]:
        """Add a file to a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return None
        
        plan_data = data["plans"][plan_id]
        
        # Ensure files array exists
        if "files" not in plan_data:
            plan_data["files"] = []
        
        # Check for duplicate filename
        for f in plan_data["files"]:
            if f["name"] == name:
                return None  # File already exists
        
        plan_data["files"].append({"name": name, "content": content})
        plan_data["updated_at"] = now_utc().isoformat()
        
        self._write_data(data)
        return self._dict_to_plan(plan_data)

    def update_plan_file(
        self, plan_id: str, filename: str, name: Optional[str] = None, content: Optional[str] = None
    ) -> Optional[Plan]:
        """Update a file within a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return None
        
        plan_data = data["plans"][plan_id]
        files = plan_data.get("files", [])
        
        # Find the file
        file_found = False
        for f in files:
            if f["name"] == filename:
                if name is not None:
                    f["name"] = name
                if content is not None:
                    f["content"] = content
                file_found = True
                break
        
        if not file_found:
            return None
        
        plan_data["updated_at"] = now_utc().isoformat()
        
        self._write_data(data)
        return self._dict_to_plan(plan_data)

    def delete_plan_file(self, plan_id: str, filename: str) -> Optional[Plan]:
        """Delete a file from a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return None
        
        plan_data = data["plans"][plan_id]
        files = plan_data.get("files", [])
        
        # Find and remove the file
        original_len = len(files)
        plan_data["files"] = [f for f in files if f["name"] != filename]
        
        if len(plan_data["files"]) == original_len:
            return None  # File not found
        
        plan_data["updated_at"] = now_utc().isoformat()
        
        self._write_data(data)
        return self._dict_to_plan(plan_data)

    def get_plan_file(self, plan_id: str, filename: str) -> Optional[PlanFile]:
        """Get a specific file from a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return None
        
        plan_data = data["plans"][plan_id]
        files = plan_data.get("files", [])
        
        for f in files:
            if f["name"] == filename:
                return PlanFile(name=f["name"], content=f["content"])
        
        return None

    def delete_plan(self, plan_id: str) -> bool:
        """Delete a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return False
        
        del data["plans"][plan_id]
        self._write_data(data)
        return True
    
    def archive_plan(self, plan_id: str) -> Optional[Plan]:
        """Archive a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return None
        
        plan_data = data["plans"][plan_id]
        plan_data["archived"] = True
        plan_data["updated_at"] = now_utc().isoformat()
        
        self._write_data(data)
        return self._dict_to_plan(plan_data)
    
    def unarchive_plan(self, plan_id: str) -> Optional[Plan]:
        """Unarchive a plan."""
        data = self._read_data()
        
        if "plans" not in data or plan_id not in data["plans"]:
            return None
        
        plan_data = data["plans"][plan_id]
        plan_data["archived"] = False
        plan_data["updated_at"] = now_utc().isoformat()
        
        self._write_data(data)
        return self._dict_to_plan(plan_data)

    def get_board(self) -> dict:
        """Get full board state organized by columns."""
        cards = self.list_cards()
        columns = {col.value: [] for col in Column}
        
        for card in cards:
            columns[card.column.value].append(card)
        
        return columns

    def get_stats(self) -> dict:
        """Get board statistics."""
        from .utils import is_overdue
        
        data = self._read_data()
        all_cards = [self._dict_to_card(c) for c in data["cards"].values()]
        
        # Separate archived and active cards
        archived_count = sum(1 for c in all_cards if c.archived)
        active_cards = [c for c in all_cards if not c.archived]
        
        by_column = {col.value: 0 for col in Column}
        by_priority = {p.value: 0 for p in Priority}
        overdue_count = 0
        
        for card in active_cards:
            by_column[card.column.value] += 1
            by_priority[card.priority.value] += 1
            if is_overdue(card.due_date) and card.column != Column.DONE:
                overdue_count += 1
        
        return {
            "total_cards": len(active_cards),
            "by_column": by_column,
            "by_priority": by_priority,
            "overdue_count": overdue_count,
            "archived_count": archived_count,
        }


# Default storage instance
_storage: Optional[Storage] = None


def get_storage(data_path: str | Path | None = None) -> Storage:
    """Get or create the storage instance.
    
    If data_path is None, uses KANBAN_DATA_DIR env var or defaults to 'data/'.
    """
    global _storage
    if _storage is None:
        _storage = Storage(data_path)
    return _storage
