import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

export function PublicEventJoinButton({ eventId }: { eventId: string }) {
  return (
    <Link
      to={`/kalendarz/${eventId}`}
      className="inline-flex min-w-[9.5rem] items-center justify-center gap-2 rounded-full bg-brand-navy px-5 py-3 text-sm font-semibold text-white shadow-soft"
    >
      Biorę udział
      <ArrowRight size={16} />
    </Link>
  );
}
