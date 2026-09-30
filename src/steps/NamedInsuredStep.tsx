import type { NamedInsured, Phone } from '@/types/quote';
import { GENDERS, PHONE_TYPES, SUFFIXES, US_STATES, YES_NO } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { applyMask } from '@/utils/masks';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { FormInput, FormSection, FormSelect, HintBubble, InlineError, RemoveButton, errorRing, focusRing } from '@/components/wizard/primitives';
import { useFieldError } from '@/components/wizard/stepValidation';

const MAX_PHONES = 3;

function PhoneRow({ phone, index, onChange, onRemove }: { phone: Phone; index: number; onChange: (patch: Partial<Phone>) => void; onRemove: () => void }) {
  const id = `insured.phones.${index}`;
  const error = useFieldError(id);
  return <div className="flex items-center gap-3 text-[10px]"><span className="flex w-[130px] shrink-0 items-center gap-1">{index === 0 ? <span>Phone Type/Number<b>*</b></span> : `Phone ${index + 1}`}{index === 0 && <HintBubble text={fieldHints.phone} />}</span><select aria-label={`Phone ${index + 1} type`} value={phone.type} onChange={(event) => onChange({ type: event.target.value as Phone['type'] })} className={`h-[27px] w-[65px] rounded border border-[#aab2b7] bg-white px-1 text-[10px] outline-none ${focusRing}`}>{PHONE_TYPES.map((type) => <option key={type}>{type}</option>)}</select><span className="min-w-0 flex-1"><input id={id} value={phone.number} aria-invalid={!!error} onChange={(event) => onChange({ number: applyMask('phone', event.target.value) })} placeholder="XXX-XXX-XXXX" className={`h-[27px] w-full min-w-0 rounded border bg-white px-2 text-[10px] outline-none ${error ? errorRing : 'border-[#aab2b7]'} ${focusRing}`} /><InlineError message={error} /></span>{index > 0 && <RemoveButton label={`Remove phone ${index + 1}`} onClick={onRemove} />}</div>;
}

export function NamedInsuredStep() {
  const { state, updateInsured, updateAddress } = useQuote();
  const { insured, policy } = state;
  const { address } = insured;
  const set = <K extends keyof NamedInsured>(field: K) => (value: NamedInsured[K]) => updateInsured({ [field]: value } as Partial<NamedInsured>);
  const setPhone = (index: number, patch: Partial<Phone>) => updateInsured({ phones: insured.phones.map((phone, i) => (i === index ? { ...phone, ...patch } : phone)) });

  return <WizardLayout showStepHeader={false}>
    <div className="grid min-w-0 gap-3 p-3 lg:grid-cols-2">
      <div className="space-y-3">
        <FormSection title="Policy"><FormInput label="PGR Agent Code" required value={policy.agentCode} disabled hint={fieldHints.agentCode} /></FormSection>
        <FormSection title="Principal Named Insured (all products)">
          <FormInput id="insured.firstName" label="First Name" required value={insured.firstName} onChange={set('firstName')} />
          <FormInput id="insured.middleInitial" label="Middle Initial" value={insured.middleInitial} onChange={(value) => updateInsured({ middleInitial: value.slice(-1).toUpperCase() })} />
          <FormInput id="insured.lastName" label="Last Name" required value={insured.lastName} onChange={set('lastName')} />
          <FormSelect id="insured.suffix" label="Suffix" value={insured.suffix} options={SUFFIXES} onChange={set('suffix')} />
          <FormInput id="insured.dob" label="Date of Birth" required placeholder="MM/DD/YYYY" mask="date" value={insured.dob} onChange={set('dob')} hint={fieldHints.dob} />
          <FormSelect id="insured.gender" label="Gender" required value={insured.gender} options={GENDERS} onChange={set('gender')} />
        </FormSection>
        <FormSection title="Contact Information">
          <FormInput id="insured.email" label="Customer Email" type="email" value={insured.email} onChange={set('email')} hint={fieldHints.email} />
          {insured.phones.map((phone, index) => <PhoneRow key={index} phone={phone} index={index} onChange={(patch) => setPhone(index, patch)} onRemove={() => updateInsured({ phones: insured.phones.filter((_, i) => i !== index) })} />)}
          {insured.phones.length < MAX_PHONES && <button type="button" onClick={() => updateInsured({ phones: [...insured.phones, { type: 'Home', number: '' }] })} className="ml-[143px] text-[10px] font-bold underline">⊕ &nbsp;Add Phone Number</button>}
        </FormSection>
      </div>
      <div className="space-y-3">
        <FormSection title="Current Mailing Address">
          <FormInput id="address.line1" label="Mailing Address Line 1" required placeholder="Begin typing an address..." value={address.line1} onChange={(line1) => updateAddress({ line1 })} hint={fieldHints.address} />
          <FormInput id="address.line2" label="Mailing Address Line 2" value={address.line2} onChange={(line2) => updateAddress({ line2 })} />
          <FormInput id="address.city" label="City" required value={address.city} onChange={(city) => updateAddress({ city })} />
          <FormSelect id="address.state" label="State" required value={address.state} options={US_STATES} onChange={(value) => updateAddress({ state: value })} />
          <FormInput id="address.zip" label="ZIP Code" required mask="zip" value={address.zip} onChange={(zip) => updateAddress({ zip })} />
          <label className="ml-[143px] flex items-center gap-2 text-[10px]"><input type="checkbox" checked={address.poBox} onChange={(event) => updateAddress({ poBox: event.target.checked })} /> P.O. Box or a Military Address</label>
          <FormSelect id="insured.movedRecently" label="Has the insured moved in the last 2 months?" required value={insured.movedRecently} options={YES_NO} onChange={(value) => updateInsured({ movedRecently: value as NamedInsured['movedRecently'] })} hint={fieldHints.movedRecently} />
        </FormSection>
        <FormSection title="Disclosure"><p className="text-[10px] font-bold leading-[1.3]">For phone quote, read the following. If in-person, print and provide to the consumer:</p><p className="text-[10px] leading-[1.35] text-[#59666e]">Like most insurance companies, Progressive uses information from you and other sources, such as your driving, claims and credit histories, to calculate an accurate price for your insurance. New or updated information may be used to calculate your renewal premium. Its Privacy Policy explains how Progressive discloses and protects your personal information and how you may access and correct it.</p><FormSelect id="insured.disclosureAcknowledged" label="Was the above disclosure read or provided to the consumer?" required value={insured.disclosureAcknowledged} options={YES_NO} onChange={(value) => updateInsured({ disclosureAcknowledged: value as NamedInsured['disclosureAcknowledged'] })} hint={fieldHints.disclosure} /></FormSection>
      </div>
    </div>
  </WizardLayout>;
}
