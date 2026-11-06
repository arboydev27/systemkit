import { designChallenge, type DesignChallengeContent } from "../design-challenge";
import { activityFeedChallenge } from "./activity-feed";
import { addressAutocompleteChallenge } from "./address-autocomplete";
import { apiQuotaChallenge } from "./api-quota";
import { flightAlertsChallenge } from "./flight-alerts";
import { invoicingSaasChallenge } from "./invoicing-saas";
import { notesSyncChallenge } from "./notes-sync";
import { pastebinChallenge } from "./pastebin";
import { podcastPlatformChallenge } from "./podcast-platform";
import { priceMonitorChallenge } from "./price-monitor";
import { seatBookingChallenge } from "./seat-booking";
import { sessionStoreChallenge } from "./session-store";
import { supportInboxChallenge } from "./support-inbox";

export const designChallenges: DesignChallengeContent[] = [designChallenge, activityFeedChallenge, addressAutocompleteChallenge, apiQuotaChallenge, flightAlertsChallenge, invoicingSaasChallenge, notesSyncChallenge, pastebinChallenge, podcastPlatformChallenge, priceMonitorChallenge, seatBookingChallenge, sessionStoreChallenge, supportInboxChallenge];

export function challengeForLesson(chapterId: string, stepId: string) {
  return designChallenges.find((challenge) => challenge.chapterId === chapterId && challenge.stepId === stepId);
}

export function findChallenge(id: string) {
  return designChallenges.find((challenge) => challenge.id === id);
}
