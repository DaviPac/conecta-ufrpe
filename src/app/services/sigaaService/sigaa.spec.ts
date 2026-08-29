import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SigaaService } from './sigaa.service';

describe('SigaaService', () => {
  let service: SigaaService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    service = TestBed.inject(SigaaService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
