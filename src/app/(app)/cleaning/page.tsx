import type { Metadata } from "next";
import { AreaHeader } from "@/components/area/area-header";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { ActionButton } from "@/components/ui/action-button";
import { describeDue, describeInterval } from "@/lib/cleaning/rota";
import { ESTIMATES, getRota, INTERVALS, listAreas, tally } from "@/lib/cleaning/service";
import { listMembers } from "@/lib/households";
import { requireHousehold } from "@/lib/session";
import { dayInZone } from "@/lib/time";
import {
  addAreaAction,
  deleteAreaAction,
  giveBackAction,
  markDoneAction,
  redealTurnsAction,
  takeOverAction,
  undoDoneAction,
  updateAreaAction,
} from "./actions";
import { AddAreaForm, EditAreaForm } from "./area-forms";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Cleaning" };

const WEEKS_COUNTED = 8;

export default async function CleaningPage() {
  const { user, household, membership } = await requireHousehold();
  const now = new Date();
  const today = dayInZone(now, household.timeZone);
  const since = new Date(now.getTime() - WEEKS_COUNTED * 7 * 86_400_000);
  const [rota, areas, members, done] = await Promise.all([
    getRota(household.id, today),
    listAreas(household.id),
    listMembers(household.id),
    tally(household.id, since),
  ]);
  const admin = membership.role === "admin";

  const mine = rota.filter((row) => row.assignee?.userId === user.id && !row.done);
  const open = rota.filter((row) => !row.done);
  let headline = "No turns yet";
  if (rota.length > 0) {
    if (mine.length === 1) headline = `Your turn: ${mine[0].name}`;
    else if (mine.length > 1) headline = `${mine.length} turns are yours`;
    else if (open.length === 0) headline = "All clean";
    else headline = "Nothing for you now";
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-3xl lg:pt-6">
      {/* A phone can keep this screen open for days. Keep it showing the turn that is running. */}
      <AutoRefresh everySeconds={120} />
      <AreaHeader area="cleaning" eyebrow="Cleaning">
        {headline}
      </AreaHeader>

      <div className="flex flex-col gap-10 p-6">
        {rota.length === 0 ? (
          <p className="text-lg">
            {admin
              ? "Add what you share below: rooms to clean, and chores like emptying the dishwasher or taking out the trash. Turns then go round by themselves."
              : "No rooms or chores yet. Ask an admin to add the ones you share."}
          </p>
        ) : (
          <section aria-labelledby="now-heading" className="flex flex-col gap-2">
            <h2 id="now-heading" className="sr-only">
              Turns now
            </h2>
            <ul className="flex flex-col">
              {rota.map((row) => {
                const yours = row.assignee?.userId === user.id;
                // A turn marked done a moment ago gets its line drawn; older ones just have it.
                const fresh = row.done ? now.getTime() - row.done.at.getTime() < 20_000 : false;
                return (
                  <li
                    key={row.areaId}
                    data-testid={`turn-${row.name}`}
                    data-state={row.done ? "done" : yours ? "mine" : "theirs"}
                    className={`flex flex-col gap-2 border-b-2 border-ink/15 px-3 py-4 ${yours && !row.done ? "bg-spruce/15" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className={`type-display relative text-4xl ${row.done ? "text-ink-soft" : ""}`}>
                        {row.name}
                        {row.done ? (
                          <svg className={`strike ${fresh ? "strike--draw" : ""}`} viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
                            <path pathLength={1} d="M1 12C20 7 42 15 60 10C76 6 90 13 99 9" />
                          </svg>
                        ) : null}
                      </span>
                      {row.done ? (
                        row.done.by?.userId === user.id ? (
                          <ActionButton label={`Not done: ${row.name}`} action={undoDoneAction.bind(null, row.areaId, row.period)}>
                            Undo
                          </ActionButton>
                        ) : null
                      ) : yours ? (
                        <ActionButton look="filled" label={`Done: ${row.name}`} pendingLabel="Saving…" action={markDoneAction.bind(null, row.areaId, row.period)}>
                          Done
                        </ActionButton>
                      ) : (
                        <ActionButton label={`Take over ${row.name}`} action={takeOverAction.bind(null, row.areaId, row.period)}>
                          I&apos;ll take it
                        </ActionButton>
                      )}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      {row.done ? (
                        <span className="font-semibold">
                          Done by {row.done.by?.userId === user.id ? "you" : (row.done.by?.name ?? "someone who moved out")}
                        </span>
                      ) : (
                        <>
                          {row.assignee ? (
                            <span className="flex items-center gap-2 font-semibold">
                              <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: row.assignee.colour }} />
                              {yours ? "You" : row.assignee.name}
                            </span>
                          ) : null}
                          <span className="text-ink-soft">
                            {describeDue(today, row.lastDay)}, about {row.estimateMinutes} min
                          </span>
                        </>
                      )}
                    </p>
                    {!row.done && yours && row.takenOver ? (
                      <div className="flex justify-start">
                        <ActionButton align="start" label={`Give back ${row.name}`} action={giveBackAction.bind(null, row.areaId, row.period)}>
                          Give it back
                        </ActionButton>
                      </div>
                    ) : null}
                    {!row.done && row.lastWasSkipped ? <p className="text-sm font-semibold text-barn">Nobody marked this done last time.</p> : null}
                    <p className="text-sm text-ink-soft">
                      {describeInterval(row.intervalDays)}. Next: {row.next ? (row.next.userId === user.id ? "you" : row.next.name) : "nobody"}.
                    </p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {admin && rota.length > 0 && members.length > 1 ? (
          <section aria-labelledby="redeal-heading" className="flex flex-col gap-2" data-testid="redeal">
            <h2 id="redeal-heading" className="text-lg font-bold">
              Someone moved in or out?
            </h2>
            <p className="text-ink-soft">
              Turns already under way stay with whoever has them. You can share this round out again between
              everyone who lives here now.
            </p>
            <ActionButton
              align="start"
              confirm="Deal this round's turns out again?"
              doneLabel="Dealt out again."
              action={redealTurnsAction}
            >
              Deal turns out again
            </ActionButton>
          </section>
        ) : null}

        {rota.length > 0 && members.length > 1 ? (
          <section aria-labelledby="tally-heading" className="flex flex-col gap-2">
            <h2 id="tally-heading" className="type-display text-3xl">
              Turns done, last {WEEKS_COUNTED} weeks
            </h2>
            <ul className="flex flex-col">
              {members.map((member) => {
                const turns = done.get(member.userId) ?? 0;
                return (
                  <li key={member.userId} className="flex items-center gap-3 border-b-2 border-ink/15 py-2">
                    <span aria-hidden="true" className="size-3 rounded-full" style={{ backgroundColor: member.colour }} />
                    <span className="font-semibold">{member.userId === user.id ? "You" : member.name}</span>
                    <span className="ml-auto text-ink-soft">{turns === 1 ? "1 turn done" : `${turns} turns done`}</span>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {admin ? (
          <section aria-labelledby="rooms-heading" className="flex flex-col gap-4">
            <h2 id="rooms-heading" className="type-display text-3xl">
              Rooms and chores
            </h2>
            {areas.length > 0 ? (
              <div className="flex flex-col">
                {areas.map((area) => (
                  <EditAreaForm
                    key={area.id}
                    area={{ id: area.id, name: area.name, intervalDays: area.intervalDays, estimateMinutes: area.estimateMinutes }}
                    intervals={INTERVALS}
                    estimates={ESTIMATES}
                    action={updateAreaAction.bind(null, area.id)}
                    remove={deleteAreaAction.bind(null, area.id)}
                  />
                ))}
              </div>
            ) : null}
            <h3 className="pt-2 text-lg font-bold">Add a room or chore</h3>
            <AddAreaForm intervals={INTERVALS} estimates={ESTIMATES} existing={areas.map((area) => area.name)} today={today} action={addAreaAction} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
