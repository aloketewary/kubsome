import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { RunbooksComponent } from './runbooks';

describe('RunbooksComponent', () => {
  let component: RunbooksComponent;
  let fixture: ComponentFixture<RunbooksComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RunbooksComponent],
      providers: [provideHttpClient()],
    }).compileComponents();

    fixture = TestBed.createComponent(RunbooksComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
