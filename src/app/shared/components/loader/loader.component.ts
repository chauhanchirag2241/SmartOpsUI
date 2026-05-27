import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

import { LoaderService } from '../../../core/services/loader.service';

@Component({
  selector: 'app-loader',
  imports: [MatIconModule],
  templateUrl: './loader.component.html',
  styleUrl: './loader.component.css',
})
export class LoaderComponent {
  protected readonly loader = inject(LoaderService);
}
