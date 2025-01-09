import { Component, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ConsoleModalComponent } from "./components/console-modal/console-modal.component";

@Component({
  imports: [RouterModule, ConsoleModalComponent, ConsoleModalComponent],
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  @ViewChild(ConsoleModalComponent) consoleModalComponent!: ConsoleModalComponent;

  constructor() { }

  openConsoleModal(): void {
    this.consoleModalComponent.openModal();
  }
}
