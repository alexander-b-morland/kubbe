/** Tick boxes for who shares a cost. Everyone is ticked to begin with. */
export function SplitFields({ people, legend = "Split between" }: { people: { userId: string; name: string }[]; legend?: string }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="pb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {people.map((person) => (
          <label key={person.userId} className="flex items-center gap-2 text-lg font-semibold">
            <input type="checkbox" name="sharedBy" value={person.userId} defaultChecked className="size-6 accent-ink" />
            {person.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
