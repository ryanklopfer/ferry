import type { ZodType } from "zod";
import type { ApiError } from "@/core/api/claims";

export const apiError = (status: number, code: ApiError["code"], message: string) => Response.json({ code, message } satisfies ApiError, { status });

// Parsing on the way out means a shape that drifts from the contract fails here, not in a client.
export const apiOk = <T>(schema: ZodType<T>, body: T) => Response.json(schema.parse(body));

export const denied = (status: 401 | 404) => (status === 401 ? apiError(401, "unauthorized", "Sign in first.") : apiError(404, "not_found", "Not found."));
