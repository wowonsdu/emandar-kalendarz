type AppErrorWithCode = Error & { code: string };

function isCodedAppError(error: unknown): error is AppErrorWithCode {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

function normalizeAppErrorCode(code: string) {
  return code.startsWith("backend/") ? code.slice("backend/".length) : code;
}

export function mapAppError(error: unknown) {
  if (!isCodedAppError(error)) {
    if (error instanceof Error) {
      return error;
    }

    return new Error("Nie udalo sie wykonac tej operacji.");
  }

  switch (normalizeAppErrorCode(error.code)) {
    case "auth/operation-not-allowed":
      return new Error(
        "Na tym prototypie ten sposob logowania nie jest dostepny.",
      );
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return new Error("Nieprawidlowy login albo haslo.");
    case "auth/user-disabled":
      return new Error("To konto zostalo wylaczone.");
    case "permission-denied":
      return new Error("Nie masz uprawnien do wykonania tej operacji.");
    case "unauthenticated":
      return new Error("Zaloguj sie ponownie i sprobuj jeszcze raz.");
    case "not-found":
      return new Error("Nie znaleziono potrzebnych danych.");
    case "already-exists":
      return new Error("Ten rekord juz istnieje.");
    case "failed-precondition":
      return new Error("Ta operacja nie moze zostac wykonana w obecnym stanie danych.");
    case "invalid-argument":
      return new Error("Przekazane dane sa nieprawidlowe.");
    case "resource-exhausted":
      return new Error("Limit zasobow zostal chwilowo przekroczony. Sprobuj ponownie za chwile.");
    case "cancelled":
      return new Error("Operacja zostala przerwana.");
    case "deadline-exceeded":
      return new Error("Operacja przekroczyla limit czasu. Sprobuj ponownie za chwile.");
    case "internal":
      return new Error("Nie udalo sie zsynchronizowac feedow iCal. Sprobuj ponownie za chwile.");
    case "unavailable":
      return new Error("Usluga jest chwilowo niedostepna. Sprobuj ponownie za chwile.");
    case "file/unauthorized":
      return new Error("Nie masz uprawnien do tego pliku.");
    case "file/canceled":
      return new Error("Wysylanie pliku zostalo przerwane.");
    case "file/object-not-found":
      return new Error("Nie znaleziono pliku.");
    case "file/retry-limit-exceeded":
      return new Error("Nie udalo sie przeslac pliku. Sprobuj ponownie.");
    default:
      return new Error(error.message || "Nie udalo sie wykonac tej operacji.");
  }
}
