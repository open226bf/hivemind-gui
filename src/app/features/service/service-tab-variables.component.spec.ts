import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { ServiceTabVariables } from './service-tab-variables.component';
import { ServiceDetailStore } from './service-detail.store';
import { ServicesApi } from '../../core/api';
import { EnvVar, EnvVarsResponse, SetEnvVarsRequest } from '../../core/models';

/**
 * Guards the signal-notification contract of the variable editor.
 *
 * `valid` and `duplicateKey` are computeds over the `rows` signal, so a row has
 * to be *replaced* when the user types, not written through: an in-place
 * mutation leaves the signal's value identical and the computeds stale. The
 * tests drive the real input elements, since the template binding is exactly
 * what regressed.
 */
describe('ServiceTabVariables row editing', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ServiceTabVariables>>;
  let component: ServiceTabVariables;
  let sent: SetEnvVarsRequest[];

  const existing: EnvVar = { key: 'DATABASE_URL', value: 'postgres://', is_secret: false };

  beforeEach(() => {
    sent = [];
    const api = {
      env: (): Observable<EnvVarsResponse> => of({ vars: [existing], count: 1 }),
      setEnv: (_id: string, body: SetEnvVarsRequest): Observable<EnvVarsResponse> => {
        sent.push(body);
        return of({ vars: body.vars, count: body.vars.length });
      },
    } as unknown as ServicesApi;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        MessageService,
        ServiceDetailStore,
        { provide: ServicesApi, useValue: api },
      ],
    });

    fixture = TestBed.createComponent(ServiceTabVariables);
    TestBed.inject(ServiceDetailStore).serviceId.set('svc-1');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function type(selector: string, index: number, value: string): void {
    const input = fixture.nativeElement.querySelectorAll(selector)[index] as HTMLInputElement;
    expect(input, `${selector}[${index}] must be rendered`).toBeTruthy();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  it('enables saving as soon as an added variable is named', () => {
    component.startEdit();
    component.addRow();
    fixture.detectChanges();

    // The new row has no key yet, so the set cannot be saved.
    expect(component.valid()).toBe(false);

    type('input.k', 1, 'REDIS_URL');

    // Before the fix this stayed false until some other edit replaced the
    // array — adding a second row and removing it again, which is how the bug
    // was first noticed.
    expect(component.valid()).toBe(true);
  });

  it('uppercases the key as it is typed', () => {
    component.startEdit();
    component.addRow();
    fixture.detectChanges();

    type('input.k', 1, 'redis_url');

    expect(component.rows()[1].key).toBe('REDIS_URL');
    expect(component.valid()).toBe(true);
  });

  it('keeps saving disabled while a key is malformed', () => {
    component.startEdit();
    component.addRow();
    fixture.detectChanges();

    type('input.k', 1, '9LIVES'); // must not start with a digit

    expect(component.valid()).toBe(false);
  });

  it('reports a duplicate key while it is being typed', () => {
    component.startEdit();
    component.addRow();
    fixture.detectChanges();

    type('input.k', 1, 'DATABASE_URL');

    expect(component.duplicateKey()).toBe('DATABASE_URL');
    expect(component.valid()).toBe(false);
  });

  it('sends the typed value with the set', () => {
    component.startEdit();
    component.addRow();
    fixture.detectChanges();
    type('input.k', 1, 'REDIS_URL');
    type('input.v', 1, 'redis://cache:6379');

    component.save();

    expect(sent).toHaveLength(1);
    expect(sent[0].vars).toEqual([
      existing,
      { key: 'REDIS_URL', value: 'redis://cache:6379', is_secret: false },
    ]);
  });
});
