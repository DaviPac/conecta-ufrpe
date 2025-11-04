import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SigaaService } from '../services/sigaaService/sigaa.service';

@Component({
  selector: 'app-navbar',
  imports: [
    RouterModule
  ],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class Navbar {
  private router = inject(Router);
  private sigaaService = inject(SigaaService);

  isMobileMenuOpen = signal<boolean>(false);

  toggleMobileMenu() {
    this.isMobileMenuOpen.update(value => !value);
  }
  
  async navigate(route: string) {
    await this.router.navigate([route]);
    this.isMobileMenuOpen.set(false);
  }

  logout() {
    //this.sigaaService.logout();
    this.router.navigate(['/login']);
  }

  nome(): string | undefined {
    return this.sigaaService.nome();
  }

  isAuthenticated() {
    return this.sigaaService.isAuthenticated()
  }

}
