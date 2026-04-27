import type {
  CommunityOrganizerProfileUpdateInput,
  OrganizerProfileUpdateInput,
} from "@/domain/types";

type SaveOrganizerProfilesInput = {
  officialProfile: OrganizerProfileUpdateInput;
  communityProfile: CommunityOrganizerProfileUpdateInput;
  updateOrganizerProfile: (input: OrganizerProfileUpdateInput) => Promise<void>;
  updateCommunityOrganizerProfile: (
    input: CommunityOrganizerProfileUpdateInput,
  ) => Promise<void>;
};

function normalizeOrganizerProfileInput<T extends OrganizerProfileUpdateInput>(input: T): T {
  const displayName = input.displayName.trim();
  const contactName = input.contactName.trim() || displayName;

  return {
    ...input,
    displayName,
    contactName,
    location: input.location.trim(),
    description: input.description.trim(),
  };
}

export async function saveOrganizerProfiles(input: SaveOrganizerProfilesInput) {
  await input.updateOrganizerProfile(normalizeOrganizerProfileInput(input.officialProfile));
  await input.updateCommunityOrganizerProfile(
    normalizeOrganizerProfileInput(input.communityProfile),
  );
}
