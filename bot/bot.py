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
from datetime import datetime

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes
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
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # service role, server-side only
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "https://boosthub.vercel.app/dashboard")

if not (SUPABASE_URL and SUPABASE_SERVICE_KEY and TELEGRAM_TOKEN):
    raise SystemExit("Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, TELEGRAM_TOKEN")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)


def get_profile_by_chat_id(chat_id: int):
    """Return the profile linked to this Telegram chat_id, or None."""
    try:
        response = (
            supabase.table("profiles")
            .select("email, license_status, current_period_end")
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
    "I'm the BoostHub assistant.\n\n"
    "Available commands:\n"
    "/status - Check your subscription status\n"
    "/id - Show your Telegram chat_id\n"
    "/help - Display this message again\n\n"
    f"Access the Dashboard to manage your account: {DASHBOARD_URL}"
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    chat_id = update.effective_chat.id
    first_name = html.escape(user.first_name) if user and user.first_name else "motorista"
    await update.message.reply_text(
        f"🚀 Hello {first_name}! Welcome to the BoostHub.\n\n"
        f"🆔 Your chat_id is: <code>{chat_id}</code>\n\n"
        f"{HELP_TEXT}",
        parse_mode="HTML",
    )


async def id_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    await update.message.reply_text(
        f"🆔 Your Telegram ID is:\n<code>{chat_id}</code>\n\n"
        "Copy this number and paste it in the Dashboard (Settings > Link Telegram).",
        parse_mode="HTML",
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT)


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    profile = get_profile_by_chat_id(chat_id)

    if not profile:
        await update.message.reply_text(
            "❌ You haven't linked your Telegram account to BoostHub yet.\n\n"
            "Go to the Dashboard in Settings and paste your Telegram ID.\n"
            f"Your chat_id is: <code>{chat_id}</code>",
            parse_mode="HTML",
        )
        return

    license_status = profile.get("license_status", "inactive")
    email = html.escape(str(profile.get("email", "not provided")))

    if license_status == "active":
        end_date = profile.get("current_period_end")
        end_str = None
        if end_date:
            try:
                dt = datetime.fromisoformat(str(end_date).replace("Z", "+00:00"))
                end_str = dt.strftime("%d/%m/%Y")
            except ValueError:
                end_str = str(end_date)
        msg = (
            f"✅ Your subscription is <b>ACTIVE</b>"
            + (f" until {end_str}." if end_str else ".")
            + f"\n\n📧 Email: {email}"
        )
    else:
        msg = (
            "❌ Your subscription is <b>INACTIVE</b>.\n\n"
            f"📧 Email: {email}\n\n"
            "Renew your subscription by accessing the Dashboard."
        )

    keyboard = [[InlineKeyboardButton("📊 Access Dashboard", url=DASHBOARD_URL)]]
    await update.message.reply_text(
        msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="HTML"
    )


def main():
    application = Application.builder().token(TELEGRAM_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(CommandHandler("id", id_command))
    application.add_handler(CommandHandler("ajuda", help_command))
    application.add_handler(CommandHandler("help", help_command))

    logger.info("Bot started...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
