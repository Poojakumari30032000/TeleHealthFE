import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http.service';

/** The code systems the API accepts. Mirrors ClinicalCodeSystem on the server. */
export type ClinicalCodeSystem = 'ICD10CM' | 'CPT';

/** One search hit. Mirrors ClinicalCodeSearchItemDTO. */
export interface ClinicalCodeSearchItem {
  codeId: number;
  codeSetVersionId: number;
  /** As stored, without the dot: 'E1165'. */
  code: string;
  /** As people write it: 'E11.65'. Equal to `code` for CPT. */
  displayCode: string;
  shortDescription: string | null;
  longDescription: string;
  /** False for ICD-10-CM header (category) codes, which are not valid on a claim. */
  isBillable: boolean;
  effectiveDate: string;
  terminationDate: string | null;
  /** 0 exact code ... 5 all words somewhere in the description. */
  matchRank: number;
}

/** Mirrors SearchClinicalCodesResultDTO. */
export interface ClinicalCodeSearchResult {
  codeSystem: ClinicalCodeSystem;
  /** The release searched - the one in force on `onDate`. Null when none was. */
  codeSetVersionId: number | null;
  versionLabel: string | null;
  onDate: string;
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  items: ClinicalCodeSearchItem[];
}

export interface ClinicalCodeSearchRequest {
  query: string;
  codeSystem?: ClinicalCodeSystem;
  /** yyyy-MM-dd. Only codes in force on this date are returned. Defaults to today on the server. */
  onDate?: string | null;
  billableOnly?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

/** One code stored on a treatment SOAP note. Mirrors SoapNoteCodeDTO. */
export interface SoapNoteCode {
  soapNoteCodeId: number;
  codeSystem: ClinicalCodeSystem;
  /** The release the code was coded against. */
  codeSetVersionId: number;
  versionLabel: string | null;
  codeId: number;
  code: string;
  displayCode: string;
  description: string;
  isBillable: boolean;
  /** 1 is the primary code. */
  displayOrder: number;
}

/** Mirrors SoapNoteCodesDTO. */
export interface SoapNoteCodes {
  soapNoteId: number;
  /** The date the note's codes must be in force on (its created date). Use as the picker's date of service. */
  codingDate: string;
  /** Whether the server lets this caller change the codes. */
  canEdit: boolean;
  codes: SoapNoteCode[];
}

/** One code to store, as picked. Mirrors SoapNoteCodeItemRequestDTO. */
export interface SoapNoteCodeItem {
  codeSystem: ClinicalCodeSystem;
  codeSetVersionId: number;
  code: string;
}

/**
 * TEL-22 - ICD-10-CM / CPT code search (TEL-21, `GET api/ClinicalCodes/searchCodes`)
 * and the codes stored on a treatment SOAP note.
 *
 * Goes through `HttpService`, as TEL-22 requires, rather than `GeneralService` or
 * `HttpClient`. The server enforces who may search (staff roles plus
 * `treatment_patient_edit` / `treatment_update`); nothing here is a security boundary.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalCodesService {
  constructor(private http: HttpService) {}

  /**
   * Resolves to the raw `ApiResponse` envelope: `status` is 1 and `data` is a
   * `ClinicalCodeSearchResult` on success, `status` is 0 with a `message` otherwise.
   */
  searchCodes(request: ClinicalCodeSearchRequest): Observable<any> {
    const params: string[] = [`query=${encodeURIComponent(request.query ?? '')}`];
    if (request.codeSystem) params.push(`codeSystem=${request.codeSystem}`);
    if (request.onDate) params.push(`onDate=${encodeURIComponent(request.onDate)}`);
    if (request.billableOnly) params.push('billableOnly=true');
    if (request.pageNumber) params.push(`pageNumber=${request.pageNumber}`);
    if (request.pageSize) params.push(`pageSize=${request.pageSize}`);

    return this.http.get(`ClinicalCodes/searchCodes?${params.join('&')}`);
  }

  /** Resolves to the `ApiResponse` envelope; `data` is a `SoapNoteCodes`. */
  getSoapNoteCodes(soapNoteId: number): Observable<any> {
    return this.http.get(`ClinicalCodes/getSoapNoteCodes?id=${encodeURIComponent(String(soapNoteId))}`);
  }

  /**
   * Replaces every code on the note with `codes`, in that order; an empty list
   * clears them. All-or-nothing on the server. On failure `status` is 0 and
   * `data.errors` lists each rejected code; on success `data.data` is the
   * note's `SoapNoteCodes`.
   */
  saveSoapNoteCodes(soapNoteId: number, codes: SoapNoteCodeItem[]): Observable<any> {
    return this.http.post('ClinicalCodes/saveSoapNoteCodes', { soapNoteId, codes });
  }
}
