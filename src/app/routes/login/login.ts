import { Component, inject, signal } from '@angular/core'
import { CommonModule } from '@angular/common'
import { SigaaService } from '../../services/sigaaService/sigaa.service'
import { Router } from '@angular/router'

@Component({
  selector: 'app-login',
  imports: [CommonModule],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {

  username = signal('')
  password = signal('')
  loading = signal(false)
  error = signal('')
  sucesso = signal(false)
  private router: Router = inject(Router)
  private sigaaService: SigaaService = inject(SigaaService)

  async onSubmit() {
    this.error.set('')
    this.sucesso.set(false)
    this.loading.set(true)

    try {
      const jsessionid = await this.sigaaService.login(
        this.username(),
        this.password()
      )
      console.log('Login OK! JSESSIONID:', jsessionid)

      await this.sigaaService.fetchMainData()
      this.router.navigate(['/'])

      this.sucesso.set(true)
    } catch (err: any) {
      console.error(err)
      this.error.set(err.message || 'Erro no login')
    } finally {
      this.loading.set(false)
    }
  }
}
