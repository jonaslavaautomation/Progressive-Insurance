import { useState } from 'react';
import { UserRound } from 'lucide-react';
import type { Driver, DriverStatus, Incident, YesNo } from '@/types/quote';
import { DRIVER_STATUSES, EDUCATION_LEVELS, EMPLOYMENT, GENDERS, INCIDENT_CODES, INTERNATIONAL_YEARS, LICENSE_STATUSES, LICENSE_TYPES, MARITAL_STATUSES, OCCUPATIONS, OPERATOR_TYPES, RELATIONSHIPS, SUFFIXES, US_STATES, YES_NO } from '@/data/options';
import { fieldHints } from '@/data/trainingHints';
import { useQuote } from '@/context/useQuote';
import { ageOn, ratingDate } from '@/utils/dates';
import { driverName, vehicleLabel } from '@/utils/ratingEngine';
import { isLicensed, monthsLicensed } from '@/utils/validation';
import { WizardLayout } from '@/components/wizard/WizardLayout';
import { AddButton, RemoveButton, WizardCard, WizardField, WizardRadio, WizardSelect } from '@/components/wizard/primitives';

const incidentOptions = INCIDENT_CODES.map(({ value, label }) => ({ value, label: `${value} - ${label}` }));

function IncidentRows({ driver }: { driver: Driver }) {
  const { addIncident, updateIncident, removeIncident } = useQuote();
  const set = (incident: Incident, patch: Partial<Incident>) => updateIncident(driver.id, incident.id, patch);
  const next = driver.incidents.length + 1;
  return <>
    {driver.incidents.map((incident, n) => <div key={incident.id}>
      <WizardSelect id={`incident.${incident.id}.code`} narrow label={`Incident Code # ${n + 1}:`} hint={n === 0 ? fieldHints.incidents : undefined} options={incidentOptions} value={incident.code} onChange={(code) => set(incident, { code })} after={<RemoveButton label={`Remove incident ${n + 1}`} onClick={() => removeIncident(driver.id, incident.id)} />} />
      <WizardField id={`incident.${incident.id}.date`} narrow label={`Incident Date # ${n + 1}:`} placeholder="MM/DD/YYYY" mask="date" value={incident.date} onChange={(date) => set(incident, { date })} />
    </div>)}
    {/* Trailing blank row: entering a code or date adds the incident, matching the carrier's inline entry. */}
    <WizardSelect narrow label={`Incident Code # ${next}:`} hint={next === 1 ? fieldHints.incidents : undefined} options={incidentOptions} value="" onChange={(code) => code && addIncident(driver.id, { code })} after={<RemoveButton label="Clear incident" onClick={() => undefined} />} />
    <WizardField narrow label={`Incident Date # ${next}:`} placeholder="MM/DD/YYYY" mask="date" value="" onChange={(date) => date && addIncident(driver.id, { date })} />
  </>;
}

