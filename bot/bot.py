"""
BoostHub — Status & Support bot (Telegram).

Scope: account status + support only.
  /start  -> welcome + link to the Dashboard
  /status -> looks up the user's subscription in Supabase
  /ajuda  -> shows available commands

This bot intentionally does NOT distribute any network/proxy configuration or
trigger any device behaviour. It is read-only against Supabase.
"""

import os
import html
import logging
from datetime import datetime, timedelta, timezone

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ContextTypes,
    filters,
)
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
# httpx logs full request URLs at INFO, which include the bot token. Keep it at
# WARNING so the token is never written to logs / the systemd journal.
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "https://boosthub.vercel.app/dashboard")
SUPPORT_EMAIL = os.getenv("SUPPORT_EMAIL", "support@boosthub.com")
SUPPORT_WHATSAPP = os.getenv("SUPPORT_WHATSAPP")  # optional group/chat invite link

if not SUPABASE_URL:
    raise SystemExit("Missing required env var: SUPABASE_URL")
if not SUPABASE_SERVICE_ROLE_KEY:
    raise SystemExit("Missing required env var: SUPABASE_SERVICE_ROLE_KEY")
if not TELEGRAM_TOKEN:
    raise SystemExit("Missing required env var: TELEGRAM_TOKEN")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def get_profile_by_chat_id(chat_id: int):
    """Return the profile linked to this Telegram chat_id, or None."""
    try:
        response = (
            supabase.table("profiles")
            .select("id, email, license_status, current_period_end")
            .eq("telegram_chat_id", str(chat_id))
            .limit(1)
            .execute()
        )
        if response.data:
            return response.data[0]
        return None
    except Exception as e:  # noqa: BLE001
        logger.error("Erro ao buscar perfil: %s", e)
        return None


HELP_TEXT = (
    "I'm the BoostHub assistant. Here's what I can do:\n\n"
    "/start - Open the main menu\n"
    "/status - Check your subscription status\n"
    "/id - Show your Telegram chat_id\n"
    "/accept &lt;amount&gt; - Log an accepted order\n"
    "/decline &lt;amount&gt; - Log a declined order\n"
    "/tutorial - How to set up BoostHub\n"
    "/support - Contact support\n"
    "/faq - Frequently asked questions\n"
    "/help - Show this message\n\n"
    f"Manage your account on the Dashboard: {DASHBOARD_URL}"
)


def main_menu_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [
            [InlineKeyboardButton("📊 Dashboard", url=DASHBOARD_URL)],
            [
                InlineKeyboardButton("📖 Tutorial", callback_data="tutorial"),
                InlineKeyboardButton("❓ FAQ", callback_data="faq"),
            ],
            [
                InlineKeyboardButton("💬 Support", callback_data="support"),
                InlineKeyboardButton("ℹ️ Status", callback_data="status"),
            ],
        ]
    )


def dashboard_button() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        [[InlineKeyboardButton("🔗 Open Dashboard", url=DASHBOARD_URL)]]
    )


# ---- content builders (shared by commands and inline buttons) ----


def build_tutorial() -> tuple[str, InlineKeyboardMarkup]:
    text = (
        "<b>📖 Getting started with BoostHub</b>\n\n"
        "1. Create your account on the Dashboard and sign in with the magic link.\n"
        "2. Subscribe to activate your plan (secure Stripe checkout).\n"
        "3. Here in Telegram, send /id to get your chat_id.\n"
        "4. Paste it into the Dashboard: <b>Settings → Link Telegram</b>, then save.\n"
        "5. Send /status anytime to check your subscription.\n\n"
        "That's it — you're all set. 🚀"
    )
    return text, dashboard_button()


def build_support() -> tuple[str, InlineKeyboardMarkup]:
    lines = [
        "<b>💬 BoostHub Support</b>\n",
        f"📧 Email: <code>{html.escape(SUPPORT_EMAIL)}</code>",
    ]
    buttons = [[InlineKeyboardButton("🔗 Open Dashboard", url=DASHBOARD_URL)]]
    if SUPPORT_WHATSAPP:
        lines.append("💬 WhatsApp: tap the button below.")
        buttons.append([InlineKeyboardButton("💬 WhatsApp", url=SUPPORT_WHATSAPP)])
    lines.append("\nYou can also manage your account from the Dashboard.")
    return "\n".join(lines), InlineKeyboardMarkup(buttons)


