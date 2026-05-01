import time
from typing import Dict, List
from dataclasses import dataclass, field
from threading import Lock


@dataclass
class ViewerInfo:
    username: str
    ip_address: str
    channel_id: int
    connected_at: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)


class ViewerTracker:
    def __init__(self):
        self._viewers: Dict[str, ViewerInfo] = {}  # key: '{username}_{channel_id}_{ip}'
        self._lock = Lock()

    def track(self, username: str, channel_id: int, ip_address: str):
        key = f'{username}_{channel_id}_{ip_address}'
        with self._lock:
            if key in self._viewers:
                self._viewers[key].last_seen = time.time()
            else:
                self._viewers[key] = ViewerInfo(
                    username=username,
                    ip_address=ip_address,
                    channel_id=channel_id,
                )

    def remove_stale(self, timeout: int = 30):
        """30 saniye (TV) veya 120 saniye (Radio) boyunca segment istemeyen izleyicileri kaldir.
        Radio kanallar icin HLS segmentleri nginxten direkt serve edildiginden timeout uzun tutulur.
        """
        now = time.time()
        with self._lock:
            stale = []
            for k, v in self._viewers.items():
                # Radio kanallar icin timeout 120 saniye (channel_id >= 100000 veya kontrol edilebilir)
                # Su an icin tum kanallar icin 120 saniye yapalim (TV de sorun olmaz)
                actual_timeout = 120  # HLS segmentler nginxten geldigi icin uzun tutuyoruz
                if now - v.last_seen > actual_timeout:
                    stale.append(k)
            for k in stale:
                del self._viewers[k]

    def get_channel_viewers(self, channel_id: int) -> List[ViewerInfo]:
        self.remove_stale()
        with self._lock:
            return [v for v in self._viewers.values() if v.channel_id == channel_id]

    def get_channel_count(self, channel_id: int) -> int:
        return len(self.get_channel_viewers(channel_id))

    def get_all_counts(self) -> Dict[int, int]:
        self.remove_stale()
        counts: Dict[int, int] = {}
        with self._lock:
            for v in self._viewers.values():
                counts[v.channel_id] = counts.get(v.channel_id, 0) + 1
        return counts


viewer_tracker = ViewerTracker()
