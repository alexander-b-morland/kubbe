import type { Metadata } from "next";
import { AreaPage } from "@/components/area/area-header";
import { Person, type PersonLike } from "@/components/avatar/person";
import { AutoRefresh } from "@/components/booking/auto-refresh";
import { ActionButton } from "@/components/ui/action-button";
import { isFresh, Struck } from "@/components/ui/strike";
import { describeDue, describeInterval } from "@/lib/cleaning/rota";
import { ESTIMATES, getRota, INTERVALS, listAreas, tally } from "@/lib/cleaning/service";
import { listMembers } from "@/lib/households";
import { requireHousehold } from "@/lib/session";
import { dayInZone, daysBetween, shortDate } from "@/lib/time";
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
import type { Translate } from "@/lib/i18n";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Cleaning" };

const WEEKS_COUNTED = 8;

/** "tomorrow", or "Mon 23 Nov": the day a rota's first turn begins. */
const startLabel = (today: string, day: string, t: Translate) => (daysBetween(today, day) === 1 ? t("tomorrow") : shortDate(day, t));

export default async function CleaningPage() {
  const t = await getT();
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
  const people = new Map<string, PersonLike>(members.map((member) => [member.userId, member]));

  // A turn that has not started yet is nobody's to do.
  const running = rota.filter((row) => !row.startsOn);
  const mine = running.filter((row) => row.assignee?.userId === user.id && !row.done);
  const open = running.filter((row) => !row.done);
  let headline = t("No turns yet");
  if (rota.length > 0) {
    if (mine.length === 1) headline = t`Your turn: ${mine[0].name}`;
    else if (mine.length > 1) headline = t`${mine.length} turns are yours`;
    else if (running.length === 0) headline = t("Nothing has started yet");
    else if (open.length === 0) headline = t("All clean");
    else headline = t("Nothing for you now");
  }

  const tallySection =
    rota.length > 0 && members.length > 1 ? (
      <section aria-labelledby="tally-heading" className="flex flex-col gap-2" data-testid="tally">
        <h2 id="tally-heading" className="type-display text-3xl">
          {t`Done, last ${WEEKS_COUNTED} weeks`}
        </h2>
        <ul className="flex flex-col">
          {members.map((member) => {
            const count = done.get(member.userId) ?? { turns: 0, minutes: 0 };
            return (
              <li key={member.userId} className="flex items-center justify-between gap-3 border-b-2 border-ink/15 py-2">
                <Person person={member} me={user.id} className="font-semibold" />
                <span className="text-right text-ink-soft">
                  {count.turns === 0 ? t("Nothing yet") : count.turns === 1 ? t`1 turn, about ${count.minutes} min` : t`${count.turns} turns, about ${count.minutes} min`}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null;

  const redealSection =
    admin && rota.length > 0 && members.length > 1 ? (
      <section aria-labelledby="redeal-heading" className="flex flex-col gap-2" data-testid="redeal">
        <h2 id="redeal-heading" className="text-lg font-bold">
          {t("Someone moved in or out?")}
        </h2>
        <p className="text-ink-soft">
          {t("Turns already under way stay with whoever has them. You can share this round out again between everyone who lives here now. Turns somebody took over go back too.")}
        </p>
        <ActionButton align="start" confirm={t("Deal this round's turns out again?")} doneLabel={t("Dealt out again.")} action={redealTurnsAction}>
          {t("Deal turns out again")}
        </ActionButton>
      </section>
    ) : null;

  const manageSection = admin ? (
    <section aria-labelledby="rooms-heading" className="flex flex-col gap-4" data-testid="rooms">
      <h2 id="rooms-heading" className="type-display text-3xl">
        {t("Rooms and chores")}
      </h2>
      {areas.length > 0 ? (
        <div className="flex flex-col">
          {areas.map((area) => (
            <EditAreaForm
              key={area.id}
              area={{ id: area.id, name: area.name, intervalDays: area.intervalDays, estimateMinutes: area.estimateMinutes, startDay: area.startDay }}
              intervals={INTERVALS}
              estimates={ESTIMATES}
              action={updateAreaAction.bind(null, area.id)}
              remove={deleteAreaAction.bind(null, area.id)}
            />
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 rounded-3xl bg-spruce/15 p-5">
        <h3 className="text-lg font-bold">{t("Add a room or chore")}</h3>
        <AddAreaForm intervals={INTERVALS} estimates={ESTIMATES} existing={areas.map((area) => area.name)} today={today} action={addAreaAction} />
      </div>
    </section>
  ) : null;

  return (
    <AreaPage
      area="cleaning"
      eyebrow={t("Cleaning")}
      title={headline}
      aside={
        tallySection || redealSection || manageSection ? (
          <>
            {tallySection}
            {redealSection}
            {manageSection}
          </>
        ) : undefined
      }
    >
      {/* A phone can keep this screen open for days. Keep it showing the turn that is running. */}
      <AutoRefresh everySeconds={120} />
      {rota.length === 0 ? (
        <p className="text-lg">
          {admin
            ? t("Add what you share: rooms to clean, and chores like emptying the dishwasher or taking out the trash. Turns then go round by themselves.")
            : t("No rooms or chores yet. Ask an admin to add the ones you share.")}
        </p>
      ) : (
        <section aria-labelledby="now-heading" className="flex flex-col gap-2">
          <h2 id="now-heading" className="sr-only">
            {t("Turns now")}
          </h2>
          <ul className="flex flex-col">
            {rota.map((row) => {
              const yours = row.assignee?.userId === user.id;
              const who = row.assignee ? people.get(row.assignee.userId) : undefined;

              if (row.startsOn) {
                return (
                  <li
                    key={row.areaId}
                    data-testid={`turn-${row.name}`}
                    data-state="waiting"
                    className="flex flex-col gap-2 border-b-2 border-ink/15 px-3 py-4"
                  >
                    <span className="type-display text-4xl break-words text-ink-soft">{row.name}</span>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="font-semibold">{t`Starts ${startLabel(today, row.startsOn, t)}`}</span>
                      {row.assignee ? (
                        <span className="flex flex-wrap items-center gap-x-2 text-ink-soft">
                          {t("with ")}<Person inSentence person={who} me={user.id} size="size-6" className="font-semibold text-ink" />
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-ink-soft">
                      {t`${describeInterval(row.intervalDays, t)}, about ${row.estimateMinutes} min.`}
                    </p>
                  </li>
                );
              }

              return (
                <li
                  key={row.areaId}
                  data-testid={`turn-${row.name}`}
                  data-state={row.done ? "done" : yours ? "mine" : "theirs"}
                  className={`flex flex-col gap-2 px-3 py-4 ${yours && !row.done ? "rounded-2xl bg-spruce/20" : "border-b-2 border-ink/15"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    {row.done ? (
                      <Struck draw={isFresh(row.done.at, now)} className="type-display text-4xl text-ink-soft">
                        {row.name}
                      </Struck>
                    ) : (
                      <span className="type-display min-w-0 text-4xl break-words">{row.name}</span>
                    )}
                    {row.done ? (
                      row.done.by?.userId === user.id ? (
                        <ActionButton about={row.name} action={undoDoneAction.bind(null, row.areaId, row.period)}>
                          {t("Undo")}
                        </ActionButton>
                      ) : null
                    ) : yours ? (
                      <ActionButton look="filled" about={row.name} pendingLabel={t("Saving…")} action={markDoneAction.bind(null, row.areaId, row.period)}>
                        {t("Done")}
                      </ActionButton>
                    ) : (
                      <ActionButton about={row.name} action={takeOverAction.bind(null, row.areaId, row.period)}>
                        {t("I'll take it")}
                      </ActionButton>
                    )}
                  </div>
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {row.done ? (
                      <span className="flex flex-wrap items-center gap-x-2 font-semibold">
                        {t("Done by ")}<Person inSentence person={row.done.by ? people.get(row.done.by.userId) : undefined} me={user.id} size="size-6" />
                      </span>
                    ) : (
                      <>
                        {row.assignee ? <Person person={who} me={user.id} size="size-6" className="font-semibold" /> : null}
                        <span className="text-ink-soft">
                          {t`${describeDue(today, row.lastDay, t)}, about ${row.estimateMinutes} min`}
                        </span>
                      </>
                    )}
                  </p>
                  {!row.done && row.takenOver && row.takenFrom ? (
                    <p className="text-sm font-semibold" data-testid="taken-from">
                      {yours
                        ? t`You took this over from ${row.takenFrom.name}.`
                        : row.takenFrom.userId === user.id
                          ? t`${row.assignee?.name ?? t("Someone")} took this over from you.`
                          : t`${row.assignee?.name ?? t("Someone")} took this over from ${row.takenFrom.name}.`}
                    </p>
                  ) : null}
                  {!row.done && yours && row.takenOver ? (
                    <div className="flex justify-start">
                      <ActionButton align="start" about={row.name} action={giveBackAction.bind(null, row.areaId, row.period)}>
                        {t("Give it back")}
                      </ActionButton>
                    </div>
                  ) : null}
                  {!row.done && row.lastWasSkipped ? <p className="text-sm font-semibold text-barn">{t("Nobody marked this done last time.")}</p> : null}
                  <p className="text-sm text-ink-soft">
                    {t`${describeInterval(row.intervalDays, t)}. Next: ${row.next ? (row.next.userId === user.id ? t("you") : row.next.name) : t("nobody")}.`}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AreaPage>
  );
}
