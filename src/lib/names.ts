/**
 * A list of people as a sentence starts: "You", "You and Ida", "You, Ida and Knut".
 * The person reading comes first and is called "You".
 */
export function listNames(userIds: readonly string[], me: string, nameOf: (userId: string) => string): string {
  const names = [...userIds].sort((a, b) => Number(b === me) - Number(a === me)).map((id) => (id === me ? "You" : nameOf(id)));
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
