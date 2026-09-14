import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  HostListener,
  Input,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { GeneralService } from '../services/general.service';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { Subject, takeUntil } from 'rxjs';
import { getUnifiedStatusBadgeClass } from '../utils/status-badge.util';

interface BadgeMapping {
  [key: string]: BadgeOption;
}

interface BadgeOption {
  class: string;
  label?: string;
}

@Component({
  selector: 'app-dynamic-table',
  templateUrl: './dynamic-table.component.html',
  styleUrl: './dynamic-table.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DynamicTableComponent implements OnChanges {
  @Input() apiEndpoint!: string;
  @Input() filters: { name: string; value: any }[] = [];
  @Input() columns: Array<{
    title: string;
    key: string;
    secondKey?: string;
    secondKeyPosition?: string;
    width?: string;
    type?: string;
    callback?: any;
    badgeMapping?: BadgeMapping;
    extraLabel?: string;
    optionalData?: any;
    hideIf?: () => boolean;
  }> = [];
  @Input() sendTableData: any[] = [];
  @Input() showActions: boolean = false;
  @Input() actions: Array<{
    icon?: string;
    label: string;
    type?: string;
    permissionKeys?: string[];
    callback?: any;
    optionalData?: any;
    showIf?: (data: any) => boolean;
  }> = [];
  @Input() actionDisplay: 'menu' | 'inline' = 'menu';
  @Input() actionColumnWidth: string = '80px';
  @Input() width: any = null;
  @Input() pageSize: number = 100;
  @Input() showPagination: boolean = true;
  @Input() tableType: string = 'ServerSide';

  tableData: any[] = [];
  tableColumns: any[] = [];
  isLoading = false;
  isFirstLoad: boolean = false;
  dynamicWidth: string | null = '';
  pageIndex = 1;
  total: number = 1;
  sortField: string | null = null;
  sortOrder: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(
    private generalService: GeneralService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchData();
    this.setupColumns();
    setTimeout(() => {
      this.isFirstLoad = true;
    }, 1000);
  }

  ngOnChanges(changes: SimpleChanges): void {

    if (changes['columns']) {
      this.setupColumns();
      return;
    }

    if (changes['sendTableData']) {
      this.tableData = this.sendTableData || [];
      this.cdr.detectChanges();
      return;
    }

    if (changes['apiEndpoint']) {
      if (!this.isFirstLoad) return;

      this.pageIndex = 1;
      this.cdr.detectChanges();
      this.fetchData();
      return;
    }

    if (changes['filters']) {
      if (!this.isFirstLoad) return;

      if (!changes['filters'].firstChange) {
        this.pageIndex = 1;
      } else {

      }

      this.cdr.detectChanges();
      this.fetchData();
      return;
    }
  }

  @HostListener('window:resize', ['$event'])
  @HostListener('window:load', ['$event'])
  onWindowResize(_event: Event): void {
    this.updateDynamicWidth();
  }

  private updateDynamicWidth(): void {
    const innerWidth = window.innerWidth;
    console.log('innerWidth', innerWidth);
    console.log('width', this.width);
    if (innerWidth < 1300 && this.width === null) {

      this.dynamicWidth = '100vw';
      console.log('this.dynamicWidth', this.dynamicWidth);
      this.cdr.detectChanges();
    } else {
      this.dynamicWidth = null;
    }
  }

  private setupColumns(): void {
  if (!this.columns || this.columns.length === 0) return;

  this.tableColumns = this.columns
    .filter((col) => {
      return !col.hideIf || (typeof col.hideIf === 'function' && col.hideIf() === false);
    })
    .map((col) => ({
      title: col.title,
      key: col.key,
      secondKey: col.secondKey || null,
      secondKeyPosition: col.secondKeyPosition || 'right',
      width: col.width || 'auto',
      type: col.type || null,
      callback: col.callback || null,
      badgeMapping: col.badgeMapping || null,
      extraLabel: col.extraLabel || null,
      optionalData: col.optionalData || null,
    }));
    this.cdr.detectChanges();
  }

  public fetchData(): void {
    if (this.sendTableData && this.sendTableData.length > 0) {
      this.tableData = this.sendTableData;
      this.cdr.detectChanges();
      return;
    }
    if (!this.apiEndpoint) return;
    this.isLoading = true;
    const urlWithFilters = this.applyFilters(
      this.apiEndpoint,
      this.filters,
      this.pageIndex,
      this.pageSize,
      this.sortField,
      this.sortOrder
    );
    this.generalService
      .commonGet(urlWithFilters)
      .pipe(takeUntil(this.destroy$))
      .subscribe(
        (response) => {
          this.tableData = response?.data || [];
          this.total = response?.totalEntityCount || 0;
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        (error) => {
          console.error('Error fetching table data:', error);
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      );
  }

  applyFilters(
    url: string,
    filters: { name: string; value: any }[],
    pageIndex: number,
    pageSize: number,
    sortField: string | null,
    sortOrder: string | null
  ): string {
    let filterParams = filters
      .map((filter) => `${filter.name}=${encodeURIComponent(filter.value)}`)
      .join('&');

    if (sortField && sortOrder) {
      filterParams += `&sortField=${sortField}&sortOrder=${sortOrder}`;
    }

    filterParams += `&PageNumber=${pageIndex}&PageSize=${pageSize}`;

    return url.includes('?')
      ? `${url}&${filterParams}`
      : `${url}?${filterParams}`;
  }

  handleAction(action: any, data: any): void {
    if (action && action.callback) {
      action.callback(data, action?.optionalData);
    }
  }

  getBadgeClass(value: any, col: any): string {
    if (col.badgeMapping && col.badgeMapping[value]?.class) {
      return col.badgeMapping[value].class;
    }
    return getUnifiedStatusBadgeClass(value?.toString?.());
  }

  getBadgeLabel(value: any, col: any): string {
    if (col.badgeMapping) {
      return col.badgeMapping[value]?.label || value;
    }
    return value;
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    const { pageSize, pageIndex, sort } = params;
    const currentSort = sort.find((item) => item.value !== null);
    const newSortField = (currentSort && currentSort.key) || null;
    const newSortOrder = (currentSort && currentSort.value) || null;

    const hasChanged =
      this.pageSize !== pageSize ||
      this.pageIndex !== pageIndex ||
      this.sortField !== newSortField ||
      this.sortOrder !== newSortOrder;

    if (hasChanged && this.isFirstLoad) {
      this.pageSize = pageSize;
      this.pageIndex = pageIndex;
      this.sortField = newSortField;
      this.sortOrder = newSortOrder;
      this.cdr.detectChanges();
      this.fetchData();
    }
  }

  trackByindex(index: number): number {
    return index;
  }

  trackByAction(_index: number, action: any): string {
    return action.label;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
