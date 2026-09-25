import { ComponentFixture, TestBed, fakeAsync, tick, flush } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ClinicalCodePickerComponent, SelectedClinicalCode } from './clinical-code-picker.component';
import { ClinicalCodesService, ClinicalCodeSearchItem } from 'app/shared/services/clinical-codes.service';
import { HttpService } from 'app/shared/services/http.service';
import { PermissionsService } from 'app/shared/permission/permissions.service';

function item(code: string, displayCode: string, description: string, isBillable = true): ClinicalCodeSearchItem {
  return {
    codeId: code.length,
    codeSetVersionId: 7,
    code,
    displayCode,
    shortDescription: null,
    longDescription: description,
    isBillable,
    effectiveDate: '2025-10-01',
    terminationDate: '2026-09-30',
    matchRank: 0,
  };
}

function ok(items: ClinicalCodeSearchItem[], totalCount = items.length, codeSetVersionId: number | null = 7) {
  return of({
    status: 1,
    data: {
      codeSystem: 'ICD10CM', codeSetVersionId, versionLabel: 'FY2026', onDate: '2026-01-01',
      pageNumber: 1, pageSize: 20, totalCount, items,
    },
  });
}

describe('ClinicalCodePickerComponent', () => {
  let fixture: ComponentFixture<ClinicalCodePickerComponent>;
  let component: ClinicalCodePickerComponent;
  let search: jasmine.Spy;
  let allowed: boolean;

  const e1165 = item('E1165', 'E11.65', 'Type 2 diabetes mellitus with hyperglycemia');
  const e11 = item('E11', 'E11', 'Type 2 diabetes mellitus', false);

  beforeEach(async () => {
    allowed = true;
    search = jasmine.createSpy('searchCodes').and.returnValue(ok([e1165, e11], 117));

    await TestBed.configureTestingModule({
      imports: [ClinicalCodePickerComponent, NoopAnimationsModule],
      providers: [
        { provide: ClinicalCodesService, useValue: { searchCodes: search } },
        { provide: PermissionsService, useValue: { hasAnyPermission: (codes: string[]) => allowed && codes.includes('treatment_patient_edit') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClinicalCodePickerComponent);
    component = fixture.componentInstance;
  });

  function init(setup?: (c: ClinicalCodePickerComponent) => void) {
    setup?.(component);
    fixture.detectChanges();
  }

  it('debounces typing into one search for the last term', fakeAsync(() => {
    init(c => { c.onDate = '2026-01-01'; });
    component.onSearch('e1');
    tick(100);
    component.onSearch('e11');
    tick(100);
    component.onSearch('e11.6');
    tick(300);

    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith(jasmine.objectContaining({
      query: 'e11.6', codeSystem: 'ICD10CM', onDate: '2026-01-01', billableOnly: true, pageSize: 20,
    }));
    expect(component.state.items.length).toBe(2);
    expect(component.state.totalCount).toBe(117);
    flush();
  }));

  it('does not search below two characters', fakeAsync(() => {
    init();
    component.onSearch(' e ');
    tick(300);
    expect(search).not.toHaveBeenCalled();
    expect(component.state.loading).toBeFalse();
    flush();
  }));

  it('adds a picked code with its code, description and release, once', fakeAsync(() => {
    init();
    const emitted: SelectedClinicalCode[][] = [];
    component.selectedChange.subscribe(v => emitted.push(v));

    component.onSearch('diab');
    tick(300);
    component.onPick('ICD10CM:E1165');
    component.onPick('ICD10CM:E1165');
    flush();

    expect(component.selection).toEqual([{
      codeSystem: 'ICD10CM', codeId: e1165.codeId, codeSetVersionId: 7, code: 'E1165',
      displayCode: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia', isBillable: true,
    }]);
    expect(emitted.length).toBe(1);
    expect(component.pickValue).toBeNull();

    fixture.detectChanges();
    const row: HTMLElement = fixture.nativeElement.querySelector('li');
    expect(row.textContent).toContain('E11.65');
    expect(row.textContent).toContain('Type 2 diabetes mellitus with hyperglycemia');
  }));

  it('allows several selections and removing one', fakeAsync(() => {
    init();
    component.onSearch('diab');
    tick(300);
    component.onPick('ICD10CM:E1165');
    component.onPick('ICD10CM:E11');
    flush();
    expect(component.selection.map(c => c.code)).toEqual(['E1165', 'E11']);

    component.remove(component.selection[0]!);
    expect(component.selection.map(c => c.code)).toEqual(['E11']);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Header - not billable');
  }));

  it('stops adding at maxSelections', fakeAsync(() => {
    init(c => { c.maxSelections = 1; });
    component.onSearch('diab');
    tick(300);
    component.onPick('ICD10CM:E1165');
    component.onPick('ICD10CM:E11');
    flush();
    expect(component.selection.length).toBe(1);
    expect(component.atLimit).toBeTrue();
  }));

  it('switching code system re-searches that system', fakeAsync(() => {
    init();
    component.onSearch('9921');
    tick(300);
    expect(search.calls.mostRecent().args[0].codeSystem).toBe('ICD10CM');

    search.and.returnValue(ok([], 0, null));
    component.onSystemChange('CPT');
    component.onSearch('9921');
    tick(300);

    expect(search.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ query: '9921', codeSystem: 'CPT' }));
    // CPT has no release loaded until licensed; the user is told why nothing is found.
    expect(component.state.error).toContain('CPT');
    flush();
  }));

  it('shows the server message when the search fails', fakeAsync(() => {
    search.and.returnValue(of({ status: 0, message: 'Enter at least 2 characters to search.' }));
    init();
    component.onSearch('zz');
    tick(300);
    expect(component.state.error).toBe('Enter at least 2 characters to search.');
    flush();
  }));

  it('turns a 403 into a permission message', fakeAsync(() => {
    search.and.returnValue(throwError(() => ({ status: 403 })));
    init();
    component.onSearch('zz');
    tick(300);
    expect(component.state.error).toContain('permission');
    flush();
  }));

  it('renders a notice instead of the search box without permission', () => {
    allowed = false;
    init();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('nz-select')).toBeNull();
    expect(el.textContent).toContain('You do not have permission');
  });

  it('works as a form control', fakeAsync(() => {
    init();
    const changes: SelectedClinicalCode[][] = [];
    component.registerOnChange(v => changes.push(v));

    const existing: SelectedClinicalCode = {
      codeSystem: 'ICD10CM', codeId: 1, codeSetVersionId: 6, code: 'I10', displayCode: 'I10',
      description: 'Essential (primary) hypertension', isBillable: true,
    };
    component.writeValue([existing]);
    component.onSearch('diab');
    tick(300);
    component.onPick('ICD10CM:E1165');
    flush();

    expect(changes.length).toBe(1);
    expect(changes[0]!.map(c => c.code)).toEqual(['I10', 'E1165']);

    component.setDisabledState(true);
    component.remove(existing);
    expect(component.selection.length).toBe(2);
  }));

  it('formats a Date onDate as yyyy-MM-dd', fakeAsync(() => {
    init(c => { c.onDate = new Date(2025, 5, 1); });
    component.onSearch('diab');
    tick(300);
    expect(search.calls.mostRecent().args[0].onDate).toBe('2025-06-01');
    flush();
  }));
});

describe('ClinicalCodesService', () => {
  it('calls searchCodes through HttpService with encoded parameters', () => {
    const http = { get: jasmine.createSpy('get').and.returnValue(of({})) };
    TestBed.configureTestingModule({ providers: [ClinicalCodesService, { provide: HttpService, useValue: http }] });
    const service = TestBed.inject(ClinicalCodesService);

    service.searchCodes({ query: 'type 2 & diab', codeSystem: 'ICD10CM', onDate: '2026-01-01', billableOnly: true, pageSize: 20 }).subscribe();

    expect(http.get).toHaveBeenCalledWith(
      'ClinicalCodes/searchCodes?query=type%202%20%26%20diab&codeSystem=ICD10CM&onDate=2026-01-01&billableOnly=true&pageSize=20');
  });
});
