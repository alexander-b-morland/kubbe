import { AppNav } from "@/components/app-nav";
import { areasFor } from "@/lib/areas";
import { requireHousehold } from "@/lib/session";
import { getT } from "@/lib/i18n/server";

// Every signed-in screen: the navigation, then the content with room for it: at the
// bottom on a phone (with the home indicator, where there is one), down the left on a
// wide screen. The navigation comes first in the page, so the keyboard reaches it
// first, and a link ahead of it jumps straight to the content. The minimum height sits
// here, not on each screen, so a short screen does not scroll into empty space.
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const t = await getT();
  // The side column lists the areas this household uses.
  const { household } = await requireHousehold();
  const areas = areasFor(household).map(({ key, name, href, art, band }) => ({ key, name, href, art, band }));
  return (
    <>
      <a
        href="#content"
        className="sr-only z-20 rounded-full bg-ink px-4 py-2 font-bold text-paper focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t("Skip to the content")}
      </a>
      <AppNav areas={areas} />
      <div id="content" className="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-56">
        {children}
      </div>
    </>
  );
}
