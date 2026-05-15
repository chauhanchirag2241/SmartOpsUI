import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AvatarColorService {
  private readonly classes = ['av-b', 'av-g', 'av-p', 'av-o'];

  getAvatarClass(seed: unknown): string {
    const value = String(seed || '').trim().toLowerCase();
    if (!value) {
      return 'av-gray';
    }

    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = value.charCodeAt(i) + ((hash << 5) - hash);
    }

    return this.classes[Math.abs(hash) % this.classes.length];
  }

  getInitials(name: unknown): string {
    const value = String(name || '').trim();
    if (!value) {
      return 'NA';
    }

    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }

    return parts[0][0].toUpperCase();
  }
}
