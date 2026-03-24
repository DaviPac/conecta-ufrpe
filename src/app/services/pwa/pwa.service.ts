import { Injectable, WritableSignal, signal } from '@angular/core';

export interface StorageEstimate {
  usage: number;
  quota: number;
  percent: number;
  caches: CacheEntry[];
}

export interface CacheEntry {
  name: string;
  size: number;
  count: number;
}

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'updating'
  | 'up-to-date'
  | 'not-supported' // sem SW ativo (localhost sem PWA instalado)
  | 'error';

@Injectable({ providedIn: 'root' })
export class PwaService {
  updateStatus: WritableSignal<UpdateStatus> = signal('idle');
  storageEstimate: WritableSignal<StorageEstimate | null> = signal(null);
  isLoadingStorage: WritableSignal<boolean> = signal(false);
  canInstall = signal<boolean>(false);
  private deferredPrompt: any = null;

  private waitingWorker: ServiceWorker | null = null;

  /** true somente quando há um SW ativo controlando a página */
  get isSwActive(): boolean {
    return 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
  }

  constructor() {
    this.listenForUpdates();
    this.listenForInstallPrompt();
  }

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      // Previne o mini-infobar de aparecer em dispositivos móveis
      e.preventDefault();
      // Guarda o evento para ser disparado depois
      this.deferredPrompt = e;
      // Atualiza a interface avisando que pode instalar
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      // Limpa o evento após a instalação concluída
      this.deferredPrompt = null;
      this.canInstall.set(false);
    });
  }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) return;
    
    // Mostra o prompt de instalação nativo
    this.deferredPrompt.prompt();
    
    // Aguarda a resposta do usuário
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      this.canInstall.set(false);
    }
    
    // O prompt só pode ser usado uma vez
    this.deferredPrompt = null;
  }

  // ─── Service Worker ────────────────────────────────────────────────────────

  private listenForUpdates(): void {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.ready.then(registration => {
      if (registration.waiting) {
        this.waitingWorker = registration.waiting;
        this.updateStatus.set('available');
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            this.waitingWorker = newWorker;
            this.updateStatus.set('available');
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }

  async checkForUpdate(): Promise<void> {
    // Sem SW ativo: ambiente de dev / localhost sem PWA instalado
    if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
      this.updateStatus.set('not-supported');
      setTimeout(() => this.updateStatus.set('idle'), 3500);
      return;
    }

    this.updateStatus.set('checking');

    try {
      const registration = await navigator.serviceWorker.ready;
      
      // Pede ao navegador para buscar o novo Service Worker no servidor
      await registration.update();

      // Se encontrou uma nova versão, o SW entra no estado de "installing".
      // Vamos aguardar o término da instalação dinamicamente em vez de usar setTimeout.
      if (registration.installing) {
        const newWorker = registration.installing;
        
        await new Promise<void>((resolve) => {
          const listener = () => {
            if (newWorker.state === 'installed' || newWorker.state === 'redundant') {
              newWorker.removeEventListener('statechange', listener);
              resolve();
            }
          };
          
          // Prevenção caso o status já tenha mudado muito rápido
          if (newWorker.state === 'installed' || newWorker.state === 'redundant') {
            resolve();
          } else {
            newWorker.addEventListener('statechange', listener);
          }
        });
      }

      // Após aguardar todo o processo, verificamos qual é o resultado real
      if (registration.waiting) {
        this.waitingWorker = registration.waiting;
        this.updateStatus.set('available');
      } else {
        // Se não tem nenhum SW em "waiting", realmente não havia atualização
        this.updateStatus.set('up-to-date');
        setTimeout(() => this.updateStatus.set('idle'), 3500);
      }
    } catch (e) {
      this.updateStatus.set('error');
      setTimeout(() => this.updateStatus.set('idle'), 3500);
    }
  }

  applyUpdate(): void {
    if (!this.waitingWorker) return;
    this.updateStatus.set('updating');
    this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  // ─── Storage ───────────────────────────────────────────────────────────────

  async loadStorageEstimate(): Promise<void> {
    this.isLoadingStorage.set(true);
    try {
      const estimate = await navigator.storage?.estimate();
      const cacheEntries = await this.getCacheEntries();

      this.storageEstimate.set({
        usage: estimate?.usage ?? 0,
        quota: estimate?.quota ?? 0,
        percent: estimate?.quota
          ? Math.round(((estimate.usage ?? 0) / estimate.quota) * 100)
          : 0,
        caches: cacheEntries,
      });
    } catch {
      this.storageEstimate.set(null);
    } finally {
      this.isLoadingStorage.set(false);
    }
  }

  private async getCacheEntries(): Promise<CacheEntry[]> {
    if (!('caches' in window)) return [];
    const cacheNames = await caches.keys();
    const entries: CacheEntry[] = [];

    for (const name of cacheNames) {
      const cache = await caches.open(name);
      const keys = await cache.keys();
      let size = 0;

      for (const req of keys) {
        const res = await cache.match(req);
        if (res) {
          const blob = await res.clone().blob().catch(() => null);
          if (blob) size += blob.size;
        }
      }

      entries.push({ name, size, count: keys.length });
    }

    return entries;
  }

  async clearCache(cacheName?: string): Promise<void> {
    if (!('caches' in window)) return;
    if (cacheName) {
      await caches.delete(cacheName);
    } else {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
    await this.loadStorageEstimate();
  }

  async clearAllData(): Promise<void> {
    await this.clearCache();
    localStorage.clear();
    sessionStorage.clear();
    await this.loadStorageEstimate();
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }
}