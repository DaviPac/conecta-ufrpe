import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SigaaService } from '../../services/sigaaService/sigaa.service';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputGroupModule } from 'primeng/inputgroup';
import { InputGroupAddonModule } from 'primeng/inputgroupaddon';
import { FluidModule } from 'primeng/fluid';
import { ToastModule } from 'primeng/toast';
import { IftaLabelModule } from 'primeng/iftalabel';
import { CheckboxModule } from 'primeng/checkbox';
import { PasswordModule } from 'primeng/password';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-login',
  imports: [
    ButtonModule,
    ToastModule,
    CheckboxModule,
    FormsModule,
    InputTextModule,
    FluidModule,
    InputGroupModule,
    InputGroupAddonModule,
    PasswordModule,
    IftaLabelModule,
    ReactiveFormsModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss',
  providers: [MessageService],
})
export class Login implements OnInit {
  username = '';
  password = '';
  isUsernameInvalid = false;
  isPasswordInvalid = false;
  rememberMe = false;
  loading = false;
  errorMessage = '';
  loginRetries = 0;

  constructor(private messageService: MessageService, private router: Router, private sigaaService: SigaaService) {}

  ngOnInit(): void {
    const username = localStorage.getItem('username');
    const password = localStorage.getItem('password');
    if (!username || !password) return;
    this.username = username;
    this.password = password;
  }

  async onSubmit() {
    this.loading = true;
    this.errorMessage = '';
    this.isPasswordInvalid = false;
    this.isUsernameInvalid = false;

    if(!this.username) {
      this.isUsernameInvalid = true;
    }
    if (!this.password) {
      this.isPasswordInvalid = true;
    }
    if(this.isUsernameInvalid || this.isPasswordInvalid) {
      this.errorMessage = 'Campos inválidos';
      this.showToast('Falha ao efetuar login', 'Preencha todos os campos.');
    } else {
      try {
        const jsessionid = await this.sigaaService.login(this.username, this.password);
        console.log('Login OK! JSESSIONID:', jsessionid);
        if (this.rememberMe) {
          localStorage.setItem('username', this.username);
          localStorage.setItem('password', this.password);
        }

        await this.sigaaService.fetchMainData();
        if (this.sigaaService.nome() === '' && this.loginRetries < 5) {
          this.loginRetries++;
          await this.onSubmit();
          this.loginRetries--;
          if (this.loginRetries !== 0) return;
        }
        this.router.navigate(['/']);
      } catch (err: any) {
        this.errorMessage = err.message ? err.message : 'Falha ao efetuar login';
        this.showToast('Falha ao efetuar login', 'Ops! Algo deu errado.');
      }
    }
      this.loading = false;
  }

  showToast(title: string, message: string) {
    this.messageService.add({
      severity: 'error',
      summary: title,
      detail: message,
    });
  }
}
