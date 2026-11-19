import Link from "next/link";
import { getT } from "@/lib/i18n/server";

/** Shown when a household has switched a kind of resource off. */
export async function NothingToBook({ what }: { what: string }) {
  const t = await getT();
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6 pt-10">
      <h1 className="type-display text-5xl">{t`No ${what} to book`}</h1>
      <p>{t`This household has its ${what} switched off. An admin can switch it on under Household.`}</p>
      <Link href="/settings" className="font-bold underline underline-offset-4">
        {t("Open Household")}
      </Link>
    </main>
  );
}
