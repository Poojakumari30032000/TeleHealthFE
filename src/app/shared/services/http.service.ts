import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from 'environments/environment';

@Injectable({
  providedIn: 'root',
})
export class HttpService {
  private baseUrl: string;
  public spinner$: Subject<any>;

  constructor(private http: HttpClient, private router: Router) {
    this.baseUrl = `${environment.PROTOCOL}://${environment.baseURL}/`;
    this.spinner$ = new Subject<any>();
  }

  private getHeaders(): HttpHeaders {

    let headers = new HttpHeaders().set('Content-Type', 'application/json');

    if (typeof window !== 'undefined') {
      let authToken = localStorage.getItem('isolHealthToken') ||  null;
      if (authToken) {
        headers = headers.set('Authorization', `Bearer ${authToken}`);
      }
    }
    return headers;
  }

  public onError(error: any): Promise<any> {
    if (error.status === 401 || error.status === 403) {
      this.router.navigate(['/login']);
    }
    return Promise.reject(error);
  }

  get(url: string): Observable<any> {
    return this.http.get(`${this.baseUrl}${url}`, {
      headers: this.getHeaders(),
    });
  }

  post(url: string, data: any): Observable<any> {
    return this.http.post(`${this.baseUrl}${url}`, data, {
      headers: this.getHeaders(),
    });
  }

  downloadFile(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
}
