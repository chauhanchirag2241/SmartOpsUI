import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ProgressSegment {
  /** Segment width as percentage of the track (0-100). */
  percent: number;
  /** Optional CSS color; defaults to theme primary. */
  color?: string;
  /** Optional semantic tone for default colors. */
  tone?: 'success' | 'danger' | 'warning' | 'neutral' | 'primary';
}

@Component({
  selector: 'app-progress-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './progress-bar.component.html',
  styleUrl: './progress-bar.component.css',
})
export class ProgressBarComponent {
  /** Multi-segment bar (e.g. valid vs invalid). When set, overrides `value`. */
  @Input() segments: ProgressSegment[] | null = null;

  /** Single-value progress 0-100. */
  @Input() value = 0;

  @Input() height = 14;

  /** Left / right caption under the track. */
  @Input() leftCaption = '';
  @Input() rightCaption = '';

  get resolvedSegments(): ProgressSegment[] {
    if (this.segments?.length) {
      return this.segments.filter((s) => s.percent > 0);
    }
    const v = Math.max(0, Math.min(100, this.value));
    return v > 0 ? [{ percent: v, tone: 'primary' }] : [];
  }

  toneColor(seg: ProgressSegment): string {
    if (seg.color) return seg.color;
    switch (seg.tone) {
      case 'success':
        return 'var(--success-color, #2e9e5b)';
      case 'danger':
        return 'var(--danger-color, #c0392b)';
      case 'warning':
        return 'var(--warning-color, #e67e22)';
      case 'neutral':
        return 'var(--border-color, #EDEFE6)';
      default:
        return 'var(--primary-color, #639922)';
    }
  }
}
