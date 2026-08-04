import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
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

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const newPassword = group.get('newPassword')?.value;
  const confirm = group.get('confirmNewPassword')?.value;
  if (!newPassword || !confirm) {
    return null;
  }
  return newPassword === confirm ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './change-password.component.html',
  styleUrl: './change-password.component.css',
})
export class ChangePasswordComponent implements OnInit, OnDestroy {
  readonly loading = signal(false);
  readonly errorMessage = signal('');
  readonly showOld = signal(false);
  readonly showNew = signal(false);
  readonly showConfirm = signal(false);
  particles: Particle[] = [];
  private valueSub?: Subscription;

  readonly tenant = inject(TenantService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly form = this.fb.group(
    {
      oldPassword: ['', [Validators.required]],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/),
        ],
      ],
      confirmNewPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

  ngOnInit(): void {
    this.auth.ensureValidSessionOrClear();
    if (!this.auth.isLoggedIn) {
      void this.router.navigate(['/auth/login']);
      return;
    }
    if (!this.auth.mustChangePassword) {
      void this.router.navigate(['/dashboard']);
      return;
    }

    this.generateParticles();
    this.valueSub = this.form.valueChanges.subscribe(() => {
      if (this.errorMessage()) {
        this.errorMessage.set('');
      }
    });
  }

  ngOnDestroy(): void {
    this.valueSub?.unsubscribe();
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

  toggle(field: 'old' | 'new' | 'confirm'): void {
    if (field === 'old') this.showOld.update((v) => !v);
    else if (field === 'new') this.showNew.update((v) => !v);
    else this.showConfirm.update((v) => !v);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');

    const oldPassword = this.form.controls.oldPassword.value ?? '';
    const newPassword = this.form.controls.newPassword.value ?? '';
    const confirmNewPassword = this.form.controls.confirmNewPassword.value ?? '';

    this.auth
      .changePassword(oldPassword, newPassword, confirmNewPassword)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          void this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.errorMessage.set(this.resolveError(err));
        },
      });
  }

  private resolveError(err: unknown): string {
    const body = (err as { error?: unknown })?.error;
    if (typeof body === 'string' && body.trim()) {
      return body;
    }
    if (Array.isArray(body) && body.length > 0 && typeof body[0] === 'string') {
      return body[0];
    }
    if (body && typeof body === 'object') {
      const record = body as Record<string, unknown>;
      const message = record['message'] ?? record['error'] ?? record['title'];
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return 'Unable to update password. Please try again.';
  }
}
