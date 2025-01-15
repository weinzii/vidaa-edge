import { Component, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConsoleModalComponent } from "./components/console-modal/console-modal.component";
import { NgIf } from '@angular/common';

@Component({
  imports: [RouterModule, ConsoleModalComponent, ConsoleModalComponent, NgIf],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  @ViewChild(ConsoleModalComponent) consoleModalComponent!: ConsoleModalComponent;
  isMobileMenuOpen = false;

  constructor() { }

  openConsoleModal(): void {
    this.consoleModalComponent.openModal();
  }

  toggleMobileMenu() {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }
}
