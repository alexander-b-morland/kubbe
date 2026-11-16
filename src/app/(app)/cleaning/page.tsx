import type { Metadata } from "next";
import { RoomArt } from "@/components/illustrations/room-art";
import { requireHousehold } from "@/lib/session";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Cleaning" };

export default async function CleaningPage() {
  await requireHousehold();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="flex items-start justify-between bg-spruce p-6 pt-8 text-paper">
        <h1 className="type-display pt-10 text-6xl">Cleaning</h1>
        <RoomArt room="cleaning" animate className="size-24" />
      </header>
      <p className="p-6 text-lg">The cleaning rota is being built. It will show here.</p>
    </main>
  );
}
