import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { KubbeLogo } from "@/components/logo/kubbe-logo";
import { getT } from "@/lib/i18n/server";

// The language is the reader's own choice, read from a cookie, so this screen is rendered per request.
export const instant = false;

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord";

export default async function FrontPage() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <LanguageSwitch className="self-end" />
      <KubbeLogo animate label="" className="mx-auto max-w-72" />
      <h1 className="type-display text-7xl">kubbe</h1>
      <p className="text-lg">
        {t("Take back your shower time, your slot with the washing machine, and make your roommates clean up the common areas. All with kubbe.")}
      </p>
      <div className="flex flex-col gap-3 pt-2">
        <Link
          href="/sign-up"
          className={`flex h-14 items-center justify-center rounded-full bg-ink text-lg font-bold text-paper ${focusRing}`}
        >
          {t("Create account")}
        </Link>
        <Link
          href="/sign-in"
          className={`flex h-14 items-center justify-center rounded-full border-2 border-ink text-lg font-bold ${focusRing}`}
        >
          {t("Sign in")}
        </Link>
      </div>
    </main>
  );
}
