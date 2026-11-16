import { TabBar } from "@/components/tab-bar";

// Every signed-in screen: the content, with room at the bottom for the tab bar.
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <div className="pb-24">{children}</div>
      <TabBar />
    </>
  );
}
