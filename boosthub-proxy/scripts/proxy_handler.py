"""
BoostHub MITM proxy handler v5 - SDUI injector + Excluded generator.
"""

import json
import os
import re
import threading
import logging

from mitmproxy import http


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("boosthub-proxy")
logger.info("BoostHub Proxy Handler v5 starting...")

TARGET_HOSTS = [
    "api-dasher.doordash.com",
    "dashapi.com",
    "unified-gateway.doordash.com",
    "push.dashapi.com",
    "dynamic-values-edge-service.doordash.com",
    "iguazu.doordash.com",
    "otel-mobile.doordash.com",
    "doordash.mobile.prod.cmtelematics.com",
]

LOW_BALL_CENTS = int(os.getenv("LOW_BALL_CENTS", "500"))
GOOD_OFFER_CENTS = int(os.getenv("GOOD_OFFER_CENTS", "800"))

DECLINE_RE = re.compile(r"/(?:assignments|deliveries)/([^/?]+)/decline/?$")
ACCEPT_RE = re.compile(r"/(?:assignments|deliveries)/([^/?]+)/accept/?$")
ACCEPT_MODAL_RE = re.compile(r"accept_modal")

push_streams = {}
push_lock = threading.Lock()
killed_assignments = set()
killed_lock = threading.Lock()

ACTIVE_ASSIGNMENTS_RE = re.compile(r"active_assignments")
ACTIVE_DELIVERIES_RE = re.compile(r"active_deliveries")


def _is_target(host):
    return any(t in host for t in TARGET_HOSTS)


def _client_key(flow):
    addr = flow.client_conn.address
    return str(addr[0]) + ":" + str(addr[1])


def _dollar_amount(header_str):
    try:
        cleaned = str(header_str).replace("$", "").replace(",", "").strip()
        return int(float(cleaned) * 100)
    except Exception:
        return 0


def _inject_indicator(data_bytes):
    try:
        data = json.loads(data_bytes)
    except Exception:
        return data_bytes
    if not isinstance(data, dict):
        return data_bytes

    payment = data.get("attributes", {}).get("payment", {})
    header = payment.get("header", "")
    amount_cents = _dollar_amount(header)
    if amount_cents <= 0:
        return data_bytes

    if amount_cents >= GOOD_OFFER_CENTS:
        indicator = " \u2705"
    elif amount_cents >= LOW_BALL_CENTS:
        indicator = " \U0001f7e1"
    else:
        indicator = " \u274c"

    if "attributes" in data and "payment" in data["attributes"]:
        old = data["attributes"]["payment"]["header"]
        if indicator not in old:
            data["attributes"]["payment"]["header"] = old + indicator
            logger.info("INJECTED: " + old + " -> " + data["attributes"]["payment"]["header"])

    return json.dumps(data).encode("utf-8")


def _filter_killed_assignments(data_bytes):
    """Remove killed assignments from arrays so the app doesn't show them as timeout."""
    try:
        data = json.loads(data_bytes)
    except Exception:
        return data_bytes

    with killed_lock:
        ids_to_remove = set(killed_assignments)

    if isinstance(data, list):
        filtered = [item for item in data if str(item.get("id", "") or item.get("assignment_id", "")) not in ids_to_remove]
        removed = len(data) - len(filtered)
        if removed > 0:
            logger.info("FILTERED: removed " + str(removed) + " killed assignments from response")
            killed_assignments.clear()
        return json.dumps(filtered).encode("utf-8")

    if isinstance(data, dict):
        if "assignments" in data:
            old = data["assignments"]
            data["assignments"] = [a for a in old if str(a.get("id", "") or a.get("assignment_id", "")) not in ids_to_remove]
            removed = len(old) - len(data["assignments"])
            if removed > 0:
                logger.info("FILTERED: removed " + str(removed) + " assignments from active_assignments")
                killed_assignments.clear()
        if "deliveries" in data:
            old = data["deliveries"]
            data["deliveries"] = [d for d in old if str(d.get("id", "") or d.get("assignment_id", "")) not in ids_to_remove]
            removed = len(old) - len(data["deliveries"])
            if removed > 0:
                logger.info("FILTERED: removed " + str(removed) + " deliveries from active_deliveries")

    return json.dumps(data).encode("utf-8")


class OrderModifier:
    def request(self, flow):
        host = flow.request.pretty_host.lower()
        path = flow.request.path.split("?", 1)[0]
        if not _is_target(host):
            return
        if ACCEPT_RE.search(path):
            logger.info("ACCEPT passando")
            return
        if DECLINE_RE.search(path):
            ck = _client_key(flow)
            aid_match = DECLINE_RE.search(path)
            aid = aid_match.group(1) if aid_match else ""
            if aid:
                with killed_lock:
                    killed_assignments.add(aid)
            logger.info("DECLINE: blocking push stream for " + ck + " assignment=" + aid)
            with push_lock:
                pushed = push_streams.pop(ck, None)
            if pushed and not pushed.error:
                try:
                    pushed.kill()
                    logger.info("Push killed")
                except Exception:
                    pass
            flow.kill()
            return

    def response(self, flow):
        if not _is_target(flow.request.pretty_host.lower()):
            return
        path = flow.request.path.split("?", 1)[0]
        if ACCEPT_MODAL_RE.search(path):
            if flow.response and flow.response.content:
                flow.response.content = _inject_indicator(flow.response.content)
        if ACTIVE_ASSIGNMENTS_RE.search(path) or ACTIVE_DELIVERIES_RE.search(path):
            if flow.response and flow.response.content:
                flow.response.content = _filter_killed_assignments(flow.response.content)


class PushTracker:
    def request(self, flow):
        if "push.dashapi.com" in flow.request.pretty_host:
            ck = _client_key(flow)
            with push_lock:
                push_streams[ck] = flow

    def error(self, flow):
        if "push.dashapi.com" in flow.request.pretty_host:
            ck = _client_key(flow)
            with push_lock:
                push_streams.pop(ck, None)


class Health():
    def request(self, flow):
        if flow.request.path.split("?", 1)[0] == "/health":
            with push_lock:
                n = len(push_streams)
            flow.response = http.Response.make(
                200,
                json.dumps({"status":"ok","push_streams":n}).encode(),
                {"Content-Type":"application/json"},
            )


addons = [OrderModifier(), PushTracker(), Health()]
logger.info("BoostHub Proxy v5 ready: " + str(len(addons)) + " addons")