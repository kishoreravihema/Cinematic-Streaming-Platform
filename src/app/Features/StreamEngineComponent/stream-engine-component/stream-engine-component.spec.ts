import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StreamEngineComponent } from './stream-engine-component';

describe('StreamEngineComponent', () => {
  let component: StreamEngineComponent;
  let fixture: ComponentFixture<StreamEngineComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StreamEngineComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StreamEngineComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
