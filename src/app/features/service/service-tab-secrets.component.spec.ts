import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MessageService } from 'primeng/api';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { ServiceTabSecrets } from './service-tab-secrets.component';
import { ServiceDetailStore } from './service-detail.store';
import { ServicesApi } from '../../core/api';
import { FileMount, ServiceConfigResponse, ServiceSecretResponse } from '../../core/models';

describe('ServiceTabSecrets', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<ServiceTabSecrets>>;
  let component: ServiceTabSecrets;
  /** Every mount sent to the API, so a test can assert what went on the wire. */
  let sent: { kind: string; id: string; mount: FileMount }[];

  const secret: ServiceSecretResponse = {
    secret_id: 'sec-1',
    name: 'db_password',
    target_path: '/run/secrets/db_password',
    uid: '101',
    gid: '101',
    mode: 0o640,
  };
  const config: ServiceConfigResponse = {
    config_id: 'cfg-1',
    name: 'nginx',
    target_path: '/etc/nginx/nginx.conf',
    // Nothing chosen: stored before mounts were configurable.
    mode: 0,
  };

  beforeEach(() => {
    sent = [];
    const api = {
      serviceSecrets: (): Observable<ServiceSecretResponse[]> => of([secret]),
      serviceConfigs: (): Observable<ServiceConfigResponse[]> => of([config]),
      updateSecretAttachment: (_id: string, sid: string, mount: FileMount): Observable<void> => {
        sent.push({ kind: 'secret', id: sid, mount });
        return of(undefined as unknown as void);
      },
      updateConfigAttachment: (_id: string, cid: string, mount: FileMount): Observable<void> => {
        sent.push({ kind: 'config', id: cid, mount });
        return of(undefined as unknown as void);
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

    fixture = TestBed.createComponent(ServiceTabSecrets);
    TestBed.inject(ServiceDetailStore).serviceId.set('svc-1');
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  function type(selector: string, value: string): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    expect(input, `${selector} must be rendered`).toBeTruthy();
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function cells(): string[] {
    return [...fixture.nativeElement.querySelectorAll('td')].map((td: HTMLElement) =>
      (td.textContent ?? '').trim(),
    );
  }

  it('lists both catalogs with the stored mount', () => {
    const text = cells();

    expect(text).toContain('db_password');
    expect(text).toContain('101:101');
    expect(text).toContain('0640');
    expect(text).toContain('nginx');
  });

  it('shows an unchosen mode as the default rather than 0000', () => {
    expect(cells()).toContain('0444 (défaut)');
  });

  it('shows an unset owner as root', () => {
    expect(cells()).toContain('root (défaut)');
  });

  it('keeps saving disabled while the typed mode is not octal', () => {
    component.startEdit(component.secrets()[0]);
    fixture.detectChanges();

    type('input.mode', '888');

    expect(component.modeError()).toBe(true);
    expect(component.valid()).toBe(false);
  });

  it('keeps saving disabled while the owner is not numeric', () => {
    component.startEdit(component.secrets()[0]);
    fixture.detectChanges();

    type('input.uid', 'nginx');

    expect(component.uidError()).toBe(true);
    expect(component.valid()).toBe(false);
  });

  it('sends the typed octal mode as the decimal the API expects', () => {
    component.startEdit(component.secrets()[0]);
    fixture.detectChanges();

    type('input.mode', '0400');
    expect(component.valid()).toBe(true);
    component.save(component.secrets()[0]);

    expect(sent).toHaveLength(1);
    expect(sent[0].kind).toBe('secret');
    expect(sent[0].mount.mode).toBe(0o400);
  });

  it('sends a cleared owner as empty so the orchestrator decides again', () => {
    component.startEdit(component.secrets()[0]);
    fixture.detectChanges();

    type('input.uid', '');
    type('input.gid', '');
    component.save(component.secrets()[0]);

    expect(sent[0].mount.uid).toBe('');
    expect(sent[0].mount.gid).toBe('');
  });

  it('routes a config row to the config endpoint', () => {
    component.startEdit(component.configs()[0]);
    fixture.detectChanges();

    type('input.mode', '0444');
    component.save(component.configs()[0]);

    expect(sent[0].kind).toBe('config');
    expect(sent[0].id).toBe('cfg-1');
    expect(sent[0].mount.mode).toBe(0o444);
  });
});
