import Link from "next/link";
import { KubbeLogo } from "@/components/logo/kubbe-logo";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-8 p-6 pt-10">
      <Link href="/" aria-label="Kubbe, front page" className="w-24 rounded-xl outline-none focus-visible:ring-4 focus-visible:ring-fjord">
        <KubbeLogo label="" />
      </Link>
      {children}
    </main>
  );
}
