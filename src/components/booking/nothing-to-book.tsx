import Link from "next/link";

/** Shown when a household has switched a kind of resource off. */
export function NothingToBook({ what }: { what: string }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6 pt-10">
      <h1 className="type-display text-5xl">No {what} to book</h1>
      <p>This household has its {what} switched off. An admin can switch it on under Household.</p>
      <Link href="/settings" className="font-bold underline underline-offset-4">
        Open Household
      </Link>
    </main>
  );
}
