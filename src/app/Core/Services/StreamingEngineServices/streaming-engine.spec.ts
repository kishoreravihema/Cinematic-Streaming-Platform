import { TestBed } from '@angular/core/testing';

import { StreamingEngine } from './streaming-engine';

describe('StreamingEngine', () => {
  let service: StreamingEngine;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(StreamingEngine);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
