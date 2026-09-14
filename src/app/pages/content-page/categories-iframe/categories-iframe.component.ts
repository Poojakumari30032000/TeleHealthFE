import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { GeneralService } from 'app/shared/services/general.service';

@Component({
  selector: 'app-categories-iframe',
  templateUrl: './categories-iframe.component.html',
  styleUrl: './categories-iframe.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoriesIframeComponent implements OnInit {

  facilityId: any = null;

  step: 'categories' | 'detail' = 'categories';

  categories: any[] = [];
  selectedCategory: any = null;

  constructor(
    private route: ActivatedRoute,
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {

    this.route.params.subscribe(params => {
      this.facilityId = Number(params['clinicId']);
    });

    this.generalService.getCategoriesWithBundlesByFacilityId(this.facilityId).subscribe({
      next:(res)=>{
        console.log(res)
        this.categories = res.data
        this.cdr.markForCheck()

      },
      error:(err)=>{
        console.log(err)
      }
    })
  }

  goBack(to: typeof this.step) {
    this.step = to;
  }

  selectCategory(type: any) {
    this.selectedCategory = type;
    this.step = 'detail';
  }

}
