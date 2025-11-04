import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TurmaDetail } from './turma-detail';

describe('TurmaDetail', () => {
  let component: TurmaDetail;
  let fixture: ComponentFixture<TurmaDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TurmaDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(TurmaDetail);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
