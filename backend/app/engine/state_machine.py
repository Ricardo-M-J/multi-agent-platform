"""Task state machine for managing task lifecycle transitions."""

import logging
from enum import Enum
from typing import Callable

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Valid task statuses and their allowed transitions."""

    PENDING = "pending"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"
    FAILED = "failed"

    @classmethod
    def transitions(cls) -> dict[str, list[str]]:
        """Define valid state transitions.

        Returns a mapping of current_status -> list of valid next statuses.
        """
        return {
            cls.PENDING: [cls.CLAIMED],
            cls.CLAIMED: [cls.IN_PROGRESS, cls.PENDING],
            cls.IN_PROGRESS: [cls.REVIEW, cls.COMPLETED, cls.FAILED],
            cls.REVIEW: [cls.COMPLETED, cls.CLAIMED, cls.FAILED],
            cls.COMPLETED: [],  # Terminal state
            cls.FAILED: [cls.CLAIMED],  # Can retry
        }


class TaskStateMachine:
    """Manages task status transitions with validation and event emission."""

    def __init__(self, on_transition: Callable | None = None) -> None:
        """
        Args:
            on_transition: Optional callback called on successful transition.
                Signature: (task_id, old_status, new_status, metadata)
        """
        self._on_transition = on_transition

    def can_transition(self, current_status: str, new_status: str) -> bool:
        """Check if a transition from current_status to new_status is valid."""
        transitions = TaskStatus.transitions()
        valid_next = transitions.get(current_status, [])
        return new_status in valid_next

    def transition(
        self,
        current_status: str,
        new_status: str,
        task_id: str = "",
        metadata: dict | None = None,
    ) -> bool:
        """Attempt a status transition.

        Args:
            current_status: The current task status.
            new_status: The desired new status.
            task_id: Optional task ID for logging/callbacks.
            metadata: Optional metadata about the transition.

        Returns:
            True if the transition was successful, False otherwise.

        Raises:
            ValueError: If the transition is invalid.
        """
        if not self.can_transition(current_status, new_status):
            valid = TaskStatus.transitions().get(current_status, [])
            error_msg = (
                f"Invalid transition for task {task_id}: "
                f"{current_status} -> {new_status}. "
                f"Valid transitions: {valid}"
            )
            logger.warning(error_msg)
            raise ValueError(error_msg)

        logger.info(f"Task {task_id}: {current_status} -> {new_status}")

        if self._on_transition:
            self._on_transition(task_id, current_status, new_status, metadata or {})

        return True

    def get_valid_transitions(self, current_status: str) -> list[str]:
        """Get all valid next statuses for the current status."""
        return TaskStatus.transitions().get(current_status, [])
