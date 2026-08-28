import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · OUTRANK" };

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="LEGAL · 01" title="PRIVACY POLICY">
      <LegalSection title="What OUTRANK collects">
        <p>OUTRANK does not require a user account. We create a random, cookie-backed session identifier to protect write actions, enforce rate limits, and keep requests reliable. We may process IP address and basic request metadata for security and abuse prevention.</p>
        <p>When you submit an item, we store the public URL and the title, description, image, category, and other details needed to display it. Do not submit private, confidential, or unlawful material.</p>
      </LegalSection>
      <LegalSection title="Payments and email">
        <p>Dodo Payments processes checkout and payment information. OUTRANK receives payment identifiers, status, amount, currency, metadata, and the payer email needed to confirm a paid bid. We do not receive or store complete card details.</p>
        <p>After a successful bid, the payer email is subscribed to rank-movement notifications for that item. Every message includes an unsubscribe link. Resend delivers these emails on our behalf.</p>
      </LegalSection>
      <LegalSection title="Analytics and cookies">
        <p>Optional product analytics run only after you choose Allow in the analytics notice. PostHog records product events such as page views, board interactions, checkout starts, completed payments, and checkout failures. Session replay masks inputs and page text. Declining analytics does not prevent payment or normal site use.</p>
        <p>Necessary session and security cookies operate independently of analytics consent.</p>
      </LegalSection>
      <LegalSection title="Service providers and international processing">
        <p>We use infrastructure and processors including AWS, Dodo Payments, Resend, and PostHog. These providers process information under their own security and privacy terms. PostHog analytics is configured for its European ingestion endpoint.</p>
      </LegalSection>
      <LegalSection title="Retention and your choices">
        <p>We retain payment, bid, audit, and security records for as long as reasonably required to operate the service, resolve disputes, prevent fraud, and meet legal obligations. Public board submissions remain until removed or no longer needed.</p>
        <p>You can decline analytics, unsubscribe from email at any time, or contact shagil@content-rank.lol to request access, correction, deletion, or another privacy right available where you live. Some financial or fraud-prevention records may need to be retained.</p>
      </LegalSection>
      <LegalSection title="Children and changes">
        <p>OUTRANK is not intended for children under 18 and paid bids must be made by someone legally able to enter a payment agreement. We may update this policy as the service changes and will revise the date shown above.</p>
      </LegalSection>
    </LegalPage>
  );
}
