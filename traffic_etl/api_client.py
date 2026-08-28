"""
api_client.py — Modern async HTTP client for TomTom API with smart retry and key rotation.

Features:
- Async/await with httpx for parallel requests
- Smart retry with exponential backoff (tenacity)
- Quota-aware API key rotation
- Request/error tracking per key
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

try:
    import httpx
    from tenacity import (
        retry,
        stop_after_attempt,
        wait_exponential,
        retry_if_exception_type,
    )
    ASYNC_AVAILABLE = True
except ImportError:
    ASYNC_AVAILABLE = False
    httpx = None

logger = logging.getLogger(__name__)

TOMTOM_FLOW_URL = (
    "https://api.tomtom.com/traffic/services/4/flowSegmentData/"
    "absolute/22/json"
)

TOMTOM_KEY_REJECTION_CODES = {401, 403, 429}


class TomTomAPIClient:
    """
    Async HTTP client for TomTom Traffic Flow API with smart features:
    - Automatic retry with exponential backoff
    - Quota-aware key rotation (skips exhausted keys)
    - Per-key usage & error tracking
    """

    def __init__(self, api_keys: list[str], timeout: float = 30.0):
        """
        Initialize client with multiple API keys.

        Args:
            api_keys: List of TomTom API keys for rotation
            timeout: Request timeout in seconds
        """
        if not ASYNC_AVAILABLE:
            raise ImportError(
                "httpx and tenacity are required for TomTomAPIClient. "
                "Install with: pip install httpx tenacity"
            )

        self.api_keys = list(dict.fromkeys(api_keys))  # Remove duplicates
        self.current_key_index = 0
        self.key_usage = {
            key: {"calls": 0, "errors": 0, "quota_exceeded": False, "last_error": None}
            for key in self.api_keys
        }
        self.client = httpx.AsyncClient(timeout=timeout)
        logger.info(f"TomTomAPIClient initialized with {len(self.api_keys)} keys")

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    def _get_next_key(self) -> str | None:
        """
        Get next available API key using round-robin with skip for exhausted keys.

        Returns:
            API key string or None if all keys are exhausted
        """
        for _ in range(len(self.api_keys)):
            key = self.api_keys[self.current_key_index]
            self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)

            usage = self.key_usage[key]
            # Skip if quota exceeded or too many errors
            if not usage["quota_exceeded"] and usage["errors"] < 10:
                return key

        # All keys exhausted
        return None

    def _mark_key_exhausted(self, api_key: str, error_code: int):
        """Mark an API key as exhausted (quota exceeded)."""
        if error_code in TOMTOM_KEY_REJECTION_CODES:
            self.key_usage[api_key]["quota_exceeded"] = True
            logger.warning(f"API key exhausted (HTTP {error_code}): {api_key[:8]}...")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
    )
    async def fetch_flow_segment(
        self, lat: float, lon: float, node_id: str = ""
    ) -> dict[str, Any]:
        """
        Fetch traffic flow data for a specific point with smart retry.

        Args:
            lat: Latitude
            lon: Longitude
            node_id: Optional node identifier for logging

        Returns:
            Traffic flow data dict

        Raises:
            RuntimeError: If all API keys are exhausted
            httpx.HTTPError: If request fails after retries
        """
        api_key = self._get_next_key()
        if not api_key:
            raise RuntimeError("All TomTom API keys exhausted or erroring")

        params = {"point": f"{lat},{lon}", "key": api_key}

        try:
            response = await self.client.get(TOMTOM_FLOW_URL, params=params)

            # Handle quota/auth errors by rotating to next key
            if response.status_code in TOMTOM_KEY_REJECTION_CODES:
                self._mark_key_exhausted(api_key, response.status_code)
                # Recursive retry with next key
                return await self.fetch_flow_segment(lat, lon, node_id)

            response.raise_for_status()
            self.key_usage[api_key]["calls"] += 1

            data = response.json()
            logger.debug(f"API success for {node_id or 'point'} ({lat:.5f}, {lon:.5f})")
            return data

        except httpx.HTTPStatusError as e:
            self.key_usage[api_key]["errors"] += 1
            self.key_usage[api_key]["last_error"] = f"HTTP {e.response.status_code}"
            logger.error(
                f"API HTTP error {e.response.status_code} for {node_id or 'point'}"
            )
            raise

        except Exception as e:
            self.key_usage[api_key]["errors"] += 1
            self.key_usage[api_key]["last_error"] = str(e)
            logger.error(f"API error for {node_id or 'point'}: {e}")
            raise

    async def fetch_multiple(
        self, points: list[dict[str, Any]]
    ) -> list[dict[str, Any] | Exception]:
        """
        Fetch traffic flow data for multiple points in parallel.

        Args:
            points: List of dicts with 'lat', 'lon', 'node_id' keys

        Returns:
            List of results (dict or Exception if failed)
        """
        tasks = [
            self.fetch_flow_segment(
                p["lat"], p["lon"], p.get("node_id", "")
            )
            for p in points
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Log summary
        success_count = sum(1 for r in results if not isinstance(r, Exception))
        error_count = len(results) - success_count
        logger.info(
            f"Parallel fetch complete: {success_count} success, {error_count} errors"
        )

        return results

    def get_usage_stats(self) -> dict[str, Any]:
        """
        Get usage statistics for all API keys.

        Returns:
            Dict with per-key stats and totals
        """
        total_calls = sum(u["calls"] for u in self.key_usage.values())
        total_errors = sum(u["errors"] for u in self.key_usage.values())
        exhausted_count = sum(
            1 for u in self.key_usage.values() if u["quota_exceeded"]
        )

        return {
            "total_keys": len(self.api_keys),
            "exhausted_keys": exhausted_count,
            "available_keys": len(self.api_keys) - exhausted_count,
            "total_calls": total_calls,
            "total_errors": total_errors,
            "per_key": self.key_usage,
        }


def create_client(api_keys: list[str]) -> TomTomAPIClient | None:
    """
    Factory function to create TomTomAPIClient with fallback.

    Returns:
        TomTomAPIClient if async available, None otherwise
    """
    if not ASYNC_AVAILABLE:
        logger.warning(
            "httpx/tenacity not available, async client disabled. "
            "Install with: pip install httpx tenacity"
        )
        return None

    if not api_keys:
        logger.warning("No API keys provided, async client disabled")
        return None

    return TomTomAPIClient(api_keys)
