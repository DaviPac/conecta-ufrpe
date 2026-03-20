import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({
  name: 'linkify',
  standalone: true // Como você está usando @if/@for (Angular 17+), o pipe standalone é o ideal
})
export class LinkifyPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    if (!value) return value;
    
    // Regex para encontrar URLs que começam com http ou https
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    
    // Substitui a URL por uma tag <a> estilizada
    const linkified = value.replace(
      urlRegex, 
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline decoration-blue-300 hover:decoration-blue-600 transition-all">$1</a>'
    );

    // Diz ao Angular que este HTML é seguro para ser renderizado
    return this.sanitizer.bypassSecurityTrustHtml(linkified);
  }
}