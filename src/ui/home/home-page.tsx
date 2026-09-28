import { Anchor, Check, Clock, FileText, Mic, PenLine, ScanLine } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { HOME, TALK_TO_US, trialCta } from "@/core/copy/home";
import { ButtonLink } from "../button";
import { Card } from "../card";
import { Chip, Tag } from "../chip";
import { cx } from "../cx";
import { Icon } from "../icon";
import { PricingCard } from "../pricing-card";
import { ProgressBar } from "../progress-bar";
import { CaptureTabs } from "./capture-tabs";
import { SiteFooter, SiteHeader } from "./site-chrome";

const WRAP = "mx-auto w-full max-w-page px-gutter md:px-8";
const H2 = "font-display text-h1 md:text-hero";
const LEAD = "max-w-140 text-body text-slate md:text-[1.1875rem]";

function Section({ id, title, lead, children, className }: { id?: string; title: string; lead?: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={id && `${id}-title`} className={cx("flex scroll-mt-6 flex-col gap-8 pb-20 md:pb-24", className)}>
      <div className="flex flex-col gap-3">
        <h2 id={id && `${id}-title`} className={H2}>
          {title}
        </h2>
        {lead && <p className={LEAD}>{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Label({ icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-label text-slate">
      <Icon icon={icon} size={16} />
      {children}
    </span>
  );
}

// Decorative, like the spec: the stack shows what a clinician gets, so it is hidden from screen readers.
function HeroStack() {
  const { note, letter, claim } = HOME.hero;
  return (
    <div aria-hidden="true" className="flex flex-col p-3">
      <Card size="sm" className="max-w-75 -rotate-3">
        <Label icon={Mic}>{note.label}</Label>
        <span className="font-bold">{note.quote}</span>
        <span className="text-caption text-slate">{note.meta}</span>
      </Card>
      <Card size="sm" className="-mt-3 max-w-80 self-end">
        <span className="flex items-center justify-between gap-3">
          <Label icon={FileText}>{letter.label}</Label>
          <Chip kind="sent" />
        </span>
        <span className="text-caption text-slate">{letter.meta}</span>
      </Card>
      <Card className="-mt-2 max-w-85 rotate-2">
        <span className="flex items-center justify-between gap-3">
          <Label icon={Anchor}>{claim.label}</Label>
          <Chip kind="on-its-way" />
        </span>
        <span className="font-display text-hero text-sea-deep tabular-nums">{claim.amount}</span>
        <ProgressBar done={2} />
      </Card>
    </div>
  );
}

const PROMISE_ICONS = [Clock, PenLine, Anchor];
const BUILT_ICONS = [Mic, ScanLine, FileText];

// docs/spec.html #screen-1. Every string comes from src/core/copy/home.ts; home-copy.test.ts compares the text.
export function HomePage({ prelaunch }: { prelaunch: boolean }) {
  const { hero, built, how, why, security, pricing, faq, close } = HOME;
  const heroCta = trialCta(hero.primary, prelaunch);
  const closeCta = trialCta(close.cta, prelaunch);
  return (
    <>
      <a href={HOME.banner.href} className="block bg-navy px-5 py-3 text-center text-nav text-cream focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-cream">
        {HOME.banner.text}
      </a>
      <SiteHeader prelaunch={prelaunch} />
      <main className={WRAP}>
        <section className="grid items-center gap-10 pt-8 pb-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:pt-12 lg:pb-18">
          <div className="flex flex-col items-start gap-6">
            <h1 className="font-display text-hero">{hero.title}</h1>
            <p className={LEAD}>{hero.lead}</p>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink variant="primary" href={heroCta.href} icon={Mic}>
                {heroCta.label}
              </ButtonLink>
              <ButtonLink variant="secondary" href={hero.secondary.href}>
                {hero.secondary.label}
              </ButtonLink>
            </div>
            <span className="text-caption font-bold text-slate">{hero.fine}</span>
          </div>
          <HeroStack />
        </section>

        <section aria-label="What changes" className="grid gap-3 pb-20 md:grid-cols-3 md:pb-22">
          {HOME.promises.map((promise, i) => (
            <div key={promise} className="flex items-center gap-3.5 rounded-card bg-white px-6.5 py-6 font-display text-h2">
              <Icon icon={PROMISE_ICONS[i]} size={32} className="shrink-0 text-peach" />
              {promise}
            </div>
          ))}
        </section>

        <Section title={built.title} lead={built.lead}>
          <div className="grid gap-4 md:grid-cols-3">
            {built.cards.map((card, i) => (
              <Card key={card.title}>
                <span className="flex size-12 items-center justify-center rounded-pill bg-blush">
                  <Icon icon={BUILT_ICONS[i]} />
                </span>
                <h3 className="font-display text-h3">{card.title}</h3>
                <p className="text-slate">{card.body}</p>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="how" title={how.title} lead={how.lead}>
          <CaptureTabs>
            <ol className="flex flex-col gap-3">
              {how.steps.map((step) => (
                <li key={step.num} className="flex gap-4.5 rounded-card-sm bg-white px-5.5 py-5">
                  <span className="font-display text-h3 text-slate">{step.num}</span>
                  <span className="flex flex-col gap-1">
                    <b className="text-button leading-snug">{step.title}</b>
                    <span className="text-slate">{step.body}</span>
                  </span>
                </li>
              ))}
            </ol>
          </CaptureTabs>
        </Section>

        <Section title={why.title}>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <Label icon={Clock}>{why.notes.label}</Label>
              <h3 className="font-display text-h3">{why.notes.title}</h3>
              <div className="flex flex-wrap gap-3">
                {why.notes.formats.map((f) => (
                  <Tag key={f}>{f}</Tag>
                ))}
              </div>
            </Card>
            <Card>
              <Label icon={FileText}>{why.letters.label}</Label>
              <h3 className="font-display text-h3">{why.letters.title}</h3>
              <p className="text-slate">{why.letters.body}</p>
            </Card>
            <Card>
              <Label icon={Anchor}>{why.claims.label}</Label>
              <h3 className="font-display text-h3">{why.claims.title}</h3>
              <ProgressBar done={2} />
            </Card>
            <Card>
              <Label icon={Check}>{why.price.label}</Label>
              <h3 className="font-display text-h3">{why.price.title}</h3>
              <p className="text-slate">{why.price.body}</p>
            </Card>
          </div>
        </Section>

        <section id="security" aria-labelledby="security-title" className="grid scroll-mt-6 items-start gap-8 pb-20 md:pb-24 lg:grid-cols-[25rem_1fr] lg:gap-12">
          <div className="flex flex-col gap-3">
            <h2 id="security-title" className={H2}>
              {security.title}
            </h2>
            <p className={LEAD}>{security.lead}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {security.qa.map(({ q, a }) => (
              <Card key={q} size="sm">
                <h3 className="font-display text-h3">{q}</h3>
                <p className="text-slate">{a}</p>
              </Card>
            ))}
          </div>
        </section>

        <Section id="pricing" title={pricing.title}>
          <div className="grid gap-4 md:grid-cols-3">
            <PricingCard {...pricing.trial} features={[...pricing.trial.features]} cta={trialCta(pricing.trial.cta, prelaunch)} />
            <PricingCard {...pricing.membership} features={[...pricing.membership.features]} cta={trialCta(pricing.membership.cta, prelaunch)} featured />
            <PricingCard {...pricing.groups} features={[...pricing.groups.features]} cta={TALK_TO_US} />
          </div>
        </Section>

        <section aria-labelledby="faq-title" className="mx-auto flex w-full max-w-190 flex-col gap-3 pb-20 md:pb-24">
          <h2 id="faq-title" className={H2}>
            {faq.title}
          </h2>
          {faq.items.map(({ q, a }, i) => (
            <details key={q} open={i === 0} className="group rounded-card-sm bg-white px-6 py-5">
              <summary className="flex min-h-touch cursor-pointer list-none items-center justify-between gap-4 rounded-input text-button leading-snug focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy after:font-display after:text-h2 after:content-['+'] group-open:after:content-['−'] [&::-webkit-details-marker]:hidden">
                {q}
              </summary>
              <p className="pt-2.5 text-slate">{a}</p>
            </details>
          ))}
        </section>

        <section className="mb-16 flex flex-col items-center gap-5 rounded-card bg-navy px-6 py-18 text-center text-cream md:px-8">
          <h2 className="font-display text-hero text-cream">{close.title}</h2>
          <p className="text-body text-onnavy md:text-[1.1875rem]">{close.lead}</p>
          <ButtonLink variant="primary" href={closeCta.href} icon={Mic}>
            {closeCta.label}
          </ButtonLink>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
