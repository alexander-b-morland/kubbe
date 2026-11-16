/** What a server action hands back to its form when something needs fixing. */
export type FormState = { error?: string; values?: Record<string, string> } | undefined;
