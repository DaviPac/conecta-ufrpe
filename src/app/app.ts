import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './navbar/navbar';
import { SigaaService } from './services/sigaaService/sigaa.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('conecta-ufrpe');
  protected readonly sigaaService = inject(SigaaService);
}
