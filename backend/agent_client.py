"""Agent client for natural language processing via OpenClaw CLI."""

import asyncio
import json
import logging
import re
import subprocess
from typing import Optional

logger = logging.getLogger(__name__)

# Default session ID for Blaze agent requests
AGENT_SESSION_ID = "blaze-agent"


def call_agent_sync(prompt: str, timeout: int = 120) -> str:
    """
    Call OpenClaw agent synchronously and return response text.
    
    Args:
        prompt: Natural language prompt for the agent
        timeout: Maximum seconds to wait for response
        
    Returns:
        Agent's text response
        
    Raises:
        RuntimeError: If agent call fails
    """
    try:
        result = subprocess.run(
            [
                "openclaw", "agent",
                "--session-id", AGENT_SESSION_ID,
                "--message", prompt,
                "--json",
                "--timeout", str(timeout)
            ],
            capture_output=True,
            text=True,
            timeout=timeout + 30  # Buffer for subprocess overhead
        )
        
        if result.returncode != 0:
            logger.error(f"Agent failed with code {result.returncode}: {result.stderr}")
            raise RuntimeError(f"Agent failed: {result.stderr or 'Unknown error'}")
        
        data = json.loads(result.stdout)
        
        if data.get("status") != "ok":
            logger.error(f"Agent returned error status: {data}")
            raise RuntimeError(f"Agent error: {data.get('summary', 'Unknown error')}")
        
        payloads = data.get("result", {}).get("payloads", [])
        if not payloads:
            raise RuntimeError("Agent returned no response")
        
        return payloads[0].get("text", "")
        
    except subprocess.TimeoutExpired:
        logger.error(f"Agent timed out after {timeout}s")
        raise RuntimeError("Request timed out. Try a simpler prompt.")
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse agent response: {e}")
        raise RuntimeError("Failed to parse agent response")


async def call_agent(prompt: str, timeout: int = 120) -> str:
    """
    Call OpenClaw agent asynchronously and return response text.
    
    Runs the synchronous call in a thread pool to avoid blocking.
    """
    return await asyncio.to_thread(call_agent_sync, prompt, timeout)


async def create_cards_from_prompt(prompt: str, column: str = "todo") -> list[str]:
    """
    Create cards from natural language description.
    
    Args:
        prompt: Natural language description of cards to create
        column: Target column for new cards (default: todo)
        
    Returns:
        List of created card IDs
    """
    full_prompt = f"""Create Blaze cards for the following request:

{prompt}

Instructions:
1. Put all cards in the "{column}" column
2. Give each card a clear, actionable title
3. Set appropriate priority (low/medium/high/urgent based on context)
4. Add relevant tags based on the content
5. After creating all cards, return ONLY a JSON array of the card IDs
6. Format: ["id1", "id2", "id3"]
7. Nothing else in your response - just the JSON array"""

    response = await call_agent(full_prompt, timeout=90)
    
    # Try to parse as JSON first
    try:
        card_ids = json.loads(response.strip())
        if isinstance(card_ids, list):
            return card_ids
    except json.JSONDecodeError:
        pass
    
    # Fallback: extract IDs from text (12-char hex)
    card_ids = re.findall(r'[a-f0-9]{12}', response)
    if card_ids:
        logger.warning(f"Extracted IDs from non-JSON response: {card_ids}")
        return card_ids
    
    raise RuntimeError(f"Could not parse card IDs from response: {response[:200]}")


async def create_plan_from_idea(idea: str) -> str:
    """
    Create a plan from a natural language idea.
    
    Args:
        idea: Natural language description of the plan
        
    Returns:
        Created plan ID
    """
    full_prompt = f"""Create a Blaze plan for this idea:

{idea}

Instructions:
1. Create a plan with an appropriate, concise title
2. Add an overview.md file with a well-structured plan document including:
   - Goal/objective
   - Key features or requirements
   - Technical considerations (if applicable)
   - Implementation phases or steps
   - Success criteria
3. The plan should be actionable and detailed enough to generate tasks from later
4. Return ONLY the plan ID, nothing else
5. Just the 12-character ID on a single line"""

    response = await call_agent(full_prompt, timeout=180)
    
    # Extract plan ID (12-char hex)
    plan_id_match = re.search(r'[a-f0-9]{12}', response.strip())
    if plan_id_match:
        return plan_id_match.group()
    
    raise RuntimeError(f"Could not parse plan ID from response: {response[:200]}")


async def generate_cards_from_plan(plan_id: str, context: Optional[str] = None) -> list[str]:
    """
    Read a plan and generate actionable cards from it.
    
    Args:
        plan_id: ID of the plan to read
        context: Optional focus context (e.g., "focus on backend first")
        
    Returns:
        List of created card IDs
    """
    ctx = f"\n\nAdditional context: {context}" if context else ""
    
    full_prompt = f"""Read plan {plan_id} and create actionable Blaze cards from it.{ctx}

Instructions:
1. Use 'blaze plan show {plan_id}' to read the plan content
2. Break the plan into concrete, actionable tasks
3. Each task should be:
   - Specific and completable in a reasonable time
   - Have a clear deliverable
   - Not too granular (group related sub-tasks)
4. Create cards in the "todo" column
5. Set appropriate priorities based on dependencies and importance
6. Tag each card with the plan reference (first 8 chars of plan ID)
7. After creating all cards, return ONLY a JSON array of the card IDs
8. Format: ["id1", "id2", "id3"]
9. Nothing else in your response - just the JSON array"""

    response = await call_agent(full_prompt, timeout=180)
    
    # Try to parse as JSON first
    try:
        card_ids = json.loads(response.strip())
        if isinstance(card_ids, list):
            return card_ids
    except json.JSONDecodeError:
        pass
    
    # Fallback: extract IDs from text
    card_ids = re.findall(r'[a-f0-9]{12}', response)
    if card_ids:
        logger.warning(f"Extracted IDs from non-JSON response: {card_ids}")
        return card_ids
    
    raise RuntimeError(f"Could not parse card IDs from response: {response[:200]}")
