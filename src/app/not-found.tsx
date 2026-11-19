import Link from "next/link";
import { KubbeLogo } from "@/components/logo/kubbe-logo";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6">
      <KubbeLogo label="" className="w-32" />
      <h1 className="type-display text-5xl">{t("Nothing lives at this address")}</h1>
      <p className="text-lg">{t("The link may be old, or mistyped.")}</p>
      <Link
        href="/home"
        className="flex h-14 items-center justify-center rounded-full bg-ink text-lg font-bold text-paper outline-none focus-visible:ring-4 focus-visible:ring-fjord"
      >
        {t("Go home")}
      </Link>
    </main>
  );
}