def build_faq() -> tuple[str, InlineKeyboardMarkup]:
    text = (
        "<b>❓ Frequently Asked Questions</b>\n\n"
        "<b>What is BoostHub?</b>\n"
        "A productivity assistant for gig drivers — cost-per-mile analysis, "
        "hands-free voice shortcuts, and activity tracking so you focus on what pays.\n\n"
        "<b>How does the subscription work?</b>\n"
        "It's a monthly plan billed securely via Stripe. Manage or cancel anytime "
        "from the Dashboard.\n\n"
        "<b>What if /status says 'inactive'?</b>\n"
        "Your plan isn't active. Open the Dashboard and (re)subscribe to reactivate it.\n\n"
        "<b>How do I unlink my Telegram account?</b>\n"
        "Go to <b>Dashboard → Settings → Link Telegram</b> and press <b>Unlink</b>.\n\n"
        "<b>Need technical help?</b>\n"
        "Use /support to reach our team."
    )
    return text, dashboard_button()


def build_status(chat_id: int) -> tuple[str, InlineKeyboardMarkup]:
    profile = get_profile_by_chat_id(chat_id)

    if not profile:
        text = (
            "❌ You haven't linked your Telegram account to BoostHub yet.\n\n"
            "Go to the Dashboard in Settings and paste your Telegram ID.\n"
            f"Your chat_id is: <code>{chat_id}</code>"
        )
        return text, dashboard_button()

    license_status = profile.get("license_status", "inactive")
    email = html.escape(str(profile.get("email", "not provided")))
    decline_count, declined_total = get_decline_stats(profile["id"])

    if license_status == "active":
        end_date = profile.get("current_period_end")
        end_str = None
        if end_date:
            try:
                dt = datetime.fromisoformat(str(end_date).replace("Z", "+00:00"))
                end_str = dt.strftime("%d/%m/%Y")
            except ValueError:
                end_str = str(end_date)
        text = (
            "✅ Your subscription is <b>ACTIVE</b>"
            + (f" until {end_str}." if end_str else ".")
            + f"\n\n📧 Email: {email}"
            + format_decline_stats(decline_count, declined_total)
        )
    else:
        text = (
            "❌ Your subscription is <b>INACTIVE</b>.\n\n"
            f"📧 Email: {email}\n\n"
            "Renew your subscription by accessing the Dashboard."
            + format_decline_stats(decline_count, declined_total)
        )
    return text, dashboard_button()


def get_decline_stats(profile_id: str) -> tuple[int, float]:
    """Return (count, total amount) for declined decisions in the last 30 days."""
    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    try:
        response = (
            supabase.table("usage_logs")
            .select("amount")
            .eq("profile_id", profile_id)
            .eq("decision", "decline")
            .gte("triggered_at", since)
            .execute()
        )
        rows = response.data or []
        total = sum(float(row.get("amount") or 0) for row in rows)
        return len(rows), total
    except Exception as e:  # noqa: BLE001
        logger.error("Error fetching decline stats: %s", e)
        return 0, 0.0


def format_decline_stats(count: int, total: float) -> str:
    return (
        "\n\n<b>Last 30 days</b>"
        f"\nDeclines logged: <b>{count}</b>"
        f"\nEstimated savings: <b>${total:.2f}</b>"
    )


def parse_amount(args: list[str]) -> float | None:
    if len(args) < 1 or len(args) > 2:
        return None
    try:
        amount = float(args[0].replace(",", "."))
    except ValueError:
        return None
    if amount <= 0:
        return None
    return round(amount, 2)


def parse_source(args: list[str]) -> str:
    if len(args) == 2 and args[1].lower() == "voice":
        return "voice"
    return "manual"


