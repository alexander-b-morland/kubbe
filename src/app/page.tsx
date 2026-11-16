import Link from "next/link";
import { KubbeLogo } from "@/components/logo/kubbe-logo";

const focusRing = "outline-none focus-visible:ring-4 focus-visible:ring-fjord/35";

export default function FrontPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <KubbeLogo animate label="" className="mx-auto max-w-72" />
      <h1 className="type-display text-7xl">kubbe</h1>
      <p className="text-lg">
        Take back your shower time, your slot with the washing machine, and make your roommates
        clean up the common areas. All with kubbe.
      </p>
      <div className="flex flex-col gap-3 pt-2">
        <Link
          href="/sign-up"
          className={`flex h-14 items-center justify-center rounded-full bg-ink text-lg font-bold text-paper ${focusRing}`}
        >
          Create account
        </Link>
        <Link
          href="/sign-in"
          className={`flex h-14 items-center justify-center rounded-full border-2 border-ink text-lg font-bold ${focusRing}`}
        >
          Sign in
        </Link>
      </div>
    </main>
  );
}
