import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { of, throwError } from 'rxjs';
import { ClinicalCodeMappingsComponent } from './clinical-code-mappings.component';
import { ClinicalCodeMappingsService, ClinicalCodeMapping } from 'app/shared/services/clinical-code-mappings.service';
import { PermissionsService } from 'app/shared/permission/permissions.service';
import { SelectedClinicalCode } from 'app/shared/code-picker/clinical-code-picker.component';

function mapping(over: Partial<ClinicalCodeMapping> = {}): ClinicalCodeMapping {
  return {
    clinicalCodeMappingId: 1,
    targetType: 'Category',
    targetId: 10,
    codeSystem: 'ICD10CM',
    code: 'E1165',
    displayCode: 'E11.65',
    shortDescription: null,
    longDescription: 'Type 2 diabetes mellitus with hyperglycemia',
    isBillable: true,
    versionLabel: 'FY2026',
    effectiveDate: '2025-10-01',
    terminationDate: null,
    isInForce: true,
    needsReview: false,
    reviewReason: null,
    isActive: true,
    createdDate: '2026-01-01T00:00:00Z',
    modifiedDate: null,
    ...over,
  };
}

function picked(code: string, displayCode = code): SelectedClinicalCode {
  return {
    codeSystem: 'ICD10CM',
    codeId: 1,
    codeSetVersionId: 7,
    code,
    displayCode,
    description: 'desc',
    isBillable: true,
  };
}

const ok = (data: any, extra: any = {}) => of({ status: 1, data, ...extra });
const failed = (message: string, data: any = undefined) => of({ status: 0, message, data });

