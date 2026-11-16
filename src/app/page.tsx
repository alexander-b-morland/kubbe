import { KubbeLogo } from "@/components/logo/kubbe-logo";

// Placeholder until the real screens exist. It also shows the design tokens in use.
const rooms = [
  { name: "Shower", className: "bg-fjord text-paper" },
  { name: "Laundry", className: "bg-ochre text-ink" },
  { name: "Cleaning", className: "bg-spruce text-paper" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-6">
      <KubbeLogo animate label="" className="mx-auto max-w-72" />
      <h1 className="type-display text-7xl">kubbe</h1>
      <p className="text-lg">
        Shower, laundry and cleaning for people who share a home. Coming soon.
      </p>
      <ul className="flex flex-col gap-2">
        {rooms.map((room) => (
          <li
            key={room.name}
            className={`type-display rounded-xl px-4 py-3 text-3xl ${room.className}`}
          >
            {room.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
