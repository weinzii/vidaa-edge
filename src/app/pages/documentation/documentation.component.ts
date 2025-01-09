import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-documentation',
  templateUrl: './documentation.component.html',
  styleUrls: ['./documentation.component.css'],
  standalone: true,
  imports: [RouterModule]
})
export class DocumentationComponent implements OnInit {
  constructor() { }

  ngOnInit() {
  }

}
