import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { HttpService } from './http.service';
import { ClinicalCodeSystem } from './clinical-codes.service';

/**
 * What a mapping can hang off. Mirrors `ClinicalCodeTargetType` on the server,
 * which resolves each one to an existing table:
 *
 * | Here      | Table         | Key          |
 * |-----------|---------------|--------------|
 * | Category  | `PD_Category` | `CategoryId` |
 * | Service   | `SYS_Product` | `ProductId`  |
 * | Package   | `PD_Bundle`   | `BundleId`   |
 */
export type CodeMappingTargetType = 'Category' | 'Service' | 'Package';

/** One code as the save endpoint names it. The dot is optional; the server normalises. */
export interface ClinicalCodeRef {
  codeSystem: ClinicalCodeSystem;
  code: string;
}

/**
 * One stored mapping, resolved against the release in force on the requested date.
 * Mirrors `ClinicalCodeMappingDTO`.
 *
 * A code that is no longer in force still comes back, with `isInForce` false and the
 * description fields null, so an administrator sees it rather than losing it silently.
 */
export interface ClinicalCodeMapping {
  clinicalCodeMappingId: number;
  targetType: CodeMappingTargetType;
  targetId: number;
  codeSystem: ClinicalCodeSystem;
  /** Normalised, without the dot: 'E1165'. */
  code: string;
  /** For display: 'E11.65'. CPT codes are identical either way. */
  displayCode: string;
  shortDescription: string | null;
  longDescription: string | null;
  /** ICD-10-CM only. A header code such as 'E11' is not valid on a claim. */
  isBillable: boolean | null;
  versionLabel: string | null;
  effectiveDate: string | null;
  terminationDate: string | null;
  /** False when no release in force on the requested date carries this code. */
  isInForce: boolean;
  needsReview: boolean;
  reviewReason: string | null;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string | null;
}

/** Mirrors `SaveClinicalCodeMappingsResultDTO`. */
export interface SaveClinicalCodeMappingsResult {
  success: boolean;
  message: string;
  added: number;
  removed: number;
  unchanged: number;
  /** Why the request was refused. Nothing is written when this is non-empty. */
  rejected: string[];
}

/** Mirrors `RefreshClinicalCodeReviewFlagsResultDTO`. */
export interface RefreshReviewFlagsResult {
  flagged: number;
  cleared: number;
}

/** One selectable Category, Service or Package, flattened from the list endpoints. */
export interface CodeMappingTarget {
  id: number;
  name: string;
  /** Shown under the name, e.g. the category a service belongs to. */
  hint?: string | null;
}

/**
 * TEL-22 (criterion 3) - the administration screen's data access, over the TEL-20
 * `api/ClinicalCodeMappings` endpoints plus the three lists of things a mapping can
 * hang off.
 *
 * Everything goes through `HttpService`, as TEL-22 requires, rather than
 * `GeneralService` or `HttpClient`.
 *
 * Nothing here is a security boundary: `[AuthorizeRoles]` and `[RequiresPermission]`
 * on the server decide who may read and write. The screen hides what the caller
 * cannot do so the buttons are not simply 403s.
 */
@Injectable({ providedIn: 'root' })
export class ClinicalCodeMappingsService {
  constructor(private http: HttpService) {}

  // ---- mappings

  /** Resolves to the `ApiResponse` envelope; `data` is a `ClinicalCodeMapping[]`. */
  getMappings(
    targetType: CodeMappingTargetType,
    targetId: number,
    onDate?: string | null,
    includeInactive = false,
  ): Observable<any> {
    const params: string[] = [
      `targetType=${encodeURIComponent(targetType)}`,
      `targetId=${encodeURIComponent(String(targetId))}`,
    ];
    if (onDate) params.push(`onDate=${encodeURIComponent(onDate)}`);
    if (includeInactive) params.push('includeInactive=true');

    return this.http.get(`ClinicalCodeMappings/getMappings?${params.join('&')}`);
  }

  /**
   * Every mapping flagged for review - the queue a code-set import leaves behind when
   * it terminates a code that was already mapped. `data` is a `ClinicalCodeMapping[]`.
   */
  getMappingsNeedingReview(onDate?: string | null): Observable<any> {
    const query = onDate ? `?onDate=${encodeURIComponent(onDate)}` : '';
    return this.http.get(`ClinicalCodeMappings/getMappingsNeedingReview${query}`);
  }

  /**
   * Replaces the complete set of codes on one target: codes left out are removed.
   * All-or-nothing on the server - one unknown or out-of-force code refuses the whole
   * request and nothing is written, with the reasons in `data.rejected`.
   */
  saveMappings(
    targetType: CodeMappingTargetType,
    targetId: number,
    codes: ClinicalCodeRef[],
    onDate?: string | null,
  ): Observable<any> {
    return this.http.post('ClinicalCodeMappings/saveMappings', {
      targetType,
      targetId,
      codes,
      onDate: onDate ?? null,
    });
  }

  /** Re-evaluates every mapping against the releases in force on the date. */
  refreshReviewFlags(onDate?: string | null): Observable<any> {
    const query = onDate ? `?onDate=${encodeURIComponent(onDate)}` : '';
    return this.http.post(`ClinicalCodeMappings/refreshReviewFlags${query}`, {});
  }

  // ---- the things a mapping can hang off
  //
  // These are the app's existing lists; TEL-20 added no endpoint for them. They are
  // wrapped here so the screen has one place to ask and still goes through
  // HttpService.

  /** Categories - `PD_Category`. */
  getCategories(): Observable<any> {
    return this.http.get('DropDowns/getAllCategories');
  }

  /** Services - `SYS_Product`. */
  getServices(): Observable<any> {
    return this.http.get('Dropdowns/getAllProducts');
  }

  /**
   * Packages - `PD_Bundle`. There is no unpaged bundle list that does not need a
   * facility, so this asks for one large page and the caller checks
   * `totalEntityCount` to see whether anything was left off.
   */
  getPackages(pageSize = 500): Observable<any> {
    return this.http.get(`Products/getAllBundles?PageNumber=1&PageSize=${encodeURIComponent(String(pageSize))}`);
  }
}
