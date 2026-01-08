import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { CheckboxModule } from 'primeng/checkbox';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [ButtonModule, ToastModule, CheckboxModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  providers: [MessageService],
})
export class Login implements OnInit {
  username = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');
  sucesso = signal(false);
  rememberMe = false;
  loginRetries = 0;
  private router: Router = inject(Router);
  private sigaaService: SigaaService = inject(SigaaService);

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');
    if (!username || !password) return;
    this.username.set(username);
    this.password.set(password);
  }

  async onSubmit() {
    this.error.set('');
    this.sucesso.set(false);
    this.loading.set(true);

    try {
      const jsessionid = await this.sigaaService.login(this.username(), this.password());
      console.log('Login OK! JSESSIONID:', jsessionid);
      if (this.rememberMe) {
        localStorage.setItem('username', this.username());
        localStorage.setItem('password', this.password());
      }

      await this.sigaaService.fetchMainData();
      if (this.sigaaService.nome() === '' && this.loginRetries < 5) {
        this.loginRetries++;
        await this.onSubmit();
        this.loginRetries--;
        if (this.loginRetries !== 0) return;
      }
      this.router.navigate(['/']);

      this.sucesso.set(true);
    } catch (err: any) {
      console.error(err);
      this.error.set(err.message || 'Erro no login');
      this.showToast();
    } finally {
      this.loading.set(false);
    }
  }

  showToast() {
    this.messageService.add({
      severity: 'error',
      summary: 'Falha ao realizar login',
      detail: 'Ops! Algo deu errado',
    });
  }
}
