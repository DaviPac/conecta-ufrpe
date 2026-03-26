import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { PwaService } from '../../services/pwa/pwa.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings implements OnInit {
  protected readonly sigaaService = inject(SigaaService);
  protected readonly pwaService = inject(PwaService);
  private readonly router = inject(Router);

  confirmingClear = signal<'cache' | 'all' | null>(null);
  clearingCache = signal(false);

  ngOnInit(): void {
    this.pwaService.loadStorageEstimate();
  }

  async onCheckUpdate(): Promise<void> {
    await this.pwaService.checkForUpdate();
  }

  onInstallApp(): void {
    this.pwaService.installApp();
  }

  async onApplyUpdate(): Promise<void> {
    await this.pwaService.applyUpdate();
  }

  requestClear(type: 'cache' | 'all'): void {
    this.confirmingClear.set(type);
  }

  cancelClear(): void {
    this.confirmingClear.set(null);
  }

  async confirmClear(): Promise<void> {
    const type = this.confirmingClear();
    if (!type) return;

    this.clearingCache.set(true);
    this.confirmingClear.set(null);

    try {
      if (type === 'all') {
        await this.pwaService.clearAllData();
        this.sigaaService.logout();
      } else {
        await this.pwaService.clearCache();
      }
    } finally {
      this.clearingCache.set(false);
    }
  }

  onLogout(): void {
    this.sigaaService.logout();
  }
}
