import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PageLayout } from '../components/layout/PageLayout';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { useBilling } from '../hooks/useBilling';
import { useToast } from '../components/feedback/ToastProvider';
import { supabase } from '../lib/supabaseClient';

function SubscriptionSection() {
  const { data: profile } = useProfile();
  const { openCustomerPortal, startCheckout, loadingPortal, loadingCheckout } = useBilling();
  const isActive = profile?.license_status === 'active';

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white">Subscription</h2>
      <p className="mt-1 text-sm text-slate-400">
        {isActive
          ? 'Manage your plan, payment method, and invoices in the Stripe portal.'
          : 'Subscribe to unlock voice shortcuts and earnings tracking.'}
      </p>
      {isActive ? (
        <Button variant="secondary" className="mt-4" loading={loadingPortal} onClick={openCustomerPortal}>
          Manage Subscription
        </Button>
      ) : (
        <Button className="mt-4" loading={loadingCheckout} onClick={startCheckout}>
          Subscribe Now
        </Button>
      )}
    </div>
  );
}

function EmailSection() {
  const { user } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() });
      if (error) throw error;
      toast.success('Confirmation sent. Check both inboxes to finish the change.');
      setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update email. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white">Email address</h2>
      <p className="mt-1 text-sm text-slate-400">
        Current: <span className="text-slate-200">{user?.email}</span>
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <Input
          label="New email"
          type="email"
          name="new-email"
          placeholder="new@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" loading={loading} className="sm:mb-0.5">
          Update
        </Button>
      </form>
    </div>
  );
}

function TelegramLinkSection() {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);

  const linked = profile?.telegram_chat_id ?? null;

  async function save(value: string | null) {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ telegram_chat_id: value })
        .eq('id', user.id);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
      toast.success(value ? 'Telegram linked.' : 'Telegram unlinked.');
      setChatId('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = chatId.trim();
    if (!/^-?\d+$/.test(trimmed)) {
      toast.error('Enter a valid numeric chat ID (from the bot).');
      return;
    }
    await save(trimmed);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-white">Link Telegram</h2>
      <p className="mt-1 text-sm text-slate-400">
        Connect Telegram to check your subscription status with the support bot.
      </p>

      <ol className="mt-4 space-y-1.5 text-sm text-slate-400">
        <li>1. Open the BoostHub bot on Telegram and send <code className="text-accent-cyan">/start</code>.</li>
        <li>2. Send <code className="text-accent-cyan">/status</code> — the bot replies with your chat ID.</li>
        <li>3. Paste that ID below and save.</li>
      </ol>

      {linked ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-300">
            Linked chat ID: <span className="font-mono text-accent-green">{linked}</span>
          </p>
          <Button variant="danger" size="sm" loading={loading} onClick={() => save(null)}>
            Unlink
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Telegram chat ID"
            name="telegram-chat-id"
            inputMode="numeric"
            placeholder="123456789"
            value={chatId}
            onChange={(e) => setChatId(e.target.value)}
            required
          />
          <Button type="submit" loading={loading} className="sm:mb-0.5">
            Save
          </Button>
        </form>
      )}
    </div>
  );
}

function DangerZone() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} });
      if (error) throw error;
      await signOut();
      toast.success('Your account has been deleted.');
      navigate('/');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete account. Try again.');
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }

  return (
    <div className="card border-red-500/20">
      <h2 className="text-lg font-semibold text-white">Delete account</h2>
      <p className="mt-1 text-sm text-slate-400">
        Permanently delete your account and all associated data. This action cannot be undone.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>
        Delete Account
      </Button>

      <ConfirmModal
        open={open}
        title="Delete your account?"
        confirmLabel="Yes, delete everything"
        confirmVariant="danger"
        loading={loading}
        onConfirm={handleDelete}
        onClose={() => setOpen(false)}
      >
        This will cancel your subscription and permanently remove your profile, shortcuts, and
        activity logs. There is no way to recover it.
      </ConfirmModal>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <PageLayout>
      <div className="container-page py-10">
        <h1 className="mb-8 text-2xl font-bold text-white sm:text-3xl">Settings</h1>
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <SubscriptionSection />
          <EmailSection />
          <TelegramLinkSection />
          <DangerZone />
        </div>
      </div>
    </PageLayout>
  );
}
