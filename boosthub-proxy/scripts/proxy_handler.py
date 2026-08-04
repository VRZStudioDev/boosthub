"""
BoostHub MITM proxy v7 - SDUI injector + Telegram notification.
Clean version: no push/offer blocking. Focus on what works.
"""

import json
import os
import re
import logging
import threading
import time

from mitmproxy import http
import requests


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("boosthub-proxy")
logger.info("BoostHub Proxy v7 starting...")

# ── Config ───────────────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "8792459063:AAE7mimGKw0tv2c68kMhx9Hjd9yN5VIrMjo")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "8656593306")

LOW_BALL_CENTS = int(os.getenv("LOW_BALL_CENTS", "500"))
GOOD_OFFER_CENTS = int(os.getenv("GOOD_OFFER_CENTS", "800"))

ACCEPT_MODAL_RE = re.compile(r"accept_modal")

TARGET_HOST = "api-dasher.doordash.com"

unblock_until = 0.0
unblock_lock = threading.Lock()
tg_last_update = 0


# ── Helpers ──────────────────────────────────────────────────────────────────

def _dollar_amount(s):
    try:
        return int(float(str(s).replace("$", "").replace(",", "").strip()) * 100)
    except Exception:
        return 0


def _escape(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _inject_indicator(data_bytes):
    try:
        data = json.loads(data_bytes)
    except Exception:
        return data_bytes
    if not isinstance(data, dict):
        return data_bytes

    payment = data.get("attributes", {}).get("payment", {})
    header = payment.get("header", "")
    amt = _dollar_amount(header)
    if amt <= 0:
        return data_bytes

    if amt >= GOOD_OFFER_CENTS:
        indicator = " \u2705"
    elif amt >= LOW_BALL_CENTS:
        indicator = " \U0001f7e1"
    else:
        indicator = " \u274c"

    if "attributes" in data and "payment" in data["attributes"]:
        old = data["attributes"]["payment"]["header"]
        if indicator not in old:
            data["attributes"]["payment"]["header"] = old + indicator
            logger.info("INJECTED: " + old + " -> " + data["attributes"]["payment"]["header"])

    return json.dumps(data).encode("utf-8")


def _send_telegram(amount_cents, pickup_addr, dropoff_addr, distance, deadline, aid):
    if not TELEGRAM_BOT_TOKEN:
        return

    d = amount_cents / 100.0
    if amount_cents >= GOOD_OFFER_CENTS:
        emoji = "\u2705"
    elif amount_cents >= LOW_BALL_CENTS:
        emoji = "\U0001f7e1"
    else:
        emoji = "\u274c"

    pickup = _escape(pickup_addr)
    dropoff = _escape(dropoff_addr)
    dist = _escape(distance)
    when = _escape(deadline).replace("Deliver by ", "")

    lines = [
        "%s <b>Nova Oferta!</b>" % emoji,
        "\U0001f3ea <b>Pickup:</b> " + pickup,
        "\U0001f4b0 <b>Valor:</b> $%.2f" % d,
    ]
    if dist and dist != "N/D":
        lines.append("\U0001f4cf <b>Dist\u00e2ncia:</b> " + dist)
    if when and when != "N/D":
        lines.append("\U0001f552 <b>Entrega at\u00e9:</b> " + when)
    if dropoff and dropoff != "N/D":
        lines.append("\U0001f4cd <b>Cliente:</b> " + dropoff)

    text = "\n".join(lines)

    markup = json.dumps({
        "inline_keyboard": [[
            {"text": "\u2705 Aceitar", "callback_data": "accept:" + aid},
            {"text": "\u274c Recusar", "callback_data": "decline:" + aid},
        ]]
    })

    try:
        r = requests.post(
            "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/sendMessage",
            json={"chat_id": TELEGRAM_CHAT_ID, "text": text, "parse_mode":"HTML", "reply_markup": markup},
            timeout=10,
        )
        if r.status_code == 200:
            logger.info("Telegram sent: $" + str(d) + " " + dist)
    except Exception as e:
        logger.info("TG send error: " + str(e))


# ── Telegram polling thread ─────────────────────────────────────────────────

def _tg_poll():
    global tg_last_update
    if not TELEGRAM_BOT_TOKEN:
        return
    while True:
        try:
            r = requests.get(
                "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/getUpdates",
                params={"offset": tg_last_update + 1, "timeout": 5},
                timeout=30,
            )
            if r.status_code == 200:
                for u in r.json().get("result", []):
                    tg_last_update = u["update_id"]
                    cb = u.get("callback_query")
                    if cb:
                        data = cb.get("data", "")
                        logger.info("TG callback: " + data)
                        if data.startswith("accept:"):
                            aid = data.split(":", 1)[1]
                            with unblock_lock:
                                unblock_until = time.time() + 10
                            logger.info("Accept clicked – unlocked for 10s")
                            requests.post(
                                "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/answerCallbackQuery",
                                json={"callback_query_id": cb["id"], "text": "Aceito! Abra o app."},
                                timeout=10,
                            )
                        elif data.startswith("decline:"):
                            requests.post(
                                "https://api.telegram.org/bot" + TELEGRAM_BOT_TOKEN + "/answerCallbackQuery",
                                json={"callback_query_id": cb["id"], "text": "Recusado."},
                                timeout=10,
                            )
        except Exception:
            pass
        time.sleep(1)


# ── Addon: Order Modifier ──────────────────────────────────────────

class OrderModifier:
    def request(self, flow):
        if TARGET_HOST not in flow.request.pretty_host.lower():
            return
        path = flow.request.path.split("?", 1)[0]
        if "/accept" in path or "/decline" in path:
            if "accept" in path.lower():
                logger.info("ACCEPT passando")

    def response(self, flow):
        if TARGET_HOST not in flow.request.pretty_host.lower():
            return
        if ACCEPT_MODAL_RE.search(flow.request.path.split("?", 1)[0]):
            if flow.response and flow.response.content:
                try:
                    data = json.loads(flow.response.content)
                except Exception:
                    return
                if not isinstance(data, dict):
                    return

                modified = _inject_indicator(json.dumps(data).encode("utf-8"))
                flow.response.content = modified

                attrs = data.get("attributes", {})
                payment = attrs.get("payment", {})
                header = payment.get("header", "")
                amt = _dollar_amount(header)

                effort = attrs.get("effort", {})
                estimates = effort.get("estimates", [])
                distance = ""
                t = ""
                for est in estimates:
                    if "mi" in str(est) or "km" in str(est):
                        distance = str(est)
                    elif "Deliver" in str(est) or "PM" in str(est) or "AM" in str(est):
                        t = str(est)

                route = attrs.get("route", {})
                waypoints = route.get("waypoints", [])
                pickup = waypoints[0].get("hover_label", "N/D") if len(waypoints) > 0 else "N/D"
                dropoff = waypoints[1].get("hover_label", "N/D") if len(waypoints) > 1 else "N/D"

                aid = data.get("assignment_id", "")

                _send_telegram(amt, pickup, dropoff, distance, t, aid)

                # Store last offer for iOS app polling
                global last_offer_json
                last_offer_json = {
                    "assignment_id": aid,
                    "store_name": pickup,
                    "store_address": "",
                    "amount": amt / 100.0,
                    "tip": 0.0,
                    "base_pay": amt / 100.0,
                    "distance_miles": float(str(distance).replace(" mi", "").replace(" km", "")) if distance else 0.0,
                    "deadline": int(time.time()) + 35,
                    "pickup_instructions": "",
                    "dropoff_instructions": dropoff if dropoff != "N/D" else "",
                    "customer_name": "",
                    "customer_address": dropoff if dropoff != "N/D" else "",
                    "items": [],
                    "is_stack": False,
                    "captured_at": time.time(),
                    "raw": header
                }


# ── Health + Addons ──────────────────────────────────────────────────────────

class Health():
    def request(self, flow):
        if flow.request.path.split("?", 1)[0] == "/health":
            flow.response = http.Response.make(
                200,
                json.dumps({"status":"ok","version":"v7"}).encode(),
                {"Content-Type":"application/json"},
            )


addons = [OrderModifier(), Health()]

# ── HTTP endpoint for iOS app ────────────────────────────────────────────
import http.server
import socketserver

last_offer_json: dict = {}


class OfferHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/offer":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps(last_offer_json).encode())
        elif self.path == "/health":
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"ok")
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass


def _start_http():
    try:
        server = socketserver.TCPServer(("0.0.0.0", 8080), OfferHandler)
        logger.info("Offer HTTP endpoint on port 8080")
        server.serve_forever()
    except Exception as e:
        logger.error(f"HTTP server failed: {e}")


threading.Thread(target=_start_http, daemon=True).start()

# Start telegram polling
if TELEGRAM_BOT_TOKEN:
    threading.Thread(target=_tg_poll, daemon=True).start()
    logger.info("v7 ready – 2 addons")