import { Component, ElementRef, ViewChild, inject, input, model, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DialogModule } from 'primeng/dialog';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';

import { API_BASE } from '../../core/config';

@Component({
  selector: 'hm-container-terminal',
  imports: [DialogModule],
  templateUrl: './container-terminal.component.html',
  styleUrl: './container-terminal.component.scss',
})
export class ContainerTerminalComponent {
  readonly serviceId = input.required<string>();
  readonly containerId = input.required<string>();
  readonly visible = model(false);

  @ViewChild('term') private termEl?: ElementRef<HTMLDivElement>;

  private readonly http = inject(HttpClient);
  readonly connected = signal(false);

  private term?: Terminal;
  private fit?: FitAddon;
  private ws?: WebSocket;
  private resizeObserver?: ResizeObserver;

  onShow(): void {
    const host = this.termEl?.nativeElement;
    if (!host) return;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      theme: { background: '#0f1117', foreground: '#d6dae3' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(host);
    fit.fit();
    this.term = term;
    this.fit = fit;

    this.connect();

    term.onData((d) => this.ws?.readyState === WebSocket.OPEN && this.ws.send('0' + d));

    this.resizeObserver = new ResizeObserver(() => this.refit());
    this.resizeObserver.observe(host);
  }

  private connect(): void {
    // Exchange the (header-authenticated) bearer token for a single-use ticket,
    // then open the socket with it. The access token never touches the URL.
    this.http
      .post<{ ticket: string }>(`${API_BASE}/services/${this.serviceId()}/exec/ticket`, {})
      .subscribe({
        next: (res) => this.openSocket(res.ticket),
        error: () =>
          this.term?.writeln('\x1b[31mImpossible d’ouvrir la session (autorisation refusée).\x1b[0m'),
      });
  }

  private openSocket(ticket: string): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const params = new URLSearchParams({ container: this.containerId(), ticket });
    const url = `${proto}://${location.host}${API_BASE}/services/${this.serviceId()}/exec?${params.toString()}`;

    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    this.ws = ws;

    ws.onopen = () => { this.connected.set(true); this.refit(); };
    ws.onmessage = (e) => {
      const data = typeof e.data === 'string' ? e.data : new Uint8Array(e.data);
      this.term?.write(data as Uint8Array);
    };
    ws.onclose = () => { this.connected.set(false); this.term?.writeln('\r\n\x1b[90m[connexion fermée]\x1b[0m'); };
    ws.onerror = () => { this.connected.set(false); this.term?.writeln('\r\n\x1b[31m[erreur de connexion]\x1b[0m'); };
  }

  private refit(): void {
    if (!this.fit || !this.term) return;
    try { this.fit.fit(); } catch { return; }
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send('1' + JSON.stringify({ cols: this.term.cols, rows: this.term.rows }));
    }
  }

  teardown(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
    this.ws?.close();
    this.ws = undefined;
    this.term?.dispose();
    this.term = undefined;
    this.fit = undefined;
    this.connected.set(false);
  }
}
