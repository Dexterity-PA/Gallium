import { CONTACT_EMAIL, GITHUB_URL, POSITIONING } from "@/lib/site/content";
import { SITE_URL } from "@/lib/site/seo";

// Structured data for the marketing page. Server component, rendered once as
// the first child of [data-site-root]. Facts only: the product exists as a
// prototype, the positioning line, the GitHub repo, the contact email.
// Deliberately absent: offers/prices (pricing is unapproved placeholder),
// ratings, reviews, and any customer or company names beyond Gallium itself.

type OrganizationLd = {
  "@type": "Organization";
  "@id": string;
  name: string;
  url: string;
  email: string;
  sameAs: string[];
};

type SoftwareApplicationLd = {
  "@type": "SoftwareApplication";
  name: string;
  applicationCategory: "BusinessApplication";
  operatingSystem: "Web";
  description: string;
  url: string;
  author: { "@id": string };
};

const organization: OrganizationLd = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "Gallium",
  url: SITE_URL,
  email: CONTACT_EMAIL,
  sameAs: [GITHUB_URL],
};

const softwareApplication: SoftwareApplicationLd = {
  "@type": "SoftwareApplication",
  name: "Gallium",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description: POSITIONING,
  url: `${SITE_URL}/app`,
  author: { "@id": `${SITE_URL}/#organization` },
};

const payload = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [organization, softwareApplication],
}).replace(/</g, "\\u003c");

export default function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: payload }}
    />
  );
}
