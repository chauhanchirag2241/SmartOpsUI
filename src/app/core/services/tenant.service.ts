import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SchoolBootstrap } from '../models/school-bootstrap.model';

@Injectable({ providedIn: 'root' })
export class TenantService {
  private _subdomain: string | null = null;
  private _school: SchoolBootstrap | null = null;
  private _loadError: string | null = null;

  get subdomain(): string | null {
    return this._subdomain;
  }

  get school(): SchoolBootstrap | null {
    return this._school;
  }

  get loadError(): string | null {
    return this._loadError;
  }

  get isReady(): boolean {
    return !!this._school;
  }

  get displayName(): string {
    return this._school?.shortName || this._school?.name || 'SmartOps';
  }

  resolveSubdomainFromHost(): string | null {
    const host = window.location.hostname.toLowerCase();

    if (host === 'localhost' || host === '127.0.0.1') {
      return environment.tenantSubdomain?.trim() || null;
    }

    const parts = host.split('.');
    if (parts.length >= 3) {
      const sub = parts[0];
      if (sub === 'www' || sub === 'admin' || sub === 'api') {
        return null;
      }
      return sub;
    }

    return null;
  }

  setSubdomain(subdomain: string | null): void {
    this._subdomain = subdomain?.trim().toLowerCase() || null;
  }

  setSchool(school: SchoolBootstrap): void {
    this._school = school;
    this._loadError = null;
    this.applyBranding(school);
  }

  setLoadError(message: string): void {
    this._loadError = message;
    this._school = null;
  }

  applyBranding(school: SchoolBootstrap): void {
    const root = document.documentElement;
    root.style.setProperty('--tenant-primary', school.primaryColor || '#639922');
    if (school.secondaryColor) {
      root.style.setProperty('--tenant-secondary', school.secondaryColor);
    }
    if (school.accentColor) {
      root.style.setProperty('--tenant-accent', school.accentColor);
    }
    document.title = `${school.name} | SmartOps`;

    if (school.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>("link[rel*='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = school.faviconUrl;
    }
  }
}
