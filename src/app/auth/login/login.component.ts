import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

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
export class LoginComponent implements OnInit {
  loading = false;
  showPassword = false;
  particles: Particle[] = [];

  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    rememberMe: [false]
  });

  ngOnInit(): void {
    this.generateParticles();
  }

  generateParticles(): void {
    for (let i = 0; i < 18; i++) {
      this.particles.push({
        left: Math.random() * 100,
        bottom: Math.random() * 30,
        dur: `${5 + Math.random() * 8}s`,
        delay: `${Math.random() * 6}s`,
        drift: `${(Math.random() - 0.5) * 80}px`,
        size: 1.5 + Math.random() * 2.5
      });
    }
  }

  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const email = this.loginForm.controls.email.value ?? 'admin@smartops.com';
    
    // Simulate API call
    setTimeout(() => {
      this.auth.login(
        {
          id: 'demo-admin',
          name: 'School Admin',
          email,
          role: 'admin',
        },
        'demo-jwt-token',
      );
      this.loading = false;
      void this.router.navigate(['/dashboard']);
    }, 1500);
  }
}
