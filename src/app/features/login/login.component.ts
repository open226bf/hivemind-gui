import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { switchMap } from 'rxjs';

import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'hm-login',
  imports: [FormsModule, ButtonModule, InputTextModule, MessageModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = 'admin@hivemind.local';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  submit(): void {
    this.error.set(null);
    this.loading.set(true);
    this.auth
      .login(this.email, this.password)
      .pipe(switchMap(() => this.auth.loadMe()))
      .subscribe({
        next: () => {
          this.loading.set(false);
          this.router.navigate(['/hives']);
        },
        error: (err) => {
          this.loading.set(false);
          this.error.set(err?.error?.message ?? 'Échec de la connexion');
        },
      });
  }
}
