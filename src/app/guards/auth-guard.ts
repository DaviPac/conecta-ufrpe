import { CanActivateFn, Router } from '@angular/router';
import { SigaaService } from '../services/sigaaService/sigaa.service';
import { inject } from '@angular/core';

export const authGuard: CanActivateFn = (_route, _state) => {
  const router = inject(Router);
  const sigaaService = inject(SigaaService);
  if (sigaaService.isAuthenticated()) return true;
  else {
    router.navigate(['/login']);
    return false;
  }
};
