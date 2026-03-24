import { Injectable, WritableSignal, signal, inject } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

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
  | 'not-supported'
  | 'error';

@Injectable({ providedIn: 'root' })
export class PwaService {
  updateStatus: WritableSignal<UpdateStatus> = signal('idle');
  storageEstimate: WritableSignal<StorageEstimate | null> = signal(null);
  isLoadingStorage: WritableSignal<boolean> = signal(false);
  canInstall = signal<boolean>(false);
  
  private deferredPrompt: any = null;
  // 1. Injetamos o SwUpdate do Angular
  private swUpdate = inject(SwUpdate);

  get isSwActive(): boolean {
    // Retorna true se o Angular Service Worker estiver ativo no ambiente
    return this.swUpdate.isEnabled;
  }

  constructor() {
    this.listenForUpdates();
    this.listenForInstallPrompt();
  }

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.canInstall.set(true);
    });

    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
    });
  }

  async installApp(): Promise<void> {
    if (!this.deferredPrompt) return;
    
    this.deferredPrompt.prompt();
    const { outcome } = await this.deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      this.canInstall.set(false);
    }
    this.deferredPrompt = null;
  }

  // ─── Service Worker (Usando Angular SwUpdate) ─────────────────────────────

  private listenForUpdates(): void {
    if (!this.swUpdate.isEnabled) return;

    // Escuta ativamente caso o Service Worker encontre uma atualização sozinho 
    // (com base na estratégia de registro registrationStrategy)
    this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.updateStatus.set('available');
      });
  }

  async checkForUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) {
      this.updateStatus.set('not-supported');
      setTimeout(() => this.updateStatus.set('idle'), 3500);
      return;
    }

    this.updateStatus.set('checking');

    try {
      // checkForUpdate() força o ngsw-worker a baixar o ngsw.json e comparar hashes
      const hasUpdate = await this.swUpdate.checkForUpdate();
      
      if (hasUpdate) {
        this.updateStatus.set('available');
      } else {
        this.updateStatus.set('up-to-date');
        setTimeout(() => this.updateStatus.set('idle'), 3500);
      }
    } catch (e) {
      console.error('Erro ao verificar atualização PWA:', e);
      this.updateStatus.set('error');
      setTimeout(() => this.updateStatus.set('idle'), 3500);
    }
  }

  async applyUpdate(): Promise<void> {
    if (!this.swUpdate.isEnabled) return;
    
    this.updateStatus.set('updating');
    
    try {
      // Informa ao Service Worker ativo para ativar imediatamente a nova versão
      await this.swUpdate.activateUpdate();
      
      // Recarrega a página para carregar os novos arquivos do cache atualizado
      window.location.reload();
    } catch (error) {
      console.error('Erro ao aplicar atualização PWA:', error);
      this.updateStatus.set('error');
      setTimeout(() => this.updateStatus.set('idle'), 3500);
    }
  }

  // ─── Storage (Manteve-se igual) ────────────────────────────────────────────

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