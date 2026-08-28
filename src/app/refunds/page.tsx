import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Refund Policy · OUTRANK" };

export default function RefundPolicyPage() {
  return (
    <LegalPage eyebrow="LEGAL · 03" title="REFUND POLICY">
      <LegalSection title="How paid bids work">
        <p>A successful paid bid changes public ranking data immediately after verified payment. Because that ranking benefit begins at once, completed bids are generally final except where this policy or applicable law provides otherwise.</p>
      </LegalSection>
      <LegalSection title="When to contact us">
        <p>Contact shagil@content-rank.lol promptly if you were charged more than once, charged the wrong amount, paid but received no backing after payment confirmation, or believe a payment was unauthorized. Include the payment email, approximate time, amount, and Dodo payment identifier if available. Never send complete card details.</p>
      </LegalSection>
      <LegalSection title="Review and processing">
        <p>We review eligible requests individually. Approved refunds are returned through Dodo Payments to the original payment method. Bank and payment-network timing may vary. Taxes, currency conversion, and provider adjustments are handled according to Dodo Payments and applicable law.</p>
      </LegalSection>
      <LegalSection title="Effect on ranking">
        <p>A full refund removes that bid’s backing. A partial refund reduces backing by the refunded amount. The board is recalculated from the remaining successfully paid amount, so the item’s position may fall.</p>
      </LegalSection>
      <LegalSection title="Statutory rights">
        <p>This policy does not limit any mandatory cancellation, refund, consumer-protection, or dispute rights available in your country. If these terms conflict with a non-waivable legal right, that right controls.</p>
      </LegalSection>
    </LegalPage>
  );
}
