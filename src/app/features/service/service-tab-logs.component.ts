import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputTextModule } from 'primeng/inputtext';

import { AuthService } from '../../core/auth.service';
import { API_BASE } from '../../core/config';
import { ServiceDetailStore } from '../service/service-detail.store';

const MAX_LINES = 5000;

@Component({
  selector: 'hm-service-tab-logs',
  imports: [FormsModule, ButtonModule, ToggleSwitchModule, InputTextModule],
  templateUrl: './service-tab-logs.component.html',
  styleUrl: './service-tab-logs.component.scss',
})
export class ServiceTabLogs implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('console') private consoleEl?: ElementRef<HTMLDivElement>;

  private readonly store = inject(ServiceDetailStore);
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  readonly lines = signal<string[]>([]);
  readonly connected = signal(false);
  readonly error = signal<string | null>(null);

  follow = true;
  tail = 200;
  autoScroll = true;

  private controller?: AbortController;
  private pendingScroll = false;

  ngOnInit(): void {
    this.start();
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  restart(): void {
    this.start();
  }

  clear(): void {
    this.lines.set([]);
  }

  onScroll(): void {
    const el = this.consoleEl?.nativeElement;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (this.autoScroll !== atBottom) this.autoScroll = atBottom;
  }

  private start(): void {
    this.stop();
    this.clear();
    this.error.set(null);

    const id = this.store.serviceId();
    const token = this.auth.token();
    if (!id || !token) {
      this.error.set('Session expirée — reconnectez-vous.');
      return;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.connected.set(true);

    const params = new URLSearchParams({ follow: String(this.follow), tail: String(this.tail) });

    fetch(`${API_BASE}/services/${id}/logs?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })
      .then(async (resp) => {
        if (!resp.ok || !resp.body) {
          this.zone.run(() => {
            this.error.set(`Erreur ${resp.status} lors de l'ouverture du flux de logs.`);
            this.connected.set(false);
          });
          return;
        }
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let sep: number;
          while ((sep = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            this.handleFrame(frame);
          }
        }
        this.zone.run(() => this.connected.set(false));
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        this.zone.run(() => {
          this.error.set('Connexion au flux de logs interrompue.');
          this.connected.set(false);
        });
      });
  }

  private handleFrame(frame: string): void {
    const dataLines = frame
      .split('\n')
      .filter((l) => l.startsWith('data:'))
      .map((l) => l.replace(/^data: ?/, ''));
    if (frame.includes('event: end')) {
      this.zone.run(() => this.connected.set(false));
      return;
    }
    const text = dataLines.join('\n');
    if (!text) return;
    this.zone.run(() => this.append(text));
  }

  private append(text: string): void {
    this.lines.update((ls) => {
      const next = ls.concat(text.split('\n'));
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
    });
    if (this.autoScroll && !this.pendingScroll) {
      this.pendingScroll = true;
      requestAnimationFrame(() => {
        this.pendingScroll = false;
        this.scrollToBottom();
      });
    }
  }

  private scrollToBottom(): void {
    const el = this.consoleEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  private stop(): void {
    this.controller?.abort();
    this.controller = undefined;
    this.connected.set(false);
  }
}
