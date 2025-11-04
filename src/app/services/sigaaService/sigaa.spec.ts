import { TestBed } from '@angular/core/testing';

import { Sigaa } from './sigaa';

describe('Sigaa', () => {
  let service: Sigaa;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Sigaa);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
