import { Check } from "lucide-react";
import { ButtonLink } from "./button";
import { Card } from "./card";
import { Tag } from "./chip";
import { cx } from "./cx";
import { Icon } from "./icon";

// docs/spec.html pricing. The featured card carries the peach outline and the one primary action.
export function PricingCard({
  title,
  price,
  unit,
  meta,
  features,
  cta,
  featured,
  badge,
}: {
  title: string;
  price: string;
  unit?: string;
  meta: string;
  features: string[];
  cta: { label: string; href: string };
  featured?: boolean;
  badge?: string;
}) {
  return (
    <Card as="section" className={cx("h-full", featured && "outline-3 -outline-offset-3 outline-peach")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-h3">{title}</h3>
        {badge && <Tag tone="blush">{badge}</Tag>}
      </div>
      <p className="font-display text-hero tabular-nums">
        {price}
        {unit && <span className="ml-1 font-body text-body font-semibold text-slate">{unit}</span>}
      </p>
      <p className="text-caption text-slate">{meta}</p>
      <ul className="flex flex-1 flex-col gap-2.5 py-2 text-secondary">
        {features.map((f) => (
          <li key={f} className="flex items-center gap-2.5">
            <Icon icon={Check} size={18} className="shrink-0 text-sea-deep" />
            {f}
          </li>
        ))}
      </ul>
      <ButtonLink variant={featured ? "primary" : "secondary"} fill="blush" href={cta.href} className="w-full">
        {cta.label}
      </ButtonLink>
    </Card>
  );
}
