import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  OnDestroy,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { InputTextModule } from 'primeng/inputtext';

import { AuthService } from '../../core/auth.service';
import { API_BASE } from '../../core/config';

const MAX_LINES = 5000;

/**
 * Live log console for any server-sent log stream: follow, tail, keyword filter
 * with highlighting, and a fullscreen mode.
 *
 * The stream source is the `path` input (an API path under API_BASE), so the
 * same viewer serves a managed service (`/services/{id}/logs`) and a service
 * Hivemind does not manage, addressed by Swarm id
 * (`/discovered-services/{swarmId}/logs`). The request is header-authenticated
 * via fetch/ReadableStream — EventSource cannot send an Authorization header.
 */
@Component({
  selector: 'hm-log-viewer',
  imports: [FormsModule, ButtonModule, ToggleSwitchModule, InputTextModule],
  templateUrl: './log-viewer.component.html',
  styleUrl: './log-viewer.component.scss',
})
export class LogViewer implements AfterViewInit, OnDestroy {
  /** API path of the log stream, relative to API_BASE. */
  readonly path = input.required<string>();

  @ViewChild('console') private consoleEl?: ElementRef<HTMLDivElement>;

  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  readonly lines = signal<string[]>([]);
  readonly connected = signal(false);
  readonly error = signal<string | null>(null);

  /** Maximizes the logs panel to a full-viewport overlay (Escape to exit). */
  readonly fullscreen = signal(false);

  /** Case-insensitive keyword filter (grep-style): when set, only matching lines
   *  are shown and the term is highlighted. Applies live to incoming lines. */
  readonly filter = signal('');
  readonly visibleLines = computed(() => {
    const q = this.filter().trim().toLowerCase();
    const all = this.lines();
    return q ? all.filter((l) => l.toLowerCase().includes(q)) : all;
  });

  follow = true;
  tail = 200;
  autoScroll = true;

  private controller?: AbortController;
  private pendingScroll = false;

  constructor() {
    // Re-open the stream whenever the source changes (and on first render).
    // untracked keeps the effect depending on `path` alone — start() also reads
    // the auth token, which must not re-open the stream on every refresh.
    effect(() => {
      this.path();
      untracked(() => this.start());
    });
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

  toggleFullscreen(): void {
    const on = !this.fullscreen();
    this.fullscreen.set(on);
    if (on) requestAnimationFrame(() => this.scrollToBottom());
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.fullscreen()) this.fullscreen.set(false);
  }

  /** HTML for a line with the filter term wrapped in <mark>. All log text is
   *  HTML-escaped first, so the only injected markup is the highlight tag —
   *  Angular's [innerHTML] sanitizer keeps <mark> and treats the rest as literal
   *  text (XSS-safe, and exact text is preserved unlike template whitespace). */
  highlight(line: string): string {
    const q = this.filter().trim();
    if (!q) return this.escapeHtml(line);
    const lower = line.toLowerCase();
    const ql = q.toLowerCase();
    let out = '';
    let i = 0;
    for (;;) {
      const idx = lower.indexOf(ql, i);
      if (idx < 0) {
        out += this.escapeHtml(line.slice(i));
        break;
      }
      out += this.escapeHtml(line.slice(i, idx));
      out += '<mark>' + this.escapeHtml(line.slice(idx, idx + q.length)) + '</mark>';
      i = idx + q.length;
    }
    return out;
  }

  private escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    const path = this.path();
    const token = this.auth.token();
    if (!path || !token) {
      this.error.set('Session expirée — reconnectez-vous.');
      return;
    }

    const controller = new AbortController();
    this.controller = controller;
    this.connected.set(true);

    const params = new URLSearchParams({ follow: String(this.follow), tail: String(this.tail) });

    fetch(`${API_BASE}${path}?${params.toString()}`, {
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
