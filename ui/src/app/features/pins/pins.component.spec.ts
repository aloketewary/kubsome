import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PinsComponent } from './pins.component';

describe('PinsComponent', () => {
  let component: PinsComponent;
  let fixture: ComponentFixture<PinsComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PinsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PinsComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load pins on init', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne('/api/saved-queries');
    req.flush({ queries: [{ name: 'test', query: 'pods', last_run: null }] });
    expect(component.pins.length).toBe(1);
  });

  it('should add a pin', () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/saved-queries').flush({ queries: [] });

    component.newName = 'health';
    component.newQuery = 'scorecard';
    component.addPin();

    const postReq = httpMock.expectOne('/api/saved-queries');
    expect(postReq.request.method).toBe('POST');
    expect(postReq.request.body.name).toBe('health');
    postReq.flush({});

    // Refresh after add
    httpMock.expectOne('/api/saved-queries').flush({ queries: [{ name: 'health', query: 'scorecard' }] });
    expect(component.pins.length).toBe(1);
  });

  it('should format time', () => {
    const result = component.formatTime('2024-01-15T10:30:00.000Z');
    expect(result).toContain(':');
  });
});
