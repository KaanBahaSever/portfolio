/**
 * Messages between the page and the factorization worker. BigInts travel as decimal strings,
 * so the protocol does not depend on structured-clone support for BigInt.
 */

export interface FactorRequest {
  type: 'factor';
  id: number;
  /** The values whose product to factor: [|n|] for a new number, or the cofactors left over. */
  values: string[];
  /** The search stops after this long and reports what it could not split. */
  timeLimitMs: number;
}

export interface FactorProgressMessage {
  type: 'progress';
  id: number;
  /** Prime factors found so far (with multiplicity). */
  found: number;
  /** Digits of the cofactor being split now. */
  digits: number;
  elapsedMs: number;
}

export interface FactorDoneMessage {
  type: 'done';
  id: number;
  factors: Array<[prime: string, exponent: number]>;
  unfactored: string[];
  probable: string[];
  elapsedMs: number;
}

export interface FactorErrorMessage {
  type: 'error';
  id: number;
  message: string;
}

export type ToFactorWorker = FactorRequest;
export type FromFactorWorker = FactorProgressMessage | FactorDoneMessage | FactorErrorMessage;
