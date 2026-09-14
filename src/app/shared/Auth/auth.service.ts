import { Injectable } from "@angular/core";
import { BehaviorSubject, Observable, Subject, tap } from "rxjs";
import { HttpService } from "../services/http.service";
import { jwtDecode } from "jwt-decode";

interface UserData {
  token: string;
  userId: number;
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  title: string;
  gender: string;
  email: string;
  phone: string;
  addressType: string;
  address: string;
  stateId: number;
  cityId: number;
  zipCode: string;
  status: string;
  taxId: string;
  medicaid: string;
  caqhId: string;
  npi: string;
  license: string;
  ssn: string;
  dea: string;
  loginId: number;
  roleId: number;
  roleName: string;
  facilityId: number;
  facilityGuid: string;
  organizationId: number;
  photoURL: string;
  patientId: number;
  profileUrl: string;
}

interface JwtPayload {
  RoleId: number;
  RoleName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = new BehaviorSubject<UserData | null>(null);
  private previousUserId: number | null = null;

  readonly logout$ = new Subject<void>();

  /**
   * Emitted whenever the signed-in identity changes - after a successful login and
   * after a session is restored from storage on app start.
   *
   * PermissionsService subscribes to this to (re)load the user's permissions from the
   * server. The dependency runs one way only: PermissionsService knows about
   * AuthService, never the reverse, so adding this subject avoids a circular
   * injection while still letting permissions react to a sign-in.
   */
  readonly userChanged$ = new Subject<void>();

  constructor(private http: HttpService) {
    this.initializeFromStorage();

    const initialUser = this.currentUser.value;
    if (initialUser) {
      this.previousUserId = initialUser.userId;
    }
  }

  getPreviousUserId(): number | null {
    return this.previousUserId;
  }

  hasUserChanged(newUserId: number): boolean {
    return this.previousUserId !== null && this.previousUserId !== newUserId;
  }

  private initializeFromStorage(): void {
    const userData =localStorage.getItem('userData');
    const token = localStorage.getItem('isolHealthToken');
    if (userData && token) {
      try {
          const decoded = jwtDecode<JwtPayload>(token);
          const formatedData = {
            ...JSON.parse(userData),
            roleId: decoded.RoleId,
            roleName: decoded.RoleName
          };
          this.currentUser.next(formatedData);
          this.userChanged$.next();
      } catch {
          const theme = localStorage.getItem('theme') || '';
          const rememberedEmail = localStorage.getItem('rememberedEmail') || '';
          localStorage.clear();
          localStorage.setItem('theme', theme);
          localStorage.setItem('rememberedEmail', rememberedEmail);
      }
    }
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`Accounts/login`, { email, password }).pipe(
      tap({
        next: (res) => this.handleLoginResponse(res),
        error: () => {
            const theme = localStorage.getItem('theme') || '';
            const rememberedEmail = localStorage.getItem('rememberedEmail') || '';
            localStorage.clear();
            localStorage.setItem('theme', theme);
            localStorage.setItem('rememberedEmail', rememberedEmail);
        }
      })
    );
  }

  private handleLoginResponse(res: any): void {
    if (res.status === 1) {
      const token = res.data.token;
      localStorage.setItem('isolHealthToken', token);
      try {
        const decoded = jwtDecode<JwtPayload>(token);
        const userData = {
            ...res.data,
            roleId: decoded.RoleId,
            roleName: decoded.RoleName
        };
        localStorage.setItem('userData', JSON.stringify(userData));

        const newUserId = userData.userId;
        this.previousUserId = newUserId;

        this.currentUser.next(userData as UserData);
        this.userChanged$.next();
        localStorage.setItem('OFL', userData.organizationId);
        if(userData.roleName === 'Global Admin' && userData.roleName === 'Provider')return;
        localStorage.setItem('FOS', userData?.facilityId )
        localStorage.setItem('FOSG', userData?.facilityGuid )
      } catch (error) {
        const userData = res.data;
        const newUserId = userData.userId;

        this.previousUserId = newUserId;

        localStorage.setItem('userData', JSON.stringify(userData));
        this.currentUser.next(userData as UserData);
        this.userChanged$.next();
        localStorage.setItem('OFL', res.data.organizationId);
        if(res.data.roleName === 'Global Admin' && res.data.roleName === 'Provider')return;
        localStorage.setItem('FOS', res.data?.facilityId);
        localStorage.setItem('FOSG', res.data?.facilityGuid);
      }
    }
  }

  logout(): void {
    const theme = localStorage.getItem('theme') || '';
    const rememberedEmail = localStorage.getItem('rememberedEmail') || '';
    localStorage.clear();
    localStorage.setItem('theme', theme);
    localStorage.setItem('rememberedEmail', rememberedEmail);
    this.previousUserId = null;
    this.currentUser.next(null);

    this.logout$.next();
  }

  getToken(): string | null {

    return localStorage.getItem('isolHealthToken');
  }

  getUserName(): string | null {
    return this.currentUser.value?.firstName + " " + this.currentUser.value?.lastName || null;
  }

  getUserData(): UserData | null {
    return this.currentUser.value || null;
  }

  getUserId(): number | null {
    return this.currentUser.value?.userId || null;
  }

  getUserLoginId(): number | null {
    return this.currentUser.value?.loginId || null;
  }

  getUserRoleId(): number | null {
    return this.currentUser.value?.roleId || null;
  }

  getUserRole(): string | null {
    return this.currentUser.value?.roleName || null;
  }

  getPatientId(): number | null {
    return this.currentUser.value?.patientId || null;
  }

  getProfileUrl(): string | null {
    return this.currentUser.value?.profileUrl || null;
  }

  getUserFacilityId(): number | null {
    return this.currentUser.value?.facilityId || null;
  }

  isAuthenticated(): boolean {
    return !!this.currentUser.value?.token;
  }
}
