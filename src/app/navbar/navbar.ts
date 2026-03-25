import { Component, OnInit, inject, signal, computed, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { SigaaService } from '../services/sigaaService/sigaa.service';
import { PwaService } from '../services/pwa/pwa.service';
import { filter, Subscription } from 'rxjs';

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
  private cdr = inject(ChangeDetectorRef);

  private routerSub?: Subscription;

  isMobileMenuOpen = signal<boolean>(false);
  hasUpdate = computed(() => this.pwaService.updateStatus() === 'available');

  // Adicionando o ciclo de vida ngOnInit
  ngOnInit(): void {
    // Dispara a verificação de atualização assim que a navbar for renderizada
    this.pwaService.checkForUpdate();
    this.routerSub = this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe(() => this.cdr.markForCheck());
  }

  ngOnDestroy(): void {
      this.routerSub?.unsubscribe();
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