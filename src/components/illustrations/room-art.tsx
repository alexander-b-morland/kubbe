import type { CSSProperties } from "react";
import "./room-art.css";

export type Room = "shower" | "laundry" | "cleaning";

// Hand-drawn strokes in a 120 x 120 space, in the order a pen would make them.
const strokes: Record<Room, { d: string; w: number }[]> = {
  shower: [
    { d: "M10 14C9 22 9 32 10 42", w: 5 },
    { d: "M10 28C34 26 58 24 72 30C81 34 84 42 84 50", w: 5 },
    { d: "M84 50C70 51 60 58 57 70C74 73 94 73 111 70C108 58 98 51 84 50Z", w: 5 },
    { d: "M62 79C61 83 60 87 59 91M57 98C56 102 55 106 54 110", w: 4 },
    { d: "M73 80C72.500 85 72 90 71.500 95M71 102C70.700 106 70.400 110 70 114", w: 4 },
    { d: "M84 80L84 93M84 100L84 113", w: 4 },
    { d: "M95 80C95.500 85 96 90 96.500 95M97 102C97.300 106 97.600 110 98 114", w: 4 },
    { d: "M106 79C107 83 108 87 109 91M111 98C112 102 113 106 114 110", w: 4 },
  ],
  laundry: [
    { d: "M24 16C48 14 74 14 98 16C100 44 100 76 98 102C74 104 48 104 24 102C22 76 22 44 24 16Z", w: 5 },
    { d: "M24 34C48 33 74 33 98 34", w: 4 },
    { d: "M40 25a4 4 0 1 1-8 0a4 4 0 1 1 8 0", w: 3.5 },
    { d: "M52 25L68 25", w: 4 },
    { d: "M80 25h.01M89 25h.01", w: 5 },
    { d: "M61 45C75 44 86 55 85 69C85 83 74 93 61 92C47 93 37 82 37 69C36 55 47 45 62 45", w: 5 },
    { d: "M61 53C70 52 78 60 77 69C77 78 70 85 61 84C52 85 45 78 45 69C44 60 51 53 61 53", w: 3.5 },
    { d: "M47 72C51 66 56 77 61 71C66 65 71 77 75 71", w: 3.5 },
    { d: "M32 103L32 109M90 103L90 109", w: 5 },
  ],
  cleaning: [
    { d: "M98 10C82 32 66 54 55 69", w: 5 },
    { d: "M40 58C48 62 58 70 64 80", w: 6 },
    { d: "M40 58C30 68 20 82 13 97C26 103 40 109 52 112C58 101 62 90 64 80", w: 5 },
    { d: "M46 64L25 100M52 70L36 106M58 76L46 109", w: 3.5 },
    { d: "M86 86L86 102M78 94L94 94", w: 4 },
    { d: "M104 70L104 80M99 75L109 75", w: 3.5 },
    { d: "M72 110C82 106 94 108 106 104", w: 3.5 },
  ],
};

type Props = {
  room: Room;
  /** Draw the strokes one after another. */
  animate?: boolean;
  /** Seconds to wait before the first stroke, to stagger several drawings. */
  delay?: number;
  className?: string;
};

/**
 * The line drawing for a room. Decorative: the room name is always next to it.
 * Lines take the current text colour, so it works on any room colour.
 */
export function RoomArt({ room, animate = false, delay = 0, className }: Props) {
  return (
    <svg
      viewBox="0 0 120 120"
      aria-hidden="true"
      className={["room-art", animate ? "room-art--draw" : "", className ?? ""].filter(Boolean).join(" ")}
    >
      {strokes[room].map((stroke, index) => (
        <path
          key={index}
          d={stroke.d}
          strokeWidth={stroke.w}
          pathLength={1}
          style={{ "--t": `${(delay + index * 0.16).toFixed(2)}s` } as CSSProperties}
        />
      ))}
    </svg>
  );
}
