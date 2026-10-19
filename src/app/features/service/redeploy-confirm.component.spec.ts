import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import { RedeployConfirm } from './redeploy-confirm.component';

describe('RedeployConfirm', () => {
  let fixture: ReturnType<typeof TestBed.createComponent<RedeployConfirm>>;
  let component: RedeployConfirm;
  let emitted: { repull: boolean }[];

  beforeEach(() => {
    TestBed.configureTestingModule({});
    fixture = TestBed.createComponent(RedeployConfirm);
    component = fixture.componentInstance;
    emitted = [];
    component.confirmed.subscribe((v) => emitted.push(v));
    fixture.detectChanges();
  });

  /** Opens the dialog and lets ngModel push its value into the rendered switch. */
  async function open(): Promise<HTMLInputElement> {
    component.open('web');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const toggle = fixture.nativeElement.querySelector('p-toggleswitch input');
    expect(toggle, 'the re-pull switch must be rendered').toBeTruthy();
    return toggle as HTMLInputElement;
  }

  it('shows the re-pull switch on when the dialog opens', async () => {
    expect((await open()).checked).toBe(true);
  });

  it('redeploys with a re-pull unless the operator switches it off', async () => {
    await open();

    component.ok();

    expect(emitted).toEqual([{ repull: true }]);
  });

  it('honours the operator switching it off', async () => {
    const toggle = await open();

    toggle.click();
    fixture.detectChanges();
    component.ok();

    expect(emitted).toEqual([{ repull: false }]);
  });

  it('starts checked again the next time, instead of remembering the last choice', async () => {
    const toggle = await open();
    toggle.click();
    fixture.detectChanges();
    component.ok();

    const reopened = await open();

    expect(reopened.checked).toBe(true);
  });
});
