import { TestBed } from '@angular/core/testing';
import { MessageService } from 'primeng/api';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { HiveTabVariables } from './hive-tab-variables.component';
import { HivesApi } from '../../core/api';
import { EnvVar, EnvVarsResponse, SetEnvVarsRequest } from '../../core/models';

/** Same editor as the service variables tab, so the same signal-notification
 *  contract has to hold: typing must replace the row, not write through it. */
describe('HiveTabVariables row editing', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<HiveTabVariables>>;
  let component: HiveTabVariables;

  const existing: EnvVar = { key: 'LOG_LEVEL', value: 'info', is_secret: false };

  beforeEach(() => {
    const api = {
      env: (): Observable<EnvVarsResponse> => of({ vars: [existing], count: 1 }),
      setEnv: (_id: string, body: SetEnvVarsRequest): Observable<EnvVarsResponse> =>
        of({ vars: body.vars, count: body.vars.length }),
    } as unknown as HivesApi;

    TestBed.configureTestingModule({
      providers: [MessageService, { provide: HivesApi, useValue: api }],
    });

    fixture = TestBed.createComponent(HiveTabVariables);
    fixture.componentRef.setInput('hiveId', 'hive-1');
    fixture.componentRef.setInput('canManage', true);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('enables saving as soon as an added variable is named', () => {
    component.startEdit();
    component.addRow();
    fixture.detectChanges();
    expect(component.valid()).toBe(false);

    const input = fixture.nativeElement.querySelectorAll('input.k')[1] as HTMLInputElement;
    input.value = 'retry_count';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.rows()[1].key).toBe('RETRY_COUNT');
    expect(component.valid()).toBe(true);
  });
});
