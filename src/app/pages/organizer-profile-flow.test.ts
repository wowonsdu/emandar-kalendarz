import { describe, expect, it, vi } from "vitest";
import { saveOrganizerProfiles } from "./organizer-profile-flow";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
}

describe("saveOrganizerProfiles", () => {
  it("saves organizer variants sequentially to avoid store version conflicts", async () => {
    const officialSave = createDeferred();
    const updateOrganizerProfile = vi.fn(() => officialSave.promise);
    const updateCommunityOrganizerProfile = vi.fn(async () => undefined);

    const savePromise = saveOrganizerProfiles({
      officialProfile: {
        displayName: " Emandar ",
        contactName: "",
        location: " Warszawa ",
        description: " Oficjalny opis ",
      },
      communityProfile: {
        displayName: " Społeczność ",
        contactName: "",
        location: " Online ",
        description: " Społecznościowy opis ",
      },
      updateOrganizerProfile,
      updateCommunityOrganizerProfile,
    });

    expect(updateOrganizerProfile).toHaveBeenCalledWith({
      displayName: "Emandar",
      contactName: "Emandar",
      location: "Warszawa",
      description: "Oficjalny opis",
    });
    expect(updateCommunityOrganizerProfile).not.toHaveBeenCalled();

    officialSave.resolve();
    await savePromise;

    expect(updateCommunityOrganizerProfile).toHaveBeenCalledWith({
      displayName: "Społeczność",
      contactName: "Społeczność",
      location: "Online",
      description: "Społecznościowy opis",
    });
  });
});