describe('ClinicalCodeMappingsComponent', () => {
  let fixture: ComponentFixture<ClinicalCodeMappingsComponent>;
  let component: ClinicalCodeMappingsComponent;
  let api: jasmine.SpyObj<ClinicalCodeMappingsService>;
  let permitted: string[];

  beforeEach(async () => {
    permitted = ['product_view', 'product_category_view', 'product_edit', 'product_category_edit'];

    api = jasmine.createSpyObj<ClinicalCodeMappingsService>('ClinicalCodeMappingsService', [
      'getMappings', 'getMappingsNeedingReview', 'saveMappings', 'refreshReviewFlags',
      'getCategories', 'getServices', 'getPackages',
    ]);

    api.getCategories.and.returnValue(ok([{ categoryId: 10, categoryName: 'Weight loss' }]));
    api.getServices.and.returnValue(ok([{ productId: 20, productName: 'Consult', categoryName: 'Weight loss' }]));
    api.getPackages.and.returnValue(ok([{ bundleId: 30, name: 'Starter pack' }], { totalEntityCount: 1 }));
    api.getMappings.and.returnValue(ok([mapping()]));
    api.getMappingsNeedingReview.and.returnValue(ok([]));
    api.saveMappings.and.returnValue(ok({ success: true, message: 'Saved.', added: 1, removed: 0, unchanged: 1, rejected: [] }));
    api.refreshReviewFlags.and.returnValue(ok({ flagged: 2, cleared: 1 }));

    await TestBed.configureTestingModule({
      declarations: [ClinicalCodeMappingsComponent],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ClinicalCodeMappingsService, useValue: api },
        {
          provide: PermissionsService,
          useValue: { hasAnyPermission: (codes: string[]) => codes.some(c => permitted.includes(c)) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicalCodeMappingsComponent);
    component = fixture.componentInstance;
  });

  it('starts on Category, loads its list and the review queue', () => {
    fixture.detectChanges();

    expect(component.targetType).toBe('Category');
    expect(api.getCategories).toHaveBeenCalledTimes(1);
    expect(component.targets).toEqual([{ id: 10, name: 'Weight loss' }]);
    expect(api.getMappingsNeedingReview).toHaveBeenCalledTimes(1);
    // Nothing is loaded until a target is chosen.
    expect(api.getMappings).not.toHaveBeenCalled();
  });

  it('switches the list when the target type changes, and forgets the old target', () => {
    fixture.detectChanges();
    component.onTargetChange(10);
    expect(component.saved.length).toBe(1);

    component.onTargetTypeChange('Package');

    expect(api.getPackages).toHaveBeenCalledTimes(1);
    expect(component.targetId).toBeNull();
    expect(component.saved).toEqual([]);
    expect(component.selection).toEqual([]);
    expect(component.targets).toEqual([{ id: 30, name: 'Starter pack', hint: null }]);
  });

  it('flattens a Service row onto its category as the hint', () => {
    fixture.detectChanges();
    component.onTargetTypeChange('Service');

    expect(component.targets).toEqual([{ id: 20, name: 'Consult', hint: 'Weight loss' }]);
  });

  it('seeds the picker from the stored mappings, keyed on the code string', () => {
    fixture.detectChanges();
    component.onTargetChange(10);

    expect(api.getMappings).toHaveBeenCalledWith('Category', 10, component.effectiveOnIso);
    expect(component.selection.length).toBe(1);
    expect(component.selection[0]!.code).toBe('E1165');
    // The mapping is keyed on the code, not a row in one release.
    expect(component.selection[0]!.codeSetVersionId).toBe(0);
    expect(component.isDirty).toBeFalse();
  });

  it('is dirty once the picker differs from what is stored', () => {
    fixture.detectChanges();
    component.onTargetChange(10);

    component.onSelectionChange([...component.selection, picked('I10')]);
    expect(component.isDirty).toBeTrue();

    component.revert();
    expect(component.isDirty).toBeFalse();
    expect(component.selection.length).toBe(1);
  });

  it('sends the whole list on save, because the endpoint replaces', () => {
    fixture.detectChanges();
    component.onTargetChange(10);
    component.onSelectionChange([picked('E1165', 'E11.65'), picked('I10')]);

    component.save();

    expect(api.saveMappings).toHaveBeenCalledWith(
      'Category',
      10,
      [{ codeSystem: 'ICD10CM', code: 'E1165' }, { codeSystem: 'ICD10CM', code: 'I10' }],
      component.effectiveOnIso,
    );
    expect(component.saveMessage).toBe('Saved: 1 added, 0 removed, 1 unchanged.');
    // Re-read, so descriptions and review flags come from the server.
    expect(api.getMappings).toHaveBeenCalledTimes(2);
  });

  it('keeps the edits and shows every refusal when the server rejects the save', () => {
    api.saveMappings.and.returnValue(
      failed('One or more codes were refused.', {
        success: false, message: 'One or more codes were refused.',
        added: 0, removed: 0, unchanged: 0,
        rejected: ['E11 is a header code.', 'X999 is not a known code.'],
      }),
    );

    fixture.detectChanges();
    component.onTargetChange(10);
    const edits = [picked('E11'), picked('X999')];
    component.onSelectionChange(edits);

    component.save();

    expect(component.rejected.length).toBe(2);
    expect(component.saveError).toBe('One or more codes were refused.');
    // Nothing was written, so the user's list stays put to be corrected.
    expect(component.selection).toEqual(edits);
    expect(api.getMappings).toHaveBeenCalledTimes(1);
  });

  it('clears a previous refusal as soon as the selection changes', () => {
    fixture.detectChanges();
    component.onTargetChange(10);
    component.rejected = ['E11 is a header code.'];
    component.saveError = 'refused';

    component.onSelectionChange([picked('I10')]);

    expect(component.rejected).toEqual([]);
    expect(component.saveError).toBeNull();
  });

  it('lists only the stored codes that need attention', () => {
    api.getMappings.and.returnValue(ok([
      mapping(),
      mapping({ clinicalCodeMappingId: 2, code: 'E119', isInForce: false, longDescription: null, reviewReason: 'Terminated in FY2026' }),
      mapping({ clinicalCodeMappingId: 3, code: 'I10', needsReview: true, reviewReason: 'Flagged' }),
    ]));

    fixture.detectChanges();
    component.onTargetChange(10);

    expect(component.saved.length).toBe(3);
    expect(component.attention.map(m => m.clinicalCodeMappingId)).toEqual([2, 3]);
    expect(component.statusOf(component.attention[0]!)).toBe('Terminated in FY2026');
    expect(component.statusOf(component.saved[0]!)).toBe('In force');
  });

  it('a code out of force still reaches the picker, labelled', () => {
    api.getMappings.and.returnValue(ok([
      mapping({ isInForce: false, longDescription: null, shortDescription: null }),
    ]));

    fixture.detectChanges();
    component.onTargetChange(10);

    expect(component.selection.length).toBe(1);
    expect(component.selection[0]!.description).toBe('(not in force on this date)');
  });

  it('reloads both halves when the date changes', () => {
    fixture.detectChanges();
    component.onTargetChange(10);
    api.getMappings.calls.reset();
    api.getMappingsNeedingReview.calls.reset();

    component.onDateChange(new Date(2025, 5, 1));

    expect(component.effectiveOnIso).toBe('2025-06-01');
    expect(api.getMappings).toHaveBeenCalledWith('Category', 10, '2025-06-01');
    expect(api.getMappingsNeedingReview).toHaveBeenCalledWith('2025-06-01');
  });

  it('re-checks the flags and reports the counts', () => {
    fixture.detectChanges();
    component.onTargetChange(10);

    component.refreshReviewFlags();

    expect(api.refreshReviewFlags).toHaveBeenCalledWith(component.effectiveOnIso);
    expect(component.reviewMessage).toBe('2 flagged, 1 cleared.');
  });

  it('jumps to the target a review row names, switching type when it differs', () => {
    api.getMappingsNeedingReview.and.returnValue(ok([
      mapping({ clinicalCodeMappingId: 9, targetType: 'Package', targetId: 30, needsReview: true }),
    ]));

    fixture.detectChanges();
    component.openFromReview(component.review[0]!);

    expect(component.targetType).toBe('Package');
    expect(component.targetId).toBe(30);
    expect(api.getPackages).toHaveBeenCalled();
    expect(api.getMappings).toHaveBeenCalledWith('Package', 30, component.effectiveOnIso);
  });

  it('a view-only user gets a read-only picker and no review queue', () => {
    permitted = ['product_view'];

    fixture.detectChanges();
    component.onTargetChange(10);

    expect(component.canEdit).toBeFalse();
    expect(api.getMappingsNeedingReview).not.toHaveBeenCalled();

    component.onSelectionChange([picked('I10')]);
    component.save();
    expect(api.saveMappings).not.toHaveBeenCalled();
  });

  it('reports a failed list load rather than showing an empty one', () => {
    api.getCategories.and.returnValue(failed('Boom'));

    fixture.detectChanges();

    expect(component.targets).toEqual([]);
    expect(component.targetsError).toBe('Boom');
  });

  it('turns a 403 on the mappings read into a permission message', () => {
    api.getMappings.and.returnValue(throwError(() => ({ status: 403 })));

    fixture.detectChanges();
    component.onTargetChange(10);

    expect(component.mappingsError).toBe('You do not have permission to manage code mappings.');
    expect(component.saved).toEqual([]);
  });

  it('says so when the package list was cut short', () => {
    api.getPackages.and.returnValue(ok([{ bundleId: 30, name: 'Starter pack' }], { totalEntityCount: 900 }));

    fixture.detectChanges();
    component.onTargetTypeChange('Package');

    expect(component.targetsTruncated).toBeTrue();
  });
});
