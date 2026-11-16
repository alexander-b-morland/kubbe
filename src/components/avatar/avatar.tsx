import "@/components/illustrations/room-art.css";
import { AVATARS, DEFAULT_AVATAR, isAvatar } from "./avatars";

/**
 * A person's face in the app: their drawn avatar on their own colour. Decorative,
 * since the person's name is always next to it.
 */
export function Avatar({ avatar, colour, className = "size-10" }: { avatar: string | null | undefined; colour: string; className?: string }) {
  const strokes = AVATARS[isAvatar(avatar) ? avatar : DEFAULT_AVATAR];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-paper ${className}`}
      style={{ backgroundColor: colour }}
    >
      <svg viewBox="0 0 120 120" className="room-art size-[68%]">
        {strokes.map((stroke, index) => (
          <path key={index} d={stroke.d} strokeWidth={stroke.w} />
        ))}
      </svg>
    </span>
  );
}
