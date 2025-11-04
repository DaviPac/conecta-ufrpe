import { Routes } from '@angular/router';
import { Login } from './routes/login/login';
import { Dashboard } from './routes/dashboard/dashboard';
import { authGuard } from './guards/auth-guard';
import { Profile } from './routes/profile/profile';

export const routes: Routes = [
    { path: 'login', component: Login },
    { path: '', component: Dashboard, canActivate: [authGuard] },
    { path: 'profile', component: Profile, canActivate: [authGuard] }
];
