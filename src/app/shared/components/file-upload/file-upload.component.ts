import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export interface SelectedUploadFile {
  file: File;
  previewUrl: string | null;
}

@Component({
  selector: 'app-file-upload',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './file-upload.component.html',
  styleUrl: './file-upload.component.css',
})
export class FileUploadComponent {
  @Input() label = 'Upload photo';
  @Input() subLabel = 'JPG, PNG - max 2MB';
  @Input() accept = 'image/*';
  @Input() mode: 'avatar' | 'document' = 'avatar';
  @Input() disabled = false;

  @Output() fileSelected = new EventEmitter<SelectedUploadFile>();

  previewUrl: string | null = null;
  fileName = '';

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
    }

    this.fileName = file.name;
    this.previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    this.fileSelected.emit({ file, previewUrl: this.previewUrl });
  }
}
