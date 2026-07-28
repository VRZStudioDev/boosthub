"""
BoostHub QA MITM proxy handler.

Authorized use only: this handler is scoped to controlled staging tests for
staging.api.ourapp.com. It holds selected order decision requests until an
authenticated QA webhook sends an accept/decline decision.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
from collections import deque
from dataclasses import dataclass
from typing import Deque, Optional

from mitmproxy import ctx, http


TARGET_HOST = os.getenv("TARGET_HOST", "staging.api.ourapp.com").strip().lower()
WEBHOOK_TOKEN = os.getenv("WEBHOOK_TOKEN", "TOKEN_AQUI")
DECISION_PATH = os.getenv("DECISION_PATH", "/decision")
HEALTH_PATH = os.getenv("HEALTH_PATH", "/health")
PENDING_TIMEOUT_SECONDS = int(os.getenv("PENDING_TIMEOUT_SECONDS", "45"))
AUDIT_LOG_PATH = os.getenv("AUDIT_LOG_PATH", "/app/logs/proxy_audit.jsonl")

ORDER_PATH_PATTERN = re.compile(
    os.getenv("ORDER_PATH_PATTERN", r"^/v1/orders/[^/]+/(accept|decline)$")
)


@dataclass
class PendingRequest:
    token: str
    flow: http.HTTPFlow
    created_at: float
    path: str
    client_ip: str


pending_requests: Deque[PendingRequest] = deque()
pending_lock = threading.Lock()
audit_lock = threading.Lock()


def _audit(event: str, **fields: object) -> None:
    payload = {"event": event, "timestamp": time.time(), **fields}
    line = json.dumps(payload, sort_keys=True)

    with audit_lock:
        try:
            os.makedirs(os.path.dirname(AUDIT_LOG_PATH), exist_ok=True)
            with open(AUDIT_LOG_PATH, "a", encoding="utf-8") as log_file:
                log_file.write(line + "\n")
        except OSError as exc:
            ctx.log.warn(f"Unable to write audit log: {exc}")


def _json_response(status_code: int, payload: dict) -> http.Response:
    return http.Response.make(
        status_code,
        json.dumps(payload).encode("utf-8"),
        {"Content-Type": "application/json; charset=utf-8"},
    )


def _get_client_ip(flow: http.HTTPFlow) -> str:
    if flow.client_conn and flow.client_conn.address:
        return str(flow.client_conn.address[0])
    return "unknown"


def _extract_token(flow: http.HTTPFlow) -> Optional[str]:
    auth_header = flow.request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header.removeprefix("Bearer ").strip()
    return flow.request.query.get("token")


def _is_authorized(flow: http.HTTPFlow) -> bool:
    configured = WEBHOOK_TOKEN.strip()
    if not configured or configured == "TOKEN_AQUI":
        ctx.log.warn("WEBHOOK_TOKEN is still using the placeholder value.")
    return _extract_token(flow) == configured


def _prune_expired_pending() -> None:
    now = time.time()
    expired: list[PendingRequest] = []

    with pending_lock:
        while pending_requests and now - pending_requests[0].created_at > PENDING_TIMEOUT_SECONDS:
            expired.append(pending_requests.popleft())

    for pending in expired:
        pending.flow.response = _json_response(
            504,
            {
                "status": "expired",
                "token": pending.token,
                "message": "QA hold timed out before a decision was received.",
            },
        )
        pending.flow.resume()
        ctx.log.warn(f"Expired held request token={pending.token} path={pending.path}")
        _audit("request_expired", token=pending.token, path=pending.path)


class QaOrderInterceptor:
    def request(self, flow: http.HTTPFlow) -> None:
        _prune_expired_pending()

        host = flow.request.pretty_host.lower()
        path = flow.request.path.split("?", 1)[0]

        if path == HEALTH_PATH:
            with pending_lock:
                pending_count = len(pending_requests)
            flow.response = _json_response(
                200,
                {
                    "status": "ok",
                    "target_host": TARGET_HOST,
                    "pending_requests": pending_count,
                },
            )
            return

        if path == DECISION_PATH:
            self._handle_decision(flow)
            return

        if host != TARGET_HOST:
            return

        if flow.request.method.upper() != "POST" or not ORDER_PATH_PATTERN.search(path):
            return

        token = uuid.uuid4().hex
        pending = PendingRequest(
            token=token,
            flow=flow,
            created_at=time.time(),
            path=path,
            client_ip=_get_client_ip(flow),
        )

        with pending_lock:
            pending_requests.append(pending)
            pending_count = len(pending_requests)

        flow.intercept()
        ctx.log.info(
            f"QA hold token={token} host={host} path={path} "
            f"client={pending.client_ip} pending={pending_count}"
        )
        _audit(
            "request_held",
            token=token,
            host=host,
            path=path,
            client_ip=pending.client_ip,
            pending_requests=pending_count,
        )

    def _handle_decision(self, flow: http.HTTPFlow) -> None:
        if flow.request.method.upper() != "POST":
            flow.response = _json_response(405, {"error": "method_not_allowed"})
            return

        if not _is_authorized(flow):
            flow.response = _json_response(401, {"error": "unauthorized"})
            return

        try:
            body = json.loads(flow.request.get_text() or "{}")
        except json.JSONDecodeError:
            flow.response = _json_response(400, {"error": "invalid_json"})
            return

        decision = str(body.get("decision", "")).strip().lower()
        if decision not in {"accept", "decline"}:
            flow.response = _json_response(400, {"error": "invalid_decision"})
            return

        with pending_lock:
            pending = pending_requests.popleft() if pending_requests else None
            pending_count = len(pending_requests)

        if pending is None:
            flow.response = _json_response(404, {"error": "no_pending_request"})
            ctx.log.warn(f"Decision received without pending request decision={decision}")
            _audit("decision_without_pending", decision=decision)
            return

        if decision == "accept":
            pending.flow.resume()
            ctx.log.info(
                f"QA release token={pending.token} decision=accept path={pending.path} "
                f"remaining={pending_count}"
            )
            _audit(
                "request_released",
                token=pending.token,
                decision=decision,
                path=pending.path,
                pending_requests=pending_count,
            )
        else:
            pending.flow.response = _json_response(
                200,
                {
                    "status": "declined_by_qa_simulation",
                    "token": pending.token,
                },
            )
            pending.flow.resume()
            ctx.log.info(
                f"QA drop token={pending.token} decision=decline path={pending.path} "
                f"remaining={pending_count}"
            )
            _audit(
                "request_dropped",
                token=pending.token,
                decision=decision,
                path=pending.path,
                pending_requests=pending_count,
            )

        flow.response = _json_response(
            200,
            {
                "status": "ok",
                "decision": decision,
                "processed_token": pending.token,
                "pending_requests": pending_count,
            },
        )


addons = [QaOrderInterceptor()]