export function HouseholdStep() {
  const { state, addDriver, updateDriver, removeDriver } = useQuote();
  const { drivers, vehicles, policy } = state;
  const [activeId, setActiveId] = useState(drivers[0].id);
  const driver = drivers.find((entry) => entry.id === activeId) ?? drivers[0];
  const index = drivers.indexOf(driver);
  const isInsured = index === 0;
  const id = (field: keyof Driver) => `driver.${driver.id}.${field}`;
  const set = (patch: Partial<Driver>) => updateDriver(driver.id, patch);
  const name = driverName(driver);

  const age = ageOn(driver.dob, ratingDate(policy.effectiveDate));
  const licensed = isLicensed(driver);
  const months = monthsLicensed(driver, policy.effectiveDate);
  const monthsLabel = months === null ? '' : months >= 36 ? '36+ Months' : `${months} Months`;
  const youthful = age !== null && age < 25;
  const vehicleOptions = vehicles.map((vehicle, i) => ({ value: vehicle.id, label: vehicleLabel(vehicle, i) }));
  const occupations = OCCUPATIONS[driver.employment] ?? [];

  const setEmployment = (employment: string) => {
    const options = OCCUPATIONS[employment] ?? [];
    set({ employment, occupation: options.length === 1 ? options[0] : '' });
  };
  const setAge = (dob: string) => {
    const nextAge = ageOn(dob, ratingDate(policy.effectiveDate));
    // Student discounts only apply to drivers under 25.
    set(nextAge !== null && nextAge >= 25 ? { dob, distantStudent: 'No', goodStudent: 'No' } : { dob });
  };
  const add = () => setActiveId(addDriver());
  const remove = () => {
    removeDriver(driver.id);
    setActiveId(drivers[index - 1].id);
  };
  const revealField = (fieldId: string) => {
    const [kind, entityId] = fieldId.split('.');
    if (kind === 'driver' && drivers.some((entry) => entry.id === entityId)) setActiveId(entityId);
    if (kind === 'incident') {
      const owner = drivers.find((entry) => entry.incidents.some((incident) => incident.id === entityId));
      if (owner) setActiveId(owner.id);
    }
  };

  return <WizardLayout onRevealField={revealField}>
    <div className="flex items-start gap-[20px]">
      <div className="w-[450px] shrink-0 space-y-[20px]">
        <WizardCard title="Household Members" subtitle={<>{name}<br />{index + 1} of {drivers.length}</>} onRemove={remove} removeDisabled={isInsured} removeLabel={`Remove ${name}`}>
          <WizardField id={id('firstName')} label="First Name:*" value={driver.firstName} onChange={(firstName) => set({ firstName })} />
          <WizardField id={id('middleInitial')} label="Middle Initial:" value={driver.middleInitial} onChange={(value) => set({ middleInitial: value.slice(-1).toUpperCase() })} />
          <WizardField id={id('lastName')} label="Last Name:*" value={driver.lastName} onChange={(lastName) => set({ lastName })} />
          <WizardSelect id={id('suffix')} label="Suffix:" options={SUFFIXES} value={driver.suffix} onChange={(suffix) => set({ suffix })} />
          <WizardSelect id={id('maritalStatus')} label="Marital Status:*" hint={fieldHints.maritalStatus} options={MARITAL_STATUSES} value={driver.maritalStatus} onChange={(maritalStatus) => set({ maritalStatus })} />
          {isInsured ? <WizardField id={id('relationship')} label="Relationship:*" help hint={fieldHints.relationship} disabled value={driver.relationship} /> : <WizardSelect id={id('relationship')} label="Relationship:*" help hint={fieldHints.relationship} options={RELATIONSHIPS} value={driver.relationship} onChange={(relationship) => set({ relationship })} />}
        </WizardCard>
        <WizardCard title="Additional Info" subtitle={name}>
          <WizardField id={id('dob')} label="Date of Birth:*" placeholder="MM/DD/YYYY" mask="date" value={driver.dob} onChange={setAge} />
          <WizardField id={id('ssn')} label="Social Security Number:" placeholder="XXX-XX-XXXX" mask="ssn" value={driver.ssn} onChange={(ssn) => set({ ssn })} />
          <WizardSelect id={id('gender')} label="Gender:*" options={GENDERS} value={driver.gender} onChange={(gender) => set({ gender })} />
          <WizardSelect id={id('education')} label="Highest Level of Education:*" options={EDUCATION_LEVELS} value={driver.education} onChange={(education) => set({ education })} />
          <WizardSelect id={id('employment')} label="Employment:*" options={EMPLOYMENT} value={driver.employment} onChange={setEmployment} />
          <WizardSelect id={id('occupation')} label="Occupation:*" disabled={!driver.employment} options={occupations} value={driver.occupation} onChange={(occupation) => set({ occupation })} />
          <WizardSelect id={id('driverStatus')} label="Auto Driver Status:*" help hint={fieldHints.driverStatus} options={DRIVER_STATUSES} value={driver.driverStatus} onChange={(driverStatus) => set({ driverStatus: driverStatus as DriverStatus })} />
          <WizardSelect id={id('licenseType')} label="Driver License Type:*" options={LICENSE_TYPES} value={driver.licenseType} onChange={(licenseType) => set(licenseType === 'Not Licensed' ? { licenseType, licenseStatus: '', licenseNumber: '', ageFirstLicensed: '', previousLicenseState: '', internationalYears: '' } : { licenseType })} />
          <WizardSelect id={id('licenseStatus')} label="Driver License Status:*" hint={fieldHints.licenseStatus} disabled={!licensed} options={LICENSE_STATUSES} value={driver.licenseStatus} onChange={(licenseStatus) => set({ licenseStatus })} />
          <WizardSelect id={id('licenseState')} label="License State:*" help disabled={!licensed || !driver.licenseStatus} options={US_STATES} value={driver.licenseState} onChange={(licenseState) => set({ licenseState })} />
          <WizardField id={id('licenseNumber')} label="License Number:" disabled={!licensed || !driver.licenseStatus} value={driver.licenseNumber} onChange={(licenseNumber) => set({ licenseNumber: licenseNumber.toUpperCase().slice(0, 16) })} />
          <WizardSelect id={id('previousLicenseState')} label="Previous License State:*" help hint={fieldHints.previousLicenseState} disabled={!licensed || months === null || months >= 36} options={US_STATES} value={driver.previousLicenseState} onChange={(previousLicenseState) => set({ previousLicenseState })} />
          <WizardRadio id={id('stateFiling')} label="State Filing:*" name={`filing-${driver.id}`} help hint={fieldHints.stateFiling} value={driver.stateFiling} onChange={(stateFiling) => set({ stateFiling })} />
        </WizardCard>
        <WizardCard title="Auto Drivers" subtitle={name}>
          {isInsured ? <WizardField id={id('operatorType')} label="Principal/Occasional Operator:*" help disabled value={driver.operatorType} /> : <WizardSelect id={id('operatorType')} label="Principal/Occasional Operator:*" help options={OPERATOR_TYPES} value={driver.operatorType} onChange={(operatorType) => set({ operatorType })} />}
          <WizardField id={id('ageFirstLicensed')} label="Age First Licensed (in the U.S., Canada or Puerto Rico):*" help hint={fieldHints.ageFirstLicensed} disabled={!licensed} mask="digits" value={driver.ageFirstLicensed} onChange={(ageFirstLicensed) => set({ ageFirstLicensed })} />
          <WizardField label="Months Licensed:*" help disabled value={licensed ? monthsLabel : ''} />
          <WizardSelect id={id('internationalYears')} label="International Years Licensed:*" help hint={fieldHints.internationalYears} disabled={!licensed} options={INTERNATIONAL_YEARS} value={driver.internationalYears} onChange={(internationalYears) => set({ internationalYears })} />
          <WizardSelect id={id('primaryVehicleId')} label="Primary Vehicle Driven:*" disabled={vehicles.length === 1 || driver.driverStatus !== 'Rated'} options={vehicleOptions} value={vehicles.length === 1 ? vehicles[0].id : driver.primaryVehicleId} onChange={(primaryVehicleId) => set({ primaryVehicleId })} />
          {youthful ? <WizardSelect id={id('distantStudent')} label="Distant Student:*" tag options={YES_NO} value={driver.distantStudent} onChange={(distantStudent) => set({ distantStudent: distantStudent as YesNo })} /> : <WizardField label="Distant Student:*" tag disabled value={driver.distantStudent} />}
          {youthful ? <WizardSelect id={id('goodStudent')} label="Good Student:*" tag options={YES_NO} value={driver.goodStudent} onChange={(goodStudent) => set({ goodStudent: goodStudent as YesNo })} /> : <WizardField label="Good Student:*" tag disabled value={driver.goodStudent} />}
        </WizardCard>
        <WizardCard title="Accidents / Violations" titleHelp={fieldHints.incidents} subtitle={name}><IncidentRows driver={driver} /></WizardCard>
      </div>
      <WizardCard title="Household Members" split={false} className="w-[280px] shrink-0">
        {drivers.length > 1 && <ul>{drivers.map((entry) => <li key={entry.id}><button type="button" onClick={() => setActiveId(entry.id)} className={`flex w-full items-center gap-2 border-b border-[#edf1f3] px-[21px] py-[11px] text-left text-[14px] text-[#003865] hover:bg-[#e8f4fa] ${entry.id === driver.id ? 'bg-[#eef3f6] font-bold' : ''}`}><UserRound size={18} strokeWidth={1.6} /><span className="flex-1">{driverName(entry)}</span><span className="text-[11px] font-medium text-[#5c6670]">{entry.relationship || 'Member'} · {entry.driverStatus || '—'}</span></button></li>)}</ul>}
        <AddButton label="ADD MORE PEOPLE" onClick={add} />
      </WizardCard>
    </div>
  </WizardLayout>;
}
