import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AvatarColorService } from '../../services/avatar-color.service';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.css',
})
export class AvatarComponent {
  @Input({ required: true }) name!: string;
  /** Seed for color; defaults to name so same person gets same color everywhere. */
  @Input() seed?: string;
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  constructor(private readonly avatarColor: AvatarColorService) {}

  get initials(): string {
    return this.avatarColor.getInitials(this.name);
  }

  get colorClass(): string {
    return this.avatarColor.getAvatarClass(this.seed ?? this.name);
  }
}
