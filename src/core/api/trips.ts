import { z } from "zod";

// Client-facing wire shapes (architecture §6 rule 6). Strict: no note, letter body, diagnosis or Tax ID field, ever.
export const ClientSelfSchema = z.strictObject({
  membershipId: z.string().startsWith("mbr_"),
  firstName: z.string(),
});
export type ClientSelf = z.infer<typeof ClientSelfSchema>;
