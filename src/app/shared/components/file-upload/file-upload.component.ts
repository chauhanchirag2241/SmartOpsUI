import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, Input, Output } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { UPLOAD_PLACEHOLDER } from '../../constants/form.constants';

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
  @Input() accept = 'image/*';
  @Input() mode: 'avatar' | 'document' = 'avatar';
  @Input() disabled = false;

  @HostBinding('class.avatar-mode')
  get isAvatarMode(): boolean {
    return this.mode === 'avatar';
  }

  @HostBinding('class.document-mode')
  get isDocumentMode(): boolean {
    return this.mode === 'document';
  }

  @Output() fileSelected = new EventEmitter<SelectedUploadFile>();

  readonly uploadPlaceholder = UPLOAD_PLACEHOLDER;

  previewUrl: string | null = null;
  fileName = '';
  hasFile = false;

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
    this.hasFile = true;
    this.previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
    this.fileSelected.emit({ file, previewUrl: this.previewUrl });
  }
}
