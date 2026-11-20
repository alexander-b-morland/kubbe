import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/avatar/avatar";
import { TabHeader } from "@/components/area/area-header";
import { ActionButton } from "@/components/ui/action-button";
import { EXTRAS } from "@/lib/extras";
import { listMembers } from "@/lib/households";
import { formatJoinCode } from "@/lib/join-code";
import { requireHousehold } from "@/lib/session";
import { ShareCode } from "../home/share-code";
import { removeMemberAction, renameHouseholdAction, replaceJoinCodeAction, setExtrasAction, setRoleAction, setTimeZoneAction } from "./actions";
import { ExtrasForm, RenameForm, TimeZoneForm } from "./settings-forms";
import { getT } from "@/lib/i18n/server";

// This screen depends on who is signed in, so it is rendered per request.
export const instant = false;

export const metadata: Metadata = { title: "Household" };

export default async function HouseholdPage() {
  const t = await getT();
  const { user, household, membership } = await requireHousehold();
  const members = await listMembers(household.id);
  const admin = membership.role === "admin";
  const alone = members.length === 1;
  // The zones this server knows, plus the household's own in case it is not among them.
  const zones = [...new Set([household.timeZone, ...Intl.supportedValuesOf("timeZone")])].sort();

  return (
    <main className="mx-auto flex w-full max-w-md flex-col lg:max-w-3xl lg:pt-6">
      <TabHeader art="people" name={t("Household")} eyebrow={t("Household")}>
        {household.name}
      </TabHeader>

      <div className="flex flex-col gap-10 p-6">

      <section aria-labelledby="people-heading" className="flex flex-col gap-2">
        <h2 id="people-heading" className="type-display text-4xl">
          {t("Who lives here")}
        </h2>
        <ul className="flex flex-col">
          {members.map((member) => {
            const self = member.userId === user.id;
            return (
              <li key={member.userId} className="flex flex-col gap-2 border-b-2 border-ink/15 py-3" data-testid={`member-${member.name}`}>
                <div className="flex items-center gap-3">
                  <Avatar avatar={member.avatar} colour={member.colour} className="size-12" />
                  <Link
                    href={self ? "/profile" : `/people/${member.userId}`}
                    className="min-w-0 rounded text-lg font-semibold break-words underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-fjord"
                  >
                    {member.name}
                    {self ? t(" (you)") : ""}
                  </Link>
                  {member.role === "admin" ? (
                    <span className="ml-auto shrink-0 rounded-full border-2 border-ink px-3 py-0.5 text-sm font-bold">{t("Admin")}</span>
                  ) : null}
                </div>
                {admin && !self ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <ActionButton
                      label={member.role === "admin" ? t`Remove ${member.name} as admin` : t`Make ${member.name} admin`}
                      confirm={member.role === "admin" ? t`Stop ${member.name} being an admin?` : t`Make ${member.name} an admin? They can then change rules and remove people.`}
                      action={setRoleAction.bind(null, member.userId, member.role === "admin" ? "member" : "admin")}
                    >
                      {member.role === "admin" ? t("Remove as admin") : t("Make admin")}
                    </ActionButton>
                    <ActionButton
                      look="link"
                      label={t`Remove ${member.name}`}
                      confirm={t`Remove ${member.name} from ${household.name} and cancel their bookings?`}
                      action={removeMemberAction.bind(null, member.userId)}
                    >
                      {t("Remove from household")}
                    </ActionButton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {admin && !alone ? (
          <p className="text-sm text-ink-soft">{t("Removing someone also replaces the invite code, since they know the old one.")}</p>
        ) : null}
      </section>

      <section aria-labelledby="invite-heading" className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
        <h2 id="invite-heading" className="type-display text-3xl">
          {t("Invite a roommate")}
        </h2>
        <p className="text-ink-soft">{t("Send the link, or have them type this code after signing up.")}</p>
        <p className="type-display text-4xl tracking-widest" data-testid="join-code">
          {formatJoinCode(household.joinCode)}
        </p>
        <ShareCode code={household.joinCode} />
        {admin ? (
          <div data-testid="replace-code">
            <ActionButton look="link" align="start" confirm={t("Replace the code? Old links stop working.")} doneLabel={t("New code ready.")} action={replaceJoinCodeAction}>
              {t("Replace with a new code")}
            </ActionButton>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="rules-heading" className="flex flex-col gap-3">
        <h2 id="rules-heading" className="type-display text-4xl">
          {t("Booking rules")}
        </h2>
        <p className="text-ink-soft">
          {admin
            ? t("Slot length, opening hours and limits for each shower and machine. Add a second shower or a dryer here too.")
            : t("Slot length, opening hours and limits for each shower and machine. An admin sets them.")}
        </p>
        <Link
          href="/settings/rules"
          data-testid="open-rules"
          className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border-2 border-ink px-5 py-3 text-lg font-bold outline-none focus-visible:ring-4 focus-visible:ring-fjord"
        >
          {admin ? t("Change showers and machines") : t("See the rules")}
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 shrink-0">
            <path d="M4 12C9 11.500 15 11.500 20 12M14 6C16 8 18 10 20 12C18 14 16 16 14 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </section>

      {admin ? (
        <section aria-labelledby="extras-heading" className="flex flex-col gap-4">
          <h2 id="extras-heading" className="type-display text-4xl">
            {t("What you use")}
          </h2>
          <p className="text-ink-soft">
            {t("Each of these has a tile on Home. Ticking or unticking saves at once. Switching one off hides it, and what is in it, for everyone until it is switched on again; nothing is deleted. Switching off the shower or laundry does not cancel bookings already made.")}
          </p>
          <ExtrasForm extras={EXTRAS} enabled={household.extras} action={setExtrasAction} />
        </section>
      ) : null}

      <section aria-labelledby="details-heading" className="flex flex-col gap-5">
        <h2 id="details-heading" className="type-display text-4xl">
          {t("Name and time zone")}
        </h2>
        {admin ? (
          <>
            <RenameForm name={household.name} action={renameHouseholdAction} />
            <TimeZoneForm timeZone={household.timeZone} zones={zones} action={setTimeZoneAction} />
          </>
        ) : (
          <p>
            {t`${household.name}. Times are shown in ${household.timeZone.replaceAll("_", " ")} time.`}
          </p>
        )}
      </section>
      </div>
    </main>
  );
}
