import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SigaaService } from '../services/sigaaService/sigaa.service';
import { PwaService } from '../services/pwa/pwa.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit {
  private router = inject(Router);
  private sigaaService = inject(SigaaService);
  private pwaService = inject(PwaService);

  isMobileMenuOpen = signal<boolean>(false);
  hasUpdate = computed(() => this.pwaService.updateStatus() === 'available');

  ngOnInit(): void {
    this.pwaService.checkForUpdate();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen.update((value) => !value);
  }

  async navigate(route: string) {
    await this.router.navigate([route]);
    this.isMobileMenuOpen.set(false);
  }

  logout() {
    this.sigaaService.logout();
  }

  nome(): string | undefined {
    return this.sigaaService.nome();
  }

  isAuthenticated() {
    return this.sigaaService.isAuthenticated();
  }
}