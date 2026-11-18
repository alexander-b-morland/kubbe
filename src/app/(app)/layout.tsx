import { AppNav } from "@/components/app-nav";

// Every signed-in screen: the content, with room for the navigation: at the bottom on a
// phone (with the home indicator, where there is one), down the left on a wide screen.
// The minimum height sits here, not on each screen, so a short screen does not scroll
// into empty space.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="min-h-dvh pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-10 lg:pl-56">{children}</div>
      <AppNav />
    </>
  );
}