def insert_decision(profile_id: str, decision: str, amount: float, source: str):
    return (
        supabase.table("usage_logs")
        .insert(
            {
                "profile_id": profile_id,
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "status": decision,
                "decision": decision,
                "amount": amount,
                "source": source,
            }
        )
        .execute()
    )


async def record_decision(update: Update, context: ContextTypes.DEFAULT_TYPE, decision: str):
    chat_id = update.effective_chat.id
    amount = parse_amount(context.args)
    if amount is None:
        await update.message.reply_text(
            f"Usage: /{decision} 6.50\nPlease enter a positive numeric amount."
        )
        return

    profile = get_profile_by_chat_id(chat_id)
    if not profile:
        await update.message.reply_text(
            "❌ You haven't linked your Telegram account to BoostHub yet.\n\n"
            "Go to the Dashboard in Settings and paste your Telegram ID.\n"
            f"Your chat_id is: <code>{chat_id}</code>",
            parse_mode="HTML",
        )
        return

    if profile.get("license_status") != "active":
        await update.message.reply_text(
            "❌ Your subscription is inactive. Open the Dashboard to reactivate before logging decisions.",
            reply_markup=dashboard_button(),
        )
        return

    try:
        insert_decision(profile["id"], decision, amount, parse_source(context.args))
    except Exception as e:  # noqa: BLE001
        logger.error("Error recording %s decision: %s", decision, e)
        await update.message.reply_text("Could not record this decision. Please try again.")
        return

    label = "Acceptance" if decision == "accept" else "Decline"
    emoji = "✅" if decision == "accept" else "↩️"
    await update.message.reply_text(f"{emoji} {label} registered: ${amount:.2f}")


# ---- command handlers ----


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id
    first_name = html.escape(user.first_name) if user and user.first_name else "there"
    await update.message.reply_text(
        f"🚀 Hello {first_name}! Welcome to BoostHub.\n\n"
        f"🆔 Your chat_id is: <code>{chat_id}</code>\n\n"
        "Choose an option below:",
        parse_mode="HTML",
        reply_markup=main_menu_keyboard(),
    )


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await update.message.reply_text(
        f"🆔 Your Telegram ID is:\n<code>{chat_id}</code>\n\n"
        "Copy this number and paste it in the Dashboard (Settings > Link Telegram).",
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT, parse_mode="HTML")


async def tutorial_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text, markup = build_tutorial()
    await update.message.reply_text(text, parse_mode="HTML", reply_markup=markup)


async def support_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text, markup = build_support()
    await update.message.reply_text(text, parse_mode="HTML", reply_markup=markup)


async def faq_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text, markup = build_faq()
    await update.message.reply_text(text, parse_mode="HTML", reply_markup=markup)


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text, markup = build_status(update.effective_chat.id)
    await update.message.reply_text(text, parse_mode="HTML", reply_markup=markup)


async def accept_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await record_decision(update, context, "accept")


async def decline_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await record_decision(update, context, "decline")


async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    if data == "tutorial":
        text, markup = build_tutorial()
    elif data == "support":
        text, markup = build_support()
    elif data == "faq":
        text, markup = build_faq()
    elif data == "status":
        text, markup = build_status(update.effective_chat.id)
    else:
        return
    await query.message.reply_text(text, parse_mode="HTML", reply_markup=markup)


async def unknown_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "I didn't recognize that command. Use /help to see available commands."
    )


def main():
    application = Application.builder().token(TELEGRAM_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(CommandHandler("id", id_command))
    application.add_handler(CommandHandler("accept", accept_command))
    application.add_handler(CommandHandler("decline", decline_command))
    application.add_handler(CommandHandler("tutorial", tutorial_command))
    application.add_handler(CommandHandler("support", support_command))
    application.add_handler(CommandHandler("faq", faq_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("ajuda", help_command))
    application.add_handler(CallbackQueryHandler(menu_callback))
    application.add_handler(
        MessageHandler(filters.TEXT & ~filters.COMMAND, unknown_message)
    )

    logger.info("Bot started...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
