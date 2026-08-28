import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Use · OUTRANK" };

export default function TermsPage() {
  return (
    <LegalPage eyebrow="LEGAL · 02" title="TERMS OF USE">
      <LegalSection title="The service">
        <p>OUTRANK is a public attention leaderboard. A paid bid adds backing to an item after Dodo Payments confirms payment. Ranking position can change whenever other paid bids, refunds, moderation actions, or corrections are applied. Buying a bid does not guarantee a position for any period of time.</p>
      </LegalSection>
      <LegalSection title="Your submissions">
        <p>You may submit only public URLs and information that you are permitted to share. You remain responsible for the submission and for complying with applicable law and third-party platform rules. Submission does not transfer ownership of the linked content to OUTRANK.</p>
        <p>We may edit metadata, merge duplicates, flag, hide, or remove submissions that are misleading, unlawful, abusive, infringing, unsafe, or technically harmful.</p>
      </LegalSection>
      <LegalSection title="Paid bids">
        <p>Bid amounts are shown in USD. Dodo Payments may display and charge a converted local-currency total and applicable taxes. An item appears or moves only after server-side payment confirmation; a checkout return page alone never grants ranking credit.</p>
        <p>You authorize the displayed charge when you submit payment. Do not attempt chargeback abuse, payment fraud, automated manipulation, or interference with ranking, security, or availability.</p>
      </LegalSection>
      <LegalSection title="Availability and changes">
        <p>The service may be changed, interrupted, or discontinued. We do not promise continuous availability, a specific audience size, traffic, revenue, reputation outcome, or permanent rank. Experimental and realtime displays may be delayed while durable payment records remain authoritative.</p>
      </LegalSection>
      <LegalSection title="Disclaimers and responsibility">
        <p>OUTRANK is provided on an as-available basis to the extent permitted by law. We are not responsible for third-party content, websites, payment services, or losses caused by events outside our reasonable control. Nothing in these terms excludes rights or liabilities that cannot legally be excluded.</p>
      </LegalSection>
      <LegalSection title="Contact and changes">
        <p>Questions, moderation requests, and disputes can be sent to shagil@content-rank.lol. We may revise these terms as the service changes; continued use after an update means you accept the revised terms where permitted by law.</p>
      </LegalSection>
    </LegalPage>
  );
}
