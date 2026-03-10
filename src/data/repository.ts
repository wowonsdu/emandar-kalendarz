import type {
  AppUser,
  AvailabilityInput,
  EnrollmentFormInput,
  GroupInput,
} from "@/domain/types";
import { DemoRepository } from "./demoRepository";
import { isFirebaseConfigured } from "@/lib/firebase";

export interface AppRepository {
  getBootstrap: DemoRepository["getBootstrap"];
  resetDemo: DemoRepository["resetDemo"];
  signIn: DemoRepository["signIn"];
  signOut: DemoRepository["signOut"];
  submitEnrollment: (input: EnrollmentFormInput) => ReturnType<DemoRepository["submitEnrollment"]>;
  decideEnrollment: (
    requestId: string,
    actor: AppUser,
    decision: "accepted" | "rejected",
  ) => ReturnType<DemoRepository["decideEnrollment"]>;
  requestRelation: (
    organizerId: string,
    trainerId: string,
  ) => ReturnType<DemoRepository["requestRelation"]>;
  decideRelation: (
    relationId: string,
    actor: AppUser,
    status: "approved" | "rejected",
  ) => ReturnType<DemoRepository["decideRelation"]>;
  createGroup: (
    input: GroupInput,
    actor: AppUser,
  ) => ReturnType<DemoRepository["createGroup"]>;
  addAvailabilitySlot: (
    input: AvailabilityInput,
    actor: AppUser,
  ) => ReturnType<DemoRepository["addAvailabilitySlot"]>;
  getPublicEvents: DemoRepository["getPublicEvents"];
}

const demoRepository = new DemoRepository();

export const dataMode =
  (import.meta.env.VITE_DATA_MODE === "firebase" && isFirebaseConfigured
    ? "firebase"
    : "demo") as "firebase" | "demo";

export const appRepository: AppRepository = demoRepository;
