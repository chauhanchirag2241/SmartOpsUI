import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Hosts homework list and detail child routes. */
@Component({
  selector: 'app-homework-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class HomeworkShellComponent {}
