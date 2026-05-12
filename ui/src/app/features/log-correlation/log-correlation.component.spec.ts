import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LogCorrelationComponent } from './log-correlation.component';

describe('LogCorrelationComponent', () => {
  let component: LogCorrelationComponent;
  let fixture: ComponentFixture<LogCorrelationComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LogCorrelationComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(LogCorrelationComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load pods on init', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/pods');
    req.flush({ pods: [{ name: 'pod-a', status: 'Running' }, { name: 'pod-b', status: 'Running' }] });
    expect(component.podOptions.length).toBe(2);
  });

  it('should not correlate with less than 2 pods', () => {
    component.selectedPods = ['pod-a'];
    component.correlate();
    expect(component.loading).toBeFalse();
  });

  it('should correlate with 2+ pods', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/pods').flush({ pods: [] });

    component.selectedPods = ['pod-a', 'pod-b'];
    component.correlate();
    expect(component.loading).toBeTrue();

    const req = httpMock.expectOne('/api/correlate-logs');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.pods).toEqual(['pod-a', 'pod-b']);
    req.flush({ entries: [{ pod: 'pod-a', message: 'test', timestamp: '2024-01-01T00:00:00', level: 'info' }], pods: ['pod-a', 'pod-b'], total: 1 });

    expect(component.data.total).toBe(1);
    expect(component.loading).toBeFalse();
  });
});
