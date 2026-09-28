import { ChevronLeft, Keyboard, Mic, Send } from "lucide-react";
import Link from "next/link";
import type { ComponentType } from "react";
import { BottomNav } from "@/ui/bottom-nav";
import { Button, ButtonLink, IconButton } from "@/ui/button";
import { Card } from "@/ui/card";
import { Chip, CHIPS, type ChipKind, CodeChip, Tag } from "@/ui/chip";
import { DesktopHeader } from "@/ui/desktop-header";
import { Disclosure } from "@/ui/disclosure";
import { EditableSection } from "@/ui/editable-section";
import { Field } from "@/ui/field";
import { Icon } from "@/ui/icon";
import { Notice } from "@/ui/notice";
import { PricingCard } from "@/ui/pricing-card";
import { ProgressBar } from "@/ui/progress-bar";
import { RecordButton } from "@/ui/record-button";
import { Screen } from "@/ui/screen";
import { SegmentedControl } from "@/ui/segmented-control";
import { Timeline, TimelineRow } from "@/ui/timeline";
import { Wave } from "@/ui/wave";

// Synthetic copy only. Each screen holds at most one primary action (src/ui/banned-classes.test.ts).
export type GalleryScreen = { id: string; title: string; frame: "phone" | "desktop"; Body: ComponentType };

const CAPTURE_MODES = [
  { value: "record", label: "Record", icon: <Icon icon={Mic} size={18} /> },
  { value: "dictate", label: "Dictate", icon: <Icon icon={Send} size={18} /> },
  { value: "type", label: "Type", icon: <Icon icon={Keyboard} size={18} /> },
];

function Buttons() {
  return (
    <Screen>
      <h1 className="font-display text-h1">Here&apos;s what we saw.</h1>
      <Button variant="primary" icon={Send}>
        Send it across
      </Button>
      <Button variant="secondary">Back home</Button>
      <Button variant="secondary" fill="blush">
        Read the letter
      </Button>
      <Button variant="secondary" disabled>
        Nothing to send yet
      </Button>
      <Button variant="tertiary">Retake the photo</Button>
      <IconButton icon={ChevronLeft} label="Back" />
    </Screen>
  );
}

function Chips() {
  return (
    <Screen>
      <h1 className="font-display text-h1">Chips</h1>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CHIPS) as ChipKind[]).map((kind) => (
          <Chip key={kind} kind={kind} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Chip kind="quick" size="detail" />
        <Chip kind="landed" size="detail" />
      </div>
      <h2 className="font-display text-h3">Tags and codes</h2>
      <div className="flex flex-wrap gap-2">
        <Tag>48 min in the room</Tag>
        <Tag tone="mint">Audio deleted</Tag>
        <Tag tone="blush">Most popular</Tag>
        <CodeChip code="90834" detail="48 min" />
        <CodeChip code="F41.1" />
      </div>
    </Screen>
  );
}

function Inputs() {
  return (
    <Screen>
      <h1 className="font-display text-h1">Just one thing.</h1>
      <Field label="Your email" name="gallery-email" type="email" autoComplete="off" />
      <Field label="Member ID" name="gallery-member" defaultValue="SYN0000" error="That one looks short. One more look?" />
      <Field label="Name on the card" name="gallery-name" defaultValue="Jordan Sample" hint="Exactly as it's printed." />
      <Notice>We only need this once.</Notice>
      <Notice tone="mint">Saved. The photo is deleted.</Notice>
    </Screen>
  );
}

function ClientHome() {
  return (
    <Screen>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">Good afternoon.</h1>
        <p className="text-secondary text-slate">Two bills are out on the water.</p>
      </div>
      <Card>
        <p className="text-label text-slate">Coming back to you</p>
        <p className="font-display text-hero tabular-nums text-sea-deep">$310.20</p>
        <p className="text-secondary text-slate">$126.00 came back this month. The rest is on its way.</p>
      </Card>
      <h2 className="font-display text-h2">Your trips</h2>
      <ul className="flex flex-col gap-3">
        <Card as="li" size="sm">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Chip kind="sent" />
            <span className="font-display text-amount tabular-nums text-sea-deep">$184.20</span>
          </div>
          <p className="text-secondary">Your insurer has it. We check in every week.</p>
          <ProgressBar done={2} />
        </Card>
        <Card as="li" size="sm">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <Chip kind="quick" />
            <span className="font-display text-amount tabular-nums text-sea-deep">$126.00</span>
          </div>
          <p className="text-secondary">Did the check arrive? One tap closes this trip.</p>
          <ProgressBar done={2} />
        </Card>
      </ul>
      <BottomNav variant="client" current="/c" label="Client navigation" />
    </Screen>
  );
}

function TripDetail() {
  return (
    <Screen>
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Back" className="-ml-3" />
        <span className="text-caption text-slate">Session on Sep 12</span>
      </div>
      <Chip kind="sent" size="detail" />
      <h1 className="font-display text-hero tabular-nums text-sea-deep">$184.20</h1>
      <p className="text-body">Nothing else to do. We&apos;ll wave when it lands, probably around Oct 1.</p>
      <ProgressBar done={1} />
      <Wave label="Out on the water" />
      <Card>
        <h2 className="font-display text-h3">Along the way</h2>
        <Timeline>
          <TimelineRow title="Filed from your session" time="Sep 12" done />
          <TimelineRow title="Your insurer has it" time="Sep 13" done />
          <TimelineRow title="Money comes back" time="Around Oct 1" done={false} />
        </Timeline>
      </Card>
      <ButtonLink variant="tertiary" href="/c">
        Back home
      </ButtonLink>
    </Screen>
  );
}

