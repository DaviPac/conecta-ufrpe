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

  // Ao invés de setar false automático, não fazemos nada. 
  // O usuário terá que clicar no botão de reconectar!
  private onlineHandler = () => {
    // console.log("Internet voltou, mas exigindo clique para sincronizar dados.");
  };
  
  // Se cair a internet, mostra o aviso.
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
      // Busca os novos dados
      await this.sigaaService.fetchMainData();
      
      // APENAS AQUI O AVISO SOME (após o sucesso da atualização)
      this.isOffline.set(false);
    } catch(error) {
      console.error('Falha ao reconectar:', error);
      alert('Não foi possível obter os dados. Tente novamente.');
    } finally {
      this.isReconnecting.set(false);
    }
  }
}