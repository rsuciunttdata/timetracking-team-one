import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface AppUser {
    id: string;
    name: string;
}

@Injectable({
    providedIn: 'root'
})
export class UserService {
    constructor(private http: HttpClient) { }

    getUsers(): Observable<AppUser[]> {
        return this.http.get<AppUser[]>('/assets/users.json');
    }
}
