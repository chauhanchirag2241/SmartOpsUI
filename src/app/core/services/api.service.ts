import { HttpClient, HttpContext, HttpEvent, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  get<T>(
    endpoint: string,
    params?: HttpParams,
    context?: HttpContext,
    headers?: HttpHeaders | Record<string, string>,
  ): Observable<T> {
    return this.http.get<T>(this.toUrl(endpoint), { params, context, headers });
  }

  post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(this.toUrl(endpoint), body);
  }

  put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(this.toUrl(endpoint), body);
  }

  patch<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.patch<T>(this.toUrl(endpoint), body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(this.toUrl(endpoint));
  }

  upload<T>(endpoint: string, body: FormData, params?: HttpParams): Observable<HttpEvent<T>> {
    return this.http.post<T>(this.toUrl(endpoint), body, {
      params,
      observe: 'events',
      reportProgress: true,
    });
  }

  getBlob(endpoint: string, params?: HttpParams): Observable<Blob> {
    return this.http.get(this.toUrl(endpoint), { params, responseType: 'blob' });
  }

  postFormData<T>(endpoint: string, body: FormData, params?: HttpParams): Observable<T> {
    return this.http.post<T>(this.toUrl(endpoint), body, { params });
  }

  private toUrl(endpoint: string): string {
    return `${this.baseUrl}/${endpoint.replace(/^\/+/, '')}`;
  }
}
