import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ClinicalCodeMappingsService } from './clinical-code-mappings.service';
import { HttpService } from './http.service';

describe('ClinicalCodeMappingsService', () => {
  let service: ClinicalCodeMappingsService;
  let get: jasmine.Spy;
  let post: jasmine.Spy;

  beforeEach(() => {
    get = jasmine.createSpy('get').and.returnValue(of({ status: 1, data: [] }));
    post = jasmine.createSpy('post').and.returnValue(of({ status: 1, data: {} }));

    TestBed.configureTestingModule({
      providers: [
        ClinicalCodeMappingsService,
        { provide: HttpService, useValue: { get, post } },
      ],
    });

    service = TestBed.inject(ClinicalCodeMappingsService);
  });

  it('asks for one target’s mappings on a date', () => {
    service.getMappings('Service', 42, '2026-01-01').subscribe();

    expect(get).toHaveBeenCalledWith(
      'ClinicalCodeMappings/getMappings?targetType=Service&targetId=42&onDate=2026-01-01',
    );
  });

  it('leaves the date and the inactive flag off when they are not set', () => {
    service.getMappings('Category', 1).subscribe();

    expect(get).toHaveBeenCalledWith('ClinicalCodeMappings/getMappings?targetType=Category&targetId=1');
  });

  it('asks for removed mappings when told to', () => {
    service.getMappings('Package', 3, null, true).subscribe();

    expect(get).toHaveBeenCalledWith(
      'ClinicalCodeMappings/getMappings?targetType=Package&targetId=3&includeInactive=true',
    );
  });

  it('posts the whole code list to saveMappings', () => {
    service
      .saveMappings('Category', 10, [{ codeSystem: 'ICD10CM', code: 'E1165' }], '2026-01-01')
      .subscribe();

    expect(post).toHaveBeenCalledWith('ClinicalCodeMappings/saveMappings', {
      targetType: 'Category',
      targetId: 10,
      codes: [{ codeSystem: 'ICD10CM', code: 'E1165' }],
      onDate: '2026-01-01',
    });
  });

  it('sends a null date rather than leaving the field out', () => {
    service.saveMappings('Category', 10, []).subscribe();

    expect(post).toHaveBeenCalledWith(
      'ClinicalCodeMappings/saveMappings',
      jasmine.objectContaining({ onDate: null, codes: [] }),
    );
  });

  it('reads and rebuilds the review queue', () => {
    service.getMappingsNeedingReview('2026-01-01').subscribe();
    expect(get).toHaveBeenCalledWith('ClinicalCodeMappings/getMappingsNeedingReview?onDate=2026-01-01');

    service.refreshReviewFlags('2026-01-01').subscribe();
    expect(post).toHaveBeenCalledWith('ClinicalCodeMappings/refreshReviewFlags?onDate=2026-01-01', {});
  });

  it('reads the three target lists through HttpService', () => {
    service.getCategories().subscribe();
    service.getServices().subscribe();
    service.getPackages(50).subscribe();

    expect(get).toHaveBeenCalledWith('DropDowns/getAllCategories');
    expect(get).toHaveBeenCalledWith('Dropdowns/getAllProducts');
    expect(get).toHaveBeenCalledWith('Products/getAllBundles?PageNumber=1&PageSize=50');
  });
});
