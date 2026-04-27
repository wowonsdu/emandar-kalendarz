import { useEffect, useState } from "react";
import { CheckCircle2, LoaderCircle, XCircle } from "lucide-react";
import { Link, useParams } from "react-router";
import { useAppState } from "../providers/AppProviders";

type ConfirmationState = "loading" | "success" | "error";

export function AttendanceConfirmationPage() {
  const { token, decision } = useParams();
  const { confirmEnrollmentAttendance } = useAppState();
  const [state, setState] = useState<ConfirmationState>("loading");
  const [message, setMessage] = useState("Sprawdzamy link potwierdzenia.");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!token || (decision !== "confirm" && decision !== "decline")) {
        if (!cancelled) {
          setState("error");
          setMessage("Ten link potwierdzenia jest nieprawidłowy.");
        }
        return;
      }

      try {
        await confirmEnrollmentAttendance(token, decision);

        if (!cancelled) {
          setState("success");
          setMessage(
            decision === "confirm"
              ? "Udział w szkoleniu został potwierdzony."
              : "Odmowa udziału została zapisana.",
          );
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(
            error instanceof Error
              ? error.message
              : "Nie udało się zapisać odpowiedzi z linku potwierdzenia.",
          );
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [confirmEnrollmentAttendance, decision, token]);

  return (
    <section className="mx-auto flex min-h-[70vh] max-w-3xl items-center px-4 py-16 sm:px-6 lg:px-8">
      <article className="w-full rounded-[2rem] border border-brand-line bg-white p-8 shadow-soft">
        <div className="flex flex-col items-center text-center">
          {state === "loading" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-shell text-brand-navy">
              <LoaderCircle className="animate-spin" size={28} />
            </div>
          )}
          {state === "success" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <CheckCircle2 size={28} />
            </div>
          )}
          {state === "error" && (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-700">
              <XCircle size={28} />
            </div>
          )}

          <h1 className="mt-6 text-3xl font-semibold text-brand-navy">
            Potwierdzenie udziału
          </h1>
          <p className="mt-4 max-w-xl text-brand-muted">{message}</p>

          <Link
            to="/kalendarz"
            className="mt-8 inline-flex items-center rounded-full border border-brand-line bg-brand-shell px-5 py-3 text-sm font-semibold text-brand-navy"
          >
            Wróć do kalendarza
          </Link>
        </div>
      </article>
    </section>
  );
}
