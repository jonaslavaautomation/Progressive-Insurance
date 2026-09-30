import { Printer } from 'lucide-react';
import type { NamedInsured, Phone } from '@/types/quote';
import { GENDERS, PHONE_TYPES, SUFFIXES, US_STATES, YES_NO } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddLink, FormCheckbox, FormInput, FormPhone, FormSection, FormSelect, HelpDot } from '@/components/wizard/primitives';

const MAX_PHONES = 3;
const DISCLOSURE = 'Like most insurance companies, Progressive uses information from you and other sources, such as your driving, claims and credit histories, to calculate an accurate price for your insurance. New or updated information may be used to calculate your renewal premium. Its Privacy Policy explains how Progressive discloses and protects your personal information and how you may access and correct it. I can provide a copy at your request.';

export function NamedInsuredStep() {
  const { state, updateInsured, updateAddress } = useQuote();
  const { insured, policy } = state;
  const { address } = insured;
  const set = <K extends keyof NamedInsured>(field: K) => (value: NamedInsured[K]) => updateInsured({ [field]: value } as Partial<NamedInsured>);
  const setPhone = (index: number, patch: Partial<Phone>) => updateInsured({ phones: insured.phones.map((phone, i) => (i === index ? { ...phone, ...patch } : phone)) });
  const removePhone = (index: number) => updateInsured({ phones: insured.phones.length > 1 ? insured.phones.filter((_, i) => i !== index) : [{ type: 'Cell', number: '' }] });

  return <WizardLayout keyboardToggle contentClassName="pt-[18px]">
    <p className="mb-[10px] text-[12px] text-[#2e3a43]">(* Indicates required field)</p>
    <div className="grid grid-cols-[560px_560px] items-start gap-[22px]">
      <div className="space-y-[22px]">
        <FormSection title="Policy"><FormInput label="PGR Agent Code:*" value={policy.agentCode} disabled hint={fieldHints.agentCode} /></FormSection>
        <FormSection title="Principal Named Insured (all products)">
          <FormInput id="insured.firstName" label="First Name:*" value={insured.firstName} onChange={set('firstName')} />
          <FormInput id="insured.middleInitial" label="Middle Initial:" value={insured.middleInitial} onChange={(value) => updateInsured({ middleInitial: value.slice(-1).toUpperCase() })} />
          <FormInput id="insured.lastName" label="Last Name:*" value={insured.lastName} onChange={set('lastName')} />
          <FormSelect id="insured.suffix" label="Suffix:" value={insured.suffix} options={SUFFIXES} onChange={set('suffix')} />
          <FormInput id="insured.dob" label="Date of Birth:*" placeholder="MM/DD/YYYY" mask="date" value={insured.dob} onChange={set('dob')} hint={fieldHints.dob} />
          <FormSelect id="insured.gender" label="Gender:*" value={insured.gender} options={GENDERS} onChange={set('gender')} />
        </FormSection>
        <FormSection title="Contact Information">
          <FormInput id="insured.email" label="Customer Email:" type="email" help helpText={fieldHints.email} value={insured.email} onChange={set('email')} />
          {insured.phones.map((phone, index) => <FormPhone key={index} id={`insured.phones.${index}`} first={index === 0} type={phone.type} types={PHONE_TYPES} number={phone.number} hint={fieldHints.phone} onType={(type) => setPhone(index, { type: type as Phone['type'] })} onNumber={(number) => setPhone(index, { number })} onRemove={() => removePhone(index)} />)}
          {insured.phones.length < MAX_PHONES && <AddLink label="Add Phone Number" className="ml-[215px]" onClick={() => updateInsured({ phones: [...insured.phones, { type: 'Home', number: '' }] })} />}
        </FormSection>
      </div>
      <div className="space-y-[22px]">
        <FormSection title="Current Mailing Address" action={<HelpDot label="Current Mailing Address" text={fieldHints.address} />}>
          <FormInput id="address.line1" label="Mailing Address Line 1:*" placeholder="Begin typing an address..." value={address.line1} onChange={(line1) => updateAddress({ line1 })} />
          <FormInput id="address.line2" label="Mailing Address Line 2:" value={address.line2} onChange={(line2) => updateAddress({ line2 })} />
          <FormInput id="address.city" label="City:*" value={address.city} onChange={(city) => updateAddress({ city })} />
          <FormSelect id="address.state" label="State:*" value={address.state} options={US_STATES} onChange={(value) => updateAddress({ state: value })} />
          <FormInput id="address.zip" label="ZIP Code:*" mask="zip" value={address.zip} onChange={(zip) => updateAddress({ zip })} />
          <FormCheckbox label="P.O. Box or a Military Address" checked={address.poBox} onChange={(poBox) => updateAddress({ poBox })} />
          <FormSelect id="insured.movedRecently" label="Has the insured moved in the last 2 months?*" value={insured.movedRecently} options={YES_NO} onChange={(value) => updateInsured({ movedRecently: value as NamedInsured['movedRecently'] })} hint={fieldHints.movedRecently} />
        </FormSection>
        <FormSection title="Disclosure" action={<button type="button" aria-label="Print disclosure" onClick={() => window.print()} className="text-[#5c6670] hover:text-[#003865]"><Printer size={20} /></button>}>
          <p className="text-[14px] font-bold leading-[19px] text-[#2e3a43]">For phone quote, read the following. If in-person, print and provide to the consumer:</p>
          <p className="text-[14px] leading-[20px] text-[#7b858a]">{DISCLOSURE}</p>
          <FormSelect id="insured.disclosureAcknowledged" label="Was the above disclosure read or provided to the consumer?*" value={insured.disclosureAcknowledged} options={YES_NO} onChange={(value) => updateInsured({ disclosureAcknowledged: value as NamedInsured['disclosureAcknowledged'] })} hint={fieldHints.disclosure} />
        </FormSection>
      </div>
    </div>
  </WizardLayout>;
}
