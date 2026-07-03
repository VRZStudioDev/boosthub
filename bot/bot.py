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
    "Eu sou o assistente de suporte do BoostHub.\n\n"
    "Comandos disponíveis:\n"
    "/status - Verifique o status da sua assinatura\n"
    "/ajuda - Exiba esta mensagem novamente\n\n"
    f"Acesse o Dashboard para gerenciar sua conta: {DASHBOARD_URL}"
)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    first_name = user.first_name if user else "motorista"
    await update.message.reply_text(f"🚀 Olá {first_name}! Bem-vindo ao BoostHub.\n\n{HELP_TEXT}")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(HELP_TEXT)


async def status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    profile = get_profile_by_chat_id(chat_id)

    if not profile:
        await update.message.reply_text(
            "❌ Você ainda não vinculou sua conta do Telegram ao BoostHub.\n\n"
            "Acesse o Dashboard em Configurações e cole o seu ID do Telegram.\n"
            f"Seu chat_id é: `{chat_id}`",
            parse_mode="Markdown",
        )
        return

    license_status = profile.get("license_status", "inactive")
    email = profile.get("email", "não informado")

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
            f"✅ Sua assinatura está *ATIVA*"
            + (f" até {end_str}." if end_str else ".")
            + f"\n\n📧 Email: {email}"
        )
    else:
        msg = (
            "❌ Sua assinatura está *INATIVA*.\n\n"
            f"📧 Email: {email}\n\n"
            "Renove sua assinatura acessando o Dashboard."
        )

    keyboard = [[InlineKeyboardButton("📊 Acessar Dashboard", url=DASHBOARD_URL)]]
    await update.message.reply_text(
        msg, reply_markup=InlineKeyboardMarkup(keyboard), parse_mode="Markdown"
    )


def main():
    application = Application.builder().token(TELEGRAM_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("status", status))
    application.add_handler(CommandHandler("ajuda", help_command))
    application.add_handler(CommandHandler("help", help_command))

    logger.info("Bot iniciado...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
