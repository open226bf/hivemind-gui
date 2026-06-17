import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';

import { Topbar } from './topbar';
import { Sidebar } from './sidebar';

/** Application chrome: composes the topbar, the navigation rail and the routed
 *  content area. Layout only — each piece is its own component. */
@Component({
  selector: 'hm-shell',
  imports: [RouterOutlet, ToastModule, Topbar, Sidebar],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {}
