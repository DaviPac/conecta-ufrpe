import { Component, OnInit, inject, signal, computed, OnDestroy } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { SigaaService } from '../services/sigaaService/sigaa.service';
import { PwaService } from '../services/pwa/pwa.service';

@Component({
  selector: 'app-navbar',
  imports: [RouterModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss',
})
export class Navbar implements OnInit, OnDestroy {
  private router = inject(Router);
  private sigaaService = inject(SigaaService);
  private pwaService = inject(PwaService);

  isOffline = signal<boolean>(!navigator.onLine);
  isReconnecting = signal<boolean>(false);
  isMobileMenuOpen = signal<boolean>(false);
  hasUpdate = computed(() => this.pwaService.updateStatus() === 'available');

  private onlineHandler = () => this.isOffline.set(false);
  private offlineHandler = () => this.isOffline.set(true);

  ngOnInit(): void {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
    this.pwaService.checkForUpdate();
  }

  ngOnDestroy(): void {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
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

  async reconnect() {
    if (!navigator.onLine) {
      alert('Ainda sem conexão. Verifique sua internet.');
      return;
    }
    
    this.isReconnecting.set(true);
    
    try {
      // Chama o fetch novamente. Como você já ajustou o SigaaService,
      // ele vai tentar buscar os dados novos!
      await this.sigaaService.fetchMainData();
    } finally {
      this.isReconnecting.set(false);
    }
  }
}