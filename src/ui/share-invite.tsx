"use client";

import { Send } from "lucide-react";
import { useEffect, useState } from "react";
import { SHARE_MESSAGE, shareMailto } from "@/core/copy/for-clients";
import { Button, buttonClass } from "./button";
import { Icon } from "./icon";

// Web Share where the phone has it, a mail draft otherwise. Nothing is sent to us or stored: the message leaves
// the device only through the share sheet or the mail app, to whoever the client picks.
export function ShareInvite({ label }: { label: string }) {
  const [site, setSite] = useState<string>();
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    // The page's own origin is only known in the browser, so both are read after mount by design.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSite(`${window.location.origin}/`);
    setCanShare(typeof navigator.share === "function");
  }, []);

  if (canShare && site) {
    return (
      <Button
        variant="primary"
        icon={Send}
        onClick={() => {
          navigator.share({ title: SHARE_MESSAGE.subject, text: SHARE_MESSAGE.text, url: site }).catch(() => {});
        }}
      >
        {label}
      </Button>
    );
  }
  return (
    <a data-variant="primary" href={shareMailto(site)} className={buttonClass("primary")}>
      <Icon icon={Send} />
      {label}
    </a>
  );
}
