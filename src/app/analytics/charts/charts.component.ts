import { ChangeDetectionStrategy, Component } from '@angular/core';
import { AuthService } from 'app/shared/Auth/auth.service';
import { EChartsOption } from 'echarts';

@Component({
  selector: 'app-charts',
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChartsComponent {
  userRole: string = this.auth.getUserRole() || '';

  constructor(private auth: AuthService) {}

  ngOnInit(): void {  }

  subscriptionPlanChart: EChartsOption = {
    tooltip: {
      trigger: 'item'
    },
    legend: {
       orient: 'vertical',
      top: '0',
      left: 'left',
      textStyle: { color: '#6b7280' }
    },
    series: [
      {
        name: 'Plan Usage',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        padAngle: 5,
        itemStyle: {
          borderRadius: 10
        },
        label: {
          show: false,
          position: 'center'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 20,
            fontWeight: 'bold'
          }
        },
        labelLine: {
          show: false
        },
        data: [
          { value: 500, name: 'Startup Plan' },
          { value: 1000, name: 'Enterprise' },
          { value: 300, name: 'Custom' }
        ]
      }
    ]
  };

  userGrowthOptions: EChartsOption = {

    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    },
    yAxis: {
      type: 'value',

    },
    series: [
      {
        name: 'Users',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: [200, 400, 800, 1200, 1600, 2100]
      }
    ]
  };

  ordersGrowthChart: EChartsOption = {
    tooltip: {
      trigger: 'axis'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
    },
    yAxis: {
      type: 'value',

    },
    series: [
      {
        name: 'Orders',
        type: 'line',
        smooth: true,
        areaStyle: {},
        data: [200, 400, 800, 1200, 1600, 2100]
      }
    ]
  };

   invoiceBarOptions: EChartsOption = {
  xAxis: {
    type: 'category',
    data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  },
  yAxis: {
    type: 'value'
  },
  tooltip: {
    trigger: 'axis'
  },
  series: [
    {
      name: 'Invoices',
      data: [820, 590, 901, 934, 1290, 1330, 1320],
      type: 'line',
      smooth: true,
      itemStyle: {
        color: '#2d71fa'
      },
      lineStyle: {
        width: 3
      },
      symbol: 'circle',
      symbolSize: 8
    }
  ]
};

patientStatusChart: EChartsOption = {
  title: {

    left: 'center'
  },
  tooltip: {
    trigger: 'item'
  },
  legend: {
    orient: 'horizontal',
    bottom: 'bottom',
    textStyle: { color: '#6b7280' }

  },
  series: [
    {
      name: 'Patients',
      type: 'pie',
      radius: '60%',
      label: {
        show: false
      },
      labelLine: {
        show: false
      },
      data: [
        { value: 450, name: 'Active' },
        { value: 120, name: 'Inactive' }
      ]
    }
  ]
};

revenueBarChart: EChartsOption = {

  tooltip: {
    trigger: 'axis',
    axisPointer: {
      type: 'shadow'
    }
  },
  legend: {
    data: ['Products Sold', 'Bundles Sold', 'Total Earnings'],
    bottom: 0
  },
  grid: {
    top: 60,
    left: '3%',
    right: '4%',
    bottom: 50,
    containLabel: true
  },
  xAxis: {
    type: 'category',
    data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
  },
  yAxis: {
    type: 'value',

  },
  series: [
    {
      name: 'Products Sold',
      type: 'bar',
      data: [5000, 7000, 6000, 8000, 9000, 10000],
      itemStyle: {
        color: '#3b82f6'
      }
    },
    {
      name: 'Bundles Sold',
      type: 'bar',
      data: [3000, 3500, 3200, 4000, 4200, 4500],
      itemStyle: {
        color: '#f97316'
      }
    },
    {
      name: 'Total Earnings',
      type: 'bar',
      data: [8000, 10500, 9200, 12000, 13200, 14500],
      itemStyle: {
        color: '#10b981'
      }
    }
  ]
};

}
