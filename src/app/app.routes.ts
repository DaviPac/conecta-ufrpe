import { Routes } from '@angular/router';
import { Login } from './routes/login/login';
import { Dashboard } from './routes/dashboard/dashboard';
import { authGuard } from './guards/auth-guard';
import { Profile } from './routes/profile/profile';
import { Calendario } from './routes/calendario/calendario';
import { TurmaDetail } from './routes/turma-detail/turma-detail';
import { loginGuard } from './guards/login-guard';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [loginGuard] },
  { path: '', component: Dashboard, canActivate: [authGuard] },
  { path: 'profile', component: Profile, canActivate: [authGuard] },
  { path: 'calendario', component: Calendario, canActivate: [authGuard] },
  { path: 'turma', component: TurmaDetail, canActivate: [authGuard] },
];
