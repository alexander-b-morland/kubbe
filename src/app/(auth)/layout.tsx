import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";
import { KubbeLogo } from "@/components/logo/kubbe-logo";
import { getT } from "@/lib/i18n/server";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-10">
      <div className="flex items-start justify-between gap-3">
        <Link href="/" aria-label={t("Kubbe, front page")} className="w-24 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-fjord">
          <KubbeLogo label="" />
        </Link>
        <LanguageSwitch />
      </div>
      {children}
    </main>
  );
}
