import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CostEstimateComponent } from './cost-estimate.component';

describe('CostEstimateComponent', () => {
  let component: CostEstimateComponent;
  let fixture: ComponentFixture<CostEstimateComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CostEstimateComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(CostEstimateComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch cost data on init', () => {
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/cost-estimate');
    expect(req.request.method).toBe('GET');
    req.flush({
      deployments: [{ name: 'app', replicas: 2, cpu_request: '500m', memory_request: '256Mi', cost_per_pod: 8.5, cost_total: 17.0 }],
      total: 17.0,
      pricing: { note: 'Estimated' },
    });

    const trendReq = httpMock.expectOne('/api/cost-trend');
    expect(trendReq.request.method).toBe('GET');
    trendReq.flush({ trend: 'stable', current_monthly: 100, projected_monthly: 100, savings_opportunity: 0 });

    expect(component.data.total).toBe(17.0);
    expect(component.data.deployments.length).toBe(1);
    expect(component.trend.trend).toBe('stable');
  });
});
