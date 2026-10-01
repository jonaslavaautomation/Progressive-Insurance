// Footer and banner links (privacy, terms, site map, binding restrictions...) open an information
// panel instead of going nowhere.
import { useState } from 'react';
import { Modal } from '@/components/wizard/Modal';
import { modalButton } from '@/components/wizard/modalStyles';

const CONTENT: Record<string, string[]> = {
  'About LAVA Training': ['LAVA Training is an independent agent training simulator by LAVA Automation. It is not affiliated with, endorsed by, or sponsored by Progressive Casualty Insurance Company or any of its affiliates. Training simulation only: no real insurance is quoted, bound or issued.', 'The workflows follow common carrier agent-portal practice and published state insurance rules for training. Product, program and company names in this simulator are LAVA training names. Premiums, documents and policy numbers are fictitious.'],
  'Privacy Statement': ['LAVA Training collects the information needed to quote, bind and service policies for your customers. Customer information may be used only for insurance purposes and must never be shared outside the agency.', 'This training portal keeps all information in your own browser. Use only fictitious customer information.'],
  "Agents' Privacy": ['Agent and producer information is used to manage appointments, commissions and portal access.', 'In this training portal the signed-in agent profile is stored only in your browser.'],
  'Consumer/Customer Privacy': ['Customers can request a copy of the personal information held about them, ask for corrections and opt out of marketing. Direct those requests to customer service.'],
  'Terms of Use': ['LAVA Training is a restricted-use site for appointed agents and their authorized staff. Access is monitored. Share your login with no one.', 'Training simulation: nothing you do here creates real insurance coverage.'],
  'Contact Us': ['Agency support: 1-800-555-0123 (training line), Monday - Friday 8 a.m. - 9 p.m., Saturday 9 a.m. - 5 p.m. ET.', 'Claims, 24 hours a day: 1-800-555-0199 (training line).'],
  'Site Map': ['New Business: start or retrieve a quote, Commercial Lines.', 'Prospecting: requote prospects, cross-sell opportunities.', 'Manage Policies: policy search, pending cancellations and renewals, Billing Center, e-Sign follow-up, Claims Center.', 'Products: product guides and underwriting.', 'Agency Admin: agency profile, production report, commission statement.', 'News and Support.'],
  Accessibility: ['The portal supports keyboard navigation, screen readers and browser zoom. Help buttons can be reached with the keyboard from the quote header switch.', 'Report accessibility issues to agency support.'],
  'CA Notice at Collection': ['California residents: this notice describes the categories of personal information collected and the purposes for which they are used. This training portal writes North Carolina, Texas, Florida, Wisconsin, New Hampshire and Oregon.'],
  'Do Not Sell or Share My Personal Information (CA Residents Only)': ['California residents may opt out of the sale or sharing of personal information. Customer requests are processed by customer service.'],
  'Legal and Regulatory': ['Insurance products are subject to the law and Department of Insurance of the state where the policy is written: North Carolina, Texas, Florida, Wisconsin, New Hampshire or Oregon. Coverage is governed by the policy contract.'],
  'Binding Restrictions': ['When a hurricane, tropical storm or wildfire watch or warning is issued for an area, new business, coverage increases and new physical damage coverage cannot be bound there until it is lifted.', 'Existing policies can still be serviced: payments, address changes, ID cards and coverage decreases are allowed.'],
};

export function LegalLink({ label, className = '' }: { label: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const paragraphs = CONTENT[label] ?? ['This page is not available in the training portal.'];
  return <>
    <button type="button" onClick={() => setOpen(true)} className={className}>{label}</button>
    {open && <Modal title={label} width={600} onClose={() => setOpen(false)} footer={<button type="button" className={modalButton.primary} onClick={() => setOpen(false)}>Close</button>}>
      <div className="space-y-3 text-[13.5px] leading-[20px] text-[#2e3a43]">{paragraphs.map((text) => <p key={text}>{text}</p>)}</div>
    </Modal>}
  </>;
}
