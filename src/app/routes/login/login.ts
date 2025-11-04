import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  username = signal('');
  password = signal('');
  rememberMe = signal(false);
  loading = signal(false);
  error = signal('');
  sucesso = signal(false);
  private router: Router = inject(Router);
  private sigaaService: SigaaService = inject(SigaaService);

  ngOnInit(): void {
      const username = localStorage.getItem("username")
      const password = localStorage.getItem("password")
      if (!username || !password) return
      this.username.set(username)
      this.password.set(password)
  }

  async onSubmit() {
    this.error.set('');
    this.sucesso.set(false);
    this.loading.set(true);

    try {
      const jsessionid = await this.sigaaService.login(this.username(), this.password());
      console.log('Login OK! JSESSIONID:', jsessionid);
      if (this.rememberMe()) {
        localStorage.setItem("username", this.username())
        localStorage.setItem("password", this.password())
      }

      await this.sigaaService.fetchMainData();
      this.router.navigate(['/']);

      this.sucesso.set(true);
    } catch (err: any) {
      console.error(err);
      this.error.set(err.message || 'Erro no login');
    } finally {
      this.loading.set(false);
    }
  }
}
