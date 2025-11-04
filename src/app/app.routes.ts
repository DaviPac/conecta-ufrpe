import { Routes } from '@angular/router';
import { Login } from './routes/login/login';
import { Dashboard } from './routes/dashboard/dashboard';
import { authGuard } from './guards/auth-guard';

export const routes: Routes = [
    { path: '', component: Login },
    { path: '', component: Dashboard, canActivate: [authGuard] }
];
