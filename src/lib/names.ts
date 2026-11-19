import { en, type Translate } from "@/lib/i18n";

/**
 * A list of people as a sentence starts: "You", "You and Ida", "You, Ida and Knut".
 * The person reading comes first and is called "You".
 */
export function listNames(userIds: readonly string[], me: string, nameOf: (userId: string) => string, t: Translate = en, inSentence = false): string {
  // After "from" the reader is "you", not "You"; in Norwegian a different word altogether.
  const names = [...userIds].sort((a, b) => Number(b === me) - Number(a === me)).map((id) => (id === me ? (inSentence ? t("you") : t("You")) : nameOf(id)));
  if (names.length <= 1) return names[0] ?? "";
  return t`${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
