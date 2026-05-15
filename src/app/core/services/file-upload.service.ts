import { HttpEvent, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from './api.service';

export interface UploadRequest {
  file: File;
  container: 'student-photos' | 'teacher-photos' | 'documents' | string;
  ownerId?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  fileName: string;
  contentType: string;
  size: number;
  url?: string;
  blobName?: string;
  metadata?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class FileUploadService {
  private readonly api = inject(ApiService);

  uploadToBlob(request: UploadRequest): Observable<HttpEvent<UploadResult>> {
    const formData = new FormData();
    formData.append('file', request.file);
    formData.append('container', request.container);

    if (request.ownerId) {
      formData.append('ownerId', request.ownerId);
    }

    for (const [key, value] of Object.entries(request.metadata ?? {})) {
      formData.append(`metadata[${key}]`, value);
    }

    return this.api.upload<UploadResult>('files/blob-upload', formData, new HttpParams());
  }

  toMetadata(file: File): UploadResult {
    return {
      fileName: file.name,
      contentType: file.type || 'application/octet-stream',
      size: file.size,
    };
  }
}
