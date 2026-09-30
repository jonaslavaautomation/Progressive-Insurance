import { createContext, useContext } from 'react';
import type { FieldErrors } from '@/utils/validation';

export interface StepValidationState {
  errors: FieldErrors;
  /** Errors only surface after the VA tries to leave the step. */
  show: boolean;
  /** Shows the error summary and highlights (used by RECALCULATE as well as Next). */
  reveal: () => void;
}

export const StepValidationContext = createContext<StepValidationState>({ errors: {}, show: false, reveal: () => undefined });

export function useStepValidation(): StepValidationState {
  return useContext(StepValidationContext);
}

export function useFieldError(id: string | undefined, explicit?: string): string | undefined {
  const { errors, show } = useContext(StepValidationContext);
  if (explicit) return explicit;
  return id && show ? errors[id] : undefined;
}

/** Inline messages drop the "Vehicle 1 (…): " / "Driver Name: " prefix used in the summary box. */
export function inlineMessage(message: string): string {
  const index = message.indexOf(': ');
  return index > 0 && index < 60 ? message.slice(index + 2) : message;
}
