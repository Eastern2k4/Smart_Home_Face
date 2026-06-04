from dataclasses import dataclass, field
from typing import Optional
import time


@dataclass
class Capture:
    """Represents one camera snapshot."""

    image_path: str
    timestamp: float = field(default_factory=time.time)
    has_face: bool = False
    is_spoof: bool = False  # placeholder for anti-spoofing


@dataclass
class RecognitionResult:
    """Result of comparing a capture against known faces."""

    classification: str  # "idle", "no_face", "spoof", "host", "stranger", "error"
    identity: Optional[str]  # "Hosts" or None
    confidence: Optional[float]
    distance: Optional[float]
    threshold: Optional[float]
    liveness_score: Optional[float] = None
    reason: Optional[str] = None


@dataclass
class AntiSpoofResult:
    """Result of the anti-spoofing / liveness check."""

    is_real: bool
    score: Optional[float] = None
    reason: Optional[str] = None


class StrangerTracker:
    """Tracks continuous stranger presence without globals."""

    def __init__(self, alert_seconds: float):
        self.alert_seconds = alert_seconds
        self.first_seen_at: Optional[float] = None
        self.last_alert_at: Optional[float] = None

    def update(self, now: float) -> bool:
        """Call when a stranger is detected. Returns True if an alert should be triggered."""
        if self.first_seen_at is None:
            self.first_seen_at = now
            return False

        duration = now - self.first_seen_at
        if duration >= self.alert_seconds:
            if (
                self.last_alert_at is None
                or (now - self.last_alert_at) >= self.alert_seconds
            ):
                self.last_alert_at = now
                return True
        return False

    def reset(self):
        self.first_seen_at = None

    def get_duration(self, now: float) -> float:
        """Return seconds the stranger has been continuously present."""
        if self.first_seen_at is None:
            return 0.0
        return now - self.first_seen_at
