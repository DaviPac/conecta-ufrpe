import { CanActivateFn, Router , UrlTree} from '@angular/router';
import { SigaaService } from '../services/sigaaService/sigaa.service';
import { inject } from '@angular/core';

export const loginGuard: CanActivateFn = (route, state): boolean | UrlTree => {
  const sigaaService = inject(SigaaService)
  const router = inject(Router)
  if (sigaaService.isAuthenticated()) {
    return router.createUrlTree(['/'])
  }
  return true;
};
