import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { ServiceTabMounts } from './service-tab-mounts.component';
import { ServiceDetailStore } from './service-detail.store';
import { ServicesApi, VolumesApi } from '../../core/api';
import { MountsResponse, VolumeListResponse } from '../../core/models';

/**
 * Guards the signal-notification contract of the row editor.
 *
 * `valid()` is a computed over the `rows` signal, so a row has to be *replaced*
 * when the user types, not written through: an in-place mutation leaves the
 * signal's value identical and the computed stale. The test therefore drives
 * the real input element rather than calling patchRow, since the template
 * binding is exactly what regressed.
 */
describe('ServiceTabMounts row editing', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ServiceTabMounts>>;
  let component: ServiceTabMounts;

  beforeEach(() => {
    const servicesApi = {
      mounts: (): Observable<MountsResponse> => of({ mounts: [], warnings: [] }),
    } as unknown as ServicesApi;
    const volumesApi = {
      list: (): Observable<VolumeListResponse> =>
        of({ items: [], total: 0, page: 1, size: 20 } as VolumeListResponse),
    } as unknown as VolumesApi;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        ServiceDetailStore,
        { provide: ServicesApi, useValue: servicesApi },
        { provide: VolumesApi, useValue: volumesApi },
      ],
    });

    fixture = TestBed.createComponent(ServiceTabMounts);
    TestBed.inject(ServiceDetailStore).serviceId.set('svc-1');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Types into the one text input of the row at `index` and lets Angular run. */
  function typeTarget(index: number, value: string): void {
    const inputs = fixture.nativeElement.querySelectorAll('input.tgt');
    const input = inputs[index] as HTMLInputElement;
    expect(input, 'the edited row must render a target input').toBeTruthy();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  /** A fresh row defaults to the volume type, which also needs a source; tmpfs
   *  needs nothing but a target, which is the field this test drives. */
  function addTmpfsRow(): void {
    component.startEdit();
    component.addRow();
    component.onTypeChange(0, 'tmpfs');
    fixture.detectChanges();
  }

  it('enables saving once an added row is filled in', () => {
    addTmpfsRow();

    // A fresh row has no target yet, so it cannot be saved.
    expect(component.valid()).toBe(false);

    typeTarget(0, '/data');

    expect(component.rows()[0].target).toBe('/data');
    expect(component.valid()).toBe(true);
  });

  it('re-disables saving when the target stops being absolute', () => {
    addTmpfsRow();
    typeTarget(0, '/data');
    expect(component.valid()).toBe(true);

    typeTarget(0, 'data');

    expect(component.valid()).toBe(false);
  });
});
