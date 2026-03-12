import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Bell, Info, Link2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { useAppState } from "../providers/AppProviders";
import {
  NOTIFICATION_TEMPLATE_PLACEHOLDERS,
  normalizeNotificationSettings,
} from "@/domain/notifications";
import type { NotificationSettingsUpdateInput } from "@/domain/types";

type NotificationSettingsFormState = NotificationSettingsUpdateInput;

function NotificationSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-sky-deep">
          {eyebrow}
        </p>
        <h2 className="mt-3 text-4xl font-semibold text-brand-navy">{title}</h2>
        <p className="mt-3 max-w-3xl text-lg text-brand-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyNotificationState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-[2rem] border border-dashed border-brand-line bg-white p-8 text-center shadow-soft">
      <h3 className="text-2xl font-semibold text-brand-navy">{title}</h3>
      <p className="mt-3 text-brand-muted">{description}</p>
    </article>
  );
}

function NotificationSettingsForm({
  roleLabel,
  value,
  onSubmit,
  summary,
}: {
  roleLabel: string;
  value: NotificationSettingsUpdateInput;
  onSubmit: (input: NotificationSettingsUpdateInput) => Promise<void>;
  summary: string;
}) {
  const [form, setForm] = useState<NotificationSettingsFormState>(value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(value);
  }, [value]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!form.reminderSmsTemplate.trim()) {
      toast.error("Uzupełnij wzór SMS przypomnienia.");
      return;
    }

    if (!form.confirmationSmsTemplate.trim()) {
      toast.error("Uzupełnij wzór SMS potwierdzenia.");
      return;
    }

    if (
      form.requireParticipantSmsConfirmation &&
      (!form.confirmationSmsTemplate.includes("{{confirm_url}}") ||
        !form.confirmationSmsTemplate.includes("{{decline_url}}"))
    ) {
      toast.error("Szablon potwierdzenia musi zawierać link TAK i NIE.");
      return;
    }

    setSaving(true);

    try {
      await onSubmit({
        ...form,
        sendToParticipants:
          form.requireParticipantSmsConfirmation || form.sendToParticipants,
      });
      toast.success("Ustawienia powiadomień zostały zapisane.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Nie udało się zapisać ustawień powiadomień.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 rounded-[2rem] border border-brand-line bg-white p-6 shadow-soft"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-brand-line bg-brand-shell p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              {roleLabel}
            </p>
            <h3 className="mt-2 text-2xl font-semibold text-brand-navy">
              Globalna konfiguracja SMS
            </h3>
            <p className="mt-3 text-sm text-brand-muted">{summary}</p>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-semibold text-brand-navy">
              Powiadaj przed wydarzeniem
            </span>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={30}
                value={form.reminderLeadDays}
                onChange={(changeEvent) =>
                  setForm((previous) => ({
                    ...previous,
                    reminderLeadDays: Number(changeEvent.target.value) || 1,
                  }))
                }
                className="w-28 rounded-2xl border border-brand-line bg-brand-shell px-4 py-3 text-brand-navy outline-none"
              />
              <span className="text-sm text-brand-muted">dni wcześniej</span>
            </div>
          </label>

          <div className="grid gap-3 rounded-[1.75rem] border border-brand-line bg-brand-shell p-5">
            <span className="text-sm font-semibold text-brand-navy">
              Odbiorcy przypomnień o szkoleniach
            </span>

            <label className="flex items-start gap-3 text-sm text-brand-muted">
              <input
                type="checkbox"
                checked={form.sendToTrainer}
                onChange={(changeEvent) =>
                  setForm((previous) => ({
                    ...previous,
                    sendToTrainer: changeEvent.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>Przekazujący Wiedzę / trener</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-brand-muted">
              <input
                type="checkbox"
                checked={form.sendToOrganizer}
                onChange={(changeEvent) =>
                  setForm((previous) => ({
                    ...previous,
                    sendToOrganizer: changeEvent.target.checked,
                  }))
                }
                className="mt-1"
              />
              <span>Organizator</span>
            </label>

            <label className="flex items-start gap-3 text-sm text-brand-muted">
              <input
                type="checkbox"
                checked={form.requireParticipantSmsConfirmation || form.sendToParticipants}
                onChange={(changeEvent) =>
                  setForm((previous) => ({
                    ...previous,
                    sendToParticipants: changeEvent.target.checked,
                  }))
                }
                disabled={form.requireParticipantSmsConfirmation}
                className="mt-1"
              />
              <span>Uczestnicy</span>
            </label>
          </div>

          <label className="flex items-start gap-3 rounded-[1.75rem] border border-brand-line bg-brand-shell p-5 text-sm text-brand-muted">
            <input
              type="checkbox"
              checked={form.requireParticipantSmsConfirmation}
              onChange={(changeEvent) =>
                setForm((previous) => ({
                  ...previous,
                  requireParticipantSmsConfirmation: changeEvent.target.checked,
                  sendToParticipants:
                    changeEvent.target.checked || previous.sendToParticipants,
                }))
              }
              className="mt-1"
            />
            <span>
              Wymagaj od uczestników potwierdzenia SMS z linkami TAK/NIE. Gdy ta opcja
              jest aktywna, uczestnicy zawsze są odbiorcami wiadomości.
            </span>
          </label>
        </div>

        <div className="grid gap-4">
          <div className="rounded-[1.75rem] border border-brand-line bg-brand-shell p-5">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-brand-sky-deep">
              <Info size={16} />
              Placeholdery
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {NOTIFICATION_TEMPLATE_PLACEHOLDERS.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-brand-line bg-white px-3 py-1 text-xs font-semibold text-brand-navy"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <label className="grid gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <Bell size={16} />
              Wzór SMS przypomnienia
            </span>
            <textarea
              rows={6}
              value={form.reminderSmsTemplate}
              onChange={(changeEvent) =>
                setForm((previous) => ({
                  ...previous,
                  reminderSmsTemplate: changeEvent.target.value,
                }))
              }
              className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>

          <label className="grid gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-navy">
              <Link2 size={16} />
              Wzór SMS potwierdzenia udziału
            </span>
            <textarea
              rows={7}
              value={form.confirmationSmsTemplate}
              onChange={(changeEvent) =>
                setForm((previous) => ({
                  ...previous,
                  confirmationSmsTemplate: changeEvent.target.value,
                }))
              }
              className="rounded-3xl border border-brand-line bg-brand-shell px-4 py-3.5 text-brand-navy outline-none"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.75rem] border border-dashed border-brand-line bg-brand-shell px-5 py-4">
        <p className="text-sm text-brand-muted">
          Dla oficjalnych szkoleń trenera z organizatorem pierwszeństwo mają ustawienia
          organizatora. Dla wydarzeń społecznościowych i self-managed obowiązują ustawienia
          trenera.
        </p>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-navy px-6 py-3.5 text-sm font-semibold text-white shadow-soft disabled:opacity-60"
        >
          <MessageSquareText size={16} />
          {saving ? "Zapisywanie..." : "Zapisz ustawienia"}
        </button>
      </div>
    </form>
  );
}

export function NotificationsSettingsPage() {
  const {
    currentUser,
    store,
    updateOrganizerNotificationSettings,
    updateTrainerNotificationSettings,
  } = useAppState();
  const trainerProfile = store.trainers.find((item) => item.userId === currentUser?.id);
  const organizerProfile = store.organizers.find((item) => item.userId === currentUser?.id);
  const trainerSettings = useMemo(
    () => normalizeNotificationSettings(trainerProfile?.notificationSettings),
    [trainerProfile?.notificationSettings],
  );
  const organizerSettings = useMemo(
    () => normalizeNotificationSettings(organizerProfile?.notificationSettings),
    [organizerProfile?.notificationSettings],
  );

  if (!currentUser) {
    return null;
  }

  if (currentUser.role === "admin") {
    return (
      <NotificationSection
        eyebrow="Powiadomienia"
        title="Konfiguracja SMS API"
        description="To miejsce zostawiamy puste pod późniejsze podpięcie dostawcy SMS i konfigurację techniczną wysyłek."
      >
        <EmptyNotificationState
          title="Sekcja techniczna zostanie dodana później"
          description="W tej wersji trenerzy i organizatorzy zarządzają tylko własnymi globalnymi wzorami powiadomień dla szkoleń."
        />
      </NotificationSection>
    );
  }

  if (currentUser.role === "trainer") {
    if (!trainerProfile) {
      return (
        <NotificationSection
          eyebrow="Powiadomienia"
          title="Globalne ustawienia powiadomień"
          description="Najpierw potrzebny jest aktywny profil trenera."
        >
          <EmptyNotificationState
            title="Brak profilu trenera"
            description="Po utworzeniu lub przypisaniu profilu pojawi się tutaj konfiguracja SMS dla Twoich szkoleń."
          />
        </NotificationSection>
      );
    }

    return (
      <NotificationSection
        eyebrow="Powiadomienia"
        title="Globalne ustawienia powiadomień"
        description="Tutaj ustawisz domyślne reguły SMS dla szkoleń, które prowadzisz lub prowadzisz samodzielnie."
      >
        <NotificationSettingsForm
          roleLabel="Profil trenera"
          value={trainerSettings}
          summary="To są ustawienia globalne dla wszystkich Twoich szkoleń. Przy szkoleniu współdzielonym z organizatorem priorytet ma konfiguracja organizatora."
          onSubmit={updateTrainerNotificationSettings}
        />
      </NotificationSection>
    );
  }

  if (!organizerProfile) {
    return (
      <NotificationSection
        eyebrow="Powiadomienia"
        title="Globalne ustawienia powiadomień"
        description="Najpierw potrzebny jest aktywny profil organizatora."
      >
        <EmptyNotificationState
          title="Brak profilu organizatora"
          description="Po utworzeniu lub przypisaniu profilu pojawi się tutaj konfiguracja SMS dla Twoich szkoleń."
        />
      </NotificationSection>
    );
  }

  return (
    <NotificationSection
      eyebrow="Powiadomienia"
      title="Globalne ustawienia powiadomień"
      description="Tutaj ustawisz domyślne reguły SMS i wzory wiadomości dla organizowanych przez Ciebie szkoleń."
    >
      <NotificationSettingsForm
        roleLabel="Profil organizatora"
        value={organizerSettings}
        summary="Twoje ustawienia sterują oficjalnymi szkoleniami współdzielonymi z trenerem. To tutaj ustawiasz wzory przypomnień i SMS potwierdzających udział."
        onSubmit={updateOrganizerNotificationSettings}
      />
    </NotificationSection>
  );
}
