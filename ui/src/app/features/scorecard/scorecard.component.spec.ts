import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ScorecardComponent } from './scorecard.component';

describe('ScorecardComponent', () => {
  let component: ScorecardComponent;
  let fixture: ComponentFixture<ScorecardComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScorecardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ScorecardComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should fetch scorecard on init', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/scorecard');
    expect(req.request.method).toBe('GET');
    req.flush({
      overall_grade: 'A', overall_score: 95, summary: 'All good',
      categories: { availability: { score: 100, grade: 'A', issues: [] } },
      recommendations: [],
    });
    expect(component.data.overall_grade).toBe('A');
  });

  it('should map grade labels', () => {
    expect(component.gradeLabel('A')).toBe('Excellent');
    expect(component.gradeLabel('F')).toBe('Critical');
  });
});
