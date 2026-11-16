import { TabBar } from "@/components/tab-bar";

// Every signed-in screen: the content, with room at the bottom for the tab bar and,
// on phones that have one, the home indicator. The minimum height sits here, not on
// each screen, so a short screen does not scroll into empty space.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</div>
      <TabBar />
    </>
  );
}
