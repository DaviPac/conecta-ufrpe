import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Login } from './routes/login/login';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Login],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('conecta-ufrpe');
}
