import { BRAND } from "../brand";
import { mailto } from "../site";

// D3 (Ryan, Oct 1): clients of a clinician who isn't a member get this invite-your-therapist link and nothing else.
// The share message leaves the client's phone for anyone they choose, so it carries no health or care words.
export const FOR_CLIENTS = {
  title: "Your clinician brings you aboard.",
  lead: "When they invite you, the link in their message opens everything here. There's nothing to set up before then.",
  inviteTitle: `Is your therapist not on ${BRAND.name} yet?`,
  inviteLead: "Send them a note. It opens on your phone, goes only to the person you pick, and we never see it.",
  share: "Invite your therapist",
  fine: `Clients never pay ${BRAND.name}. Your clinician's membership covers filing your claims.`,
} as const;

export const SHARE_MESSAGE = {
  subject: `Have you seen ${BRAND.name}?`,
  text: `Have you seen ${BRAND.name}? It writes up notes and handles insurance paperwork, and it's free for me to use with you. Could you take a look?`,
} as const;

// Without Web Share (most desktops) the same message opens in the mail app; the address is left for the client.
export const shareMailto = (url?: string) => mailto("", { subject: SHARE_MESSAGE.subject, body: url ? `${SHARE_MESSAGE.text} ${url}` : SHARE_MESSAGE.text });
