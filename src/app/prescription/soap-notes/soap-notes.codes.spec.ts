import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, flush, tick } from '@angular/core/testing';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SOAPNotesComponent } from './soap-notes.component';
import { GeneralService } from 'app/shared/services/general.service';
import { TitleService } from 'app/shared/services/title.service';
import { AuthService } from 'app/shared/Auth/auth.service';
import { ClinicalCodesService } from 'app/shared/services/clinical-codes.service';
import { SelectedClinicalCode } from 'app/shared/code-picker/clinical-code-picker.component';

/**
 * TEL-22 - the SOAP note screen loads and saves its ICD-10-CM / CPT codes.
 * Covers only the code wiring; the rest of the screen is untouched by TEL-22.
 */
describe('SOAPNotesComponent - TEL-22 codes', () => {
  let fixture: ComponentFixture<SOAPNotesComponent>;
  let component: SOAPNotesComponent;
  let gs: jasmine.SpyObj<GeneralService>;
  let codes: jasmine.SpyObj<ClinicalCodesService>;
  let role: string;

  const note = {
    soapNoteId: 42, patientTreatmentId: 5, subjective: 's', objective: 'o', assessment: 'a', plan: 'p',
    allergiesJson: '[]', signaturePath: null, signature: 'sig', signedBy: 'Dr A', signedAt: null,
    status: 'Saved', createdDate: '2026-03-01T10:00:00',
  };

  const stored = {
    status: 1,
    data: {
      soapNoteId: 42, codingDate: '2026-03-01T00:00:00', canEdit: true,
      codes: [{
        soapNoteCodeId: 1, codeSystem: 'ICD10CM', codeSetVersionId: 7, versionLabel: 'FY2026', codeId: 4413,
        code: 'E1165', displayCode: 'E11.65', description: 'Type 2 diabetes mellitus with hyperglycemia',
        isBillable: true, displayOrder: 1,
      }],
    },
  };

  const i10: SelectedClinicalCode = {
    codeSystem: 'ICD10CM', codeId: 11580, codeSetVersionId: 7, code: 'I10', displayCode: 'I10',
    description: 'Essential (primary) hypertension', isBillable: true,
  };

  function create(soapNoteInput: any) {
    fixture = TestBed.createComponent(SOAPNotesComponent);
    component = fixture.componentInstance;
    component.soapNoteInput = soapNoteInput;
    component.embeddedInTabs = true;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    role = 'Provider';
    gs = jasmine.createSpyObj<GeneralService>('GeneralService', [
      'getTreatmentSoapNoteDetailsById', 'saveTreatmentSoapNote', 'showError', 'showSuccess', 'showInfo', 'uploadSignature',
    ]);
    gs.getTreatmentSoapNoteDetailsById.and.returnValue(of({ status: 1, data: { patientTreatmentId: 5, soapNote: note } }));
    gs.saveTreatmentSoapNote.and.returnValue(of({ status: 1, data: 42, message: 'Saved' }));

    codes = jasmine.createSpyObj<ClinicalCodesService>('ClinicalCodesService', ['getSoapNoteCodes', 'saveSoapNoteCodes', 'searchCodes']);
    codes.getSoapNoteCodes.and.returnValue(of(stored));
    codes.saveSoapNoteCodes.and.returnValue(of({ status: 1, data: { success: true, data: stored.data } }));

    await TestBed.configureTestingModule({
      declarations: [SOAPNotesComponent],
      imports: [ReactiveFormsModule, FormsModule],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '5' }) } } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: GeneralService, useValue: gs },
        { provide: TitleService, useValue: { updateTitle: () => {} } },
        { provide: AuthService, useValue: { getUserRole: () => role, getUserName: () => 'Dr A' } },
        { provide: ClinicalCodesService, useValue: codes },
      ],
    }).compileComponents();
  });

  it('loads the stored codes and uses the note date as the date of service', fakeAsync(() => {
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();

    expect(codes.getSoapNoteCodes).toHaveBeenCalledWith(42);
    expect(component.noteCodes.map(c => c.displayCode)).toEqual(['E11.65']);
    expect(component.noteCodes[0]!.codeSetVersionId).toBe(7);
    expect(component.codingDate).toBe('2026-03-01');
    expect(component.codesReadOnly).toBeFalse();
  }));

  it('is read-only for a user who cannot edit the note', fakeAsync(() => {
    role = 'Clinic Admin';
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();
    expect(component.codesReadOnly).toBeTrue();
  }));

  it('is read-only when the server says the codes cannot be changed', fakeAsync(() => {
    codes.getSoapNoteCodes.and.returnValue(of({ ...stored, data: { ...stored.data, canEdit: false } }));
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();
    expect(component.codesReadOnly).toBeTrue();
  }));

  it('a new note has no codes and is coded against today (UTC)', fakeAsync(() => {
    create(null);
    flush();
    expect(codes.getSoapNoteCodes).not.toHaveBeenCalled();
    expect(component.noteCodes).toEqual([]);
    expect(component.codingDate).toBe(new Date().toISOString().substring(0, 10));
  }));

  it('saves changed codes after the note, with each code\'s release', fakeAsync(() => {
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();
    component.form.patchValue({ subjective: 's', objective: 'o', assessment: 'a', plan: 'p' });

    component.onNoteCodesChange([...component.noteCodes, i10]);
    component.save();
    flush();

    expect(gs.saveTreatmentSoapNote).toHaveBeenCalled();
    expect(codes.saveSoapNoteCodes).toHaveBeenCalledOnceWith(42, [
      { codeSystem: 'ICD10CM', codeSetVersionId: 7, code: 'E1165' },
      { codeSystem: 'ICD10CM', codeSetVersionId: 7, code: 'I10' },
    ]);
    expect(component.codesError).toBeNull();
  }));

  it('does not call the codes API when the codes did not change', fakeAsync(() => {
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();
    component.save();
    flush();
    expect(gs.saveTreatmentSoapNote).toHaveBeenCalled();
    expect(codes.saveSoapNoteCodes).not.toHaveBeenCalled();
  }));

  it('codes picked on a new note are saved once the note has an id', fakeAsync(() => {
    create(null);
    flush();
    component.onNoteCodesChange([i10]);
    component.save();
    flush();
    expect(codes.saveSoapNoteCodes).toHaveBeenCalledOnceWith(42, [{ codeSystem: 'ICD10CM', codeSetVersionId: 7, code: 'I10' }]);
  }));

  it('keeps the picks and reports the server\'s reasons when the codes are rejected', fakeAsync(() => {
    codes.saveSoapNoteCodes.and.returnValue(of({
      status: 0, message: 'The codes were not saved: 1 problem(s). Nothing was changed.',
      data: { success: false, errors: ['E11 is a header code, not a billable diagnosis.'] },
    }));
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();

    component.onNoteCodesChange([i10]);
    component.save();
    flush();
    tick();

    expect(component.codesError).toContain('header code');
    expect(gs.showError).toHaveBeenCalled();
    // The note reload after save must not wipe the unsaved picks.
    expect(component.noteCodes.map(c => c.code)).toEqual(['I10']);
  }));

  it('never saves codes for a read-only user', fakeAsync(() => {
    role = 'Clinic Admin';
    create({ soapNoteId: 42, patientTreatmentId: 5 });
    flush();
    component.onNoteCodesChange([i10]);
    component.save();
    flush();
    expect(codes.saveSoapNoteCodes).not.toHaveBeenCalled();
  }));
});