function ClinicianNote() {
  return (
    <Screen>
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Back" className="-ml-3" />
        <span className="text-caption text-slate">Today, 3:00 pm</span>
      </div>
      <h1 className="font-display text-h1">Here&apos;s Jordan&apos;s note.</h1>
      <div className="flex flex-wrap gap-1.5">
        <Tag>48 min in the room</Tag>
        <Tag tone="mint">Audio deleted</Tag>
      </div>
      <Card size="sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-amount">DAP note</h2>
          <Tag>Tap any line to edit</Tag>
        </div>
        <EditableSection label="Data" value="Sleeping 6 hours, up from 4. Two panic episodes, both at work." />
        <EditableSection label="Assessment" value="Generalized anxiety, improving." />
        <EditableSection label="Plan" value="Weekly CBT. Review in 2 weeks." />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="flex flex-wrap gap-1.5">
            <CodeChip code="90834" detail="48 min" />
            <CodeChip code="F41.1" />
          </span>
          <Button variant="tertiary" disabled>
            Copy to EHR
          </Button>
        </div>
      </Card>
      <Card size="sm">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h2 className="font-display text-amount">Jordan&apos;s claim</h2>
          <span className="font-display text-amount tabular-nums">$200</span>
        </div>
        <p className="text-secondary text-slate">Once you approve, we file it with Jordan&apos;s insurer. Free for Jordan.</p>
      </Card>
      <Card size="sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-amount">Necessity letter</h2>
          <Chip kind="quick" />
        </div>
        <p className="text-secondary text-slate">The insurer asked why Jordan&apos;s care is needed. We drafted the letter from 8 of your notes.</p>
        <Button variant="secondary" fill="blush" className="self-start">
          Read the letter
        </Button>
      </Card>
      <Button variant="primary">Approve note</Button>
    </Screen>
  );
}

function ClinicianRecord() {
  return (
    <Screen>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-h1">Jordan, 3:00 pm</h1>
        <p className="text-secondary text-slate">Recording consent on file.</p>
      </div>
      <SegmentedControl label="How to capture" options={CAPTURE_MODES} defaultValue="record" />
      <Card className="items-center">
        <RecordButton recording elapsedMs={134_000} level={0.6} />
      </Card>
      <BottomNav variant="clinician" current="/app" label="Clinician navigation" />
    </Screen>
  );
}

function RecordNoConsent() {
  return (
    <Screen>
      <h1 className="font-display text-h1">Sam, 4:00 pm</h1>
      <Card className="items-center">
        <RecordButton recording={false} elapsedMs={0} level={0} disabledReason="Sam hasn't agreed to recording. Dictate or type instead." />
      </Card>
      <Button variant="secondary" icon={Send}>
        Dictate a summary
      </Button>
      <Button variant="tertiary" icon={Keyboard}>
        Type rough notes
      </Button>
    </Screen>
  );
}

function Header() {
  return (
    <DesktopHeader
      nav={[
        { href: "/#how", label: "How it works" },
        { href: "/#security", label: "Security" },
        { href: "/#pricing", label: "Pricing" },
      ]}
      current="/#how"
      actions={
        <>
          <Link href="/sign-in" className="text-secondary font-bold text-navy">
            Log in
          </Link>
          <ButtonLink variant="primary" href="/start" icon={Mic}>
            Start free
          </ButtonLink>
        </>
      }
    />
  );
}

// Sample figures only: the real price and trial length come from PRICING (N6), never from copy.
function Pricing() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <PricingCard title="Free trial" price="$0" unit="to start" meta="No card needed." features={["Every feature", "Unlimited notes", "Signed BAA"]} cta={{ label: "Start free", href: "/start" }} />
      <PricingCard
        title="Membership"
        price="$XX"
        unit="a month"
        meta="Cancel anytime."
        badge="Most popular"
        featured
        features={["Unlimited notes and dictation", "Phone app with scanning", "Necessity and appeal letters", "Clients' claims filed free for them"]}
        cta={{ label: "Start free", href: "/start" }}
      />
      <PricingCard title="Groups" price="Custom" meta="Priced by practice size." features={["One bill for the practice", "Shared note formats"]} cta={{ label: "Talk to us", href: "/start" }} />
    </div>
  );
}

function Questions() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
      <Disclosure question="Does it work with my EHR?" defaultOpen>
        Yes. Copy the finished note into any EHR in one tap.
      </Disclosure>
      <Disclosure question="What if a client doesn't want to be recorded?">Then don&apos;t record. Dictate a summary after the session, or type rough notes, and you get the same finished note.</Disclosure>
      <Disclosure question="Do my clients pay anything?">No. Your membership covers filing and following up on every client&apos;s claim.</Disclosure>
    </div>
  );
}

export const GALLERY_SCREENS: GalleryScreen[] = [
  { id: "buttons", title: "Buttons", frame: "phone", Body: Buttons },
  { id: "chips", title: "Chips, tags and codes", frame: "phone", Body: Chips },
  { id: "inputs", title: "Inputs and notices", frame: "phone", Body: Inputs },
  { id: "client-home", title: "Client home", frame: "phone", Body: ClientHome },
  { id: "trip-detail", title: "Trip detail", frame: "phone", Body: TripDetail },
  { id: "clinician-note", title: "Clinician note", frame: "phone", Body: ClinicianNote },
  { id: "clinician-record", title: "Record a session", frame: "phone", Body: ClinicianRecord },
  { id: "record-no-consent", title: "Record without consent", frame: "phone", Body: RecordNoConsent },
  { id: "desktop-header", title: "Desktop header", frame: "desktop", Body: Header },
  { id: "pricing", title: "Pricing", frame: "desktop", Body: Pricing },
  { id: "questions", title: "Questions", frame: "desktop", Body: Questions },
];
