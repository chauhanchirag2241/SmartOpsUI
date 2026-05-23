import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TenantService } from '../../core/services/tenant.service';

interface Particle {
  left: number;
  bottom: number;
  dur: string;
  delay: string;
  drift: string;
  size: number;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class LoginComponent implements OnInit, OnDestroy {
  readonly loading = signal(false);
  readonly showPassword = signal(false);
  readonly errorMessage = signal('');
  particles: Particle[] = [];
  private valueSub?: Subscription;

  readonly tenant = inject(TenantService);

  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false],
  });

  ngOnInit(): void {
    this.auth.ensureValidSessionOrClear();

    if (this.auth.isLoggedIn) {
      void this.router.navigate(['/dashboard']);
      return;
    }

    if (this.route.snapshot.queryParamMap.get('sessionExpired') === '1') {
      this.errorMessage.set('Your session expired. Please sign in again.');
    }

    this.generateParticles();
    this.valueSub = this.loginForm.valueChanges.subscribe(() => {
      if (this.errorMessage()) {
        this.errorMessage.set('');
      }
      for (const key of ['email', 'password'] as const) {
        const control = this.loginForm.controls[key];
        if (control.dirty || control.touched) {
          control.updateValueAndValidity({ emitEvent: false });
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.valueSub?.unsubscribe();
  }

  onEmailBlur(): void {
    const control = this.loginForm.controls.email;
    control.markAsTouched();
    control.updateValueAndValidity();
  }

  onPasswordBlur(): void {
    const control = this.loginForm.controls.password;
    control.markAsTouched();
    control.updateValueAndValidity();
  }

  onEmailInput(): void {
    const control = this.loginForm.controls.email;
    control.markAsTouched();
    control.updateValueAndValidity({ emitEvent: false });
  }

  onPasswordInput(): void {
    const control = this.loginForm.controls.password;
    control.markAsTouched();
    control.updateValueAndValidity({ emitEvent: false });
  }

  generateParticles(): void {
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        left: Math.random() * 100,
        bottom: Math.random() * 30,
        dur: `${5 + Math.random() * 8}s`,
        delay: `${Math.random() * 6}s`,
        drift: `${(Math.random() - 0.5) * 80}px`,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  onSubmit(): void {
    if (!this.tenant.isReady) {
      this.errorMessage.set(this.tenant.loadError ?? 'School portal is not available.');
      return;
    }

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.loginForm.updateValueAndValidity();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const email = this.loginForm.controls.email.value ?? '';
    const password = this.loginForm.controls.password.value ?? '';

    this.auth
      .loginWithApi(email, password)
      .pipe(
        finalize(() => {
          this.loading.set(false);
        })
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorMessage.set(this.resolveLoginError(err));
          this.loginForm.controls.email.markAsTouched();
          this.loginForm.controls.password.markAsTouched();
        },
      });
  }

  private resolveLoginError(err: unknown): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message = record['message'] ?? record['error'] ?? record['title'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return 'Invalid email or password.';
  }
}
