import { Directive, ElementRef, Output, EventEmitter, HostListener } from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  @Output() appClickOutside = new EventEmitter<void>();

  constructor(private elementRef: ElementRef) {}

  @HostListener('document:click', ['$event.target'])
  public onClick(targetElement: EventTarget | null): void {
    // 1. Se não houver alvo no evento, ignoramos
    if (!targetElement) {
      return;
    }

    // 2. Verificamos se o clique foi dentro do elemento. 
    // Usamos 'as Node' porque o método nativo 'contains' espera um tipo Node.
    const clickedInside = this.elementRef.nativeElement.contains(targetElement as Node);
    
    // 3. Se foi fora, emite o evento para fechar a legenda
    if (!clickedInside) {
      this.appClickOutside.emit();
    }
  }
}