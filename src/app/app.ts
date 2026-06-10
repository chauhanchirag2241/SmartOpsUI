import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SchoolConfigService } from './core/services/school-config.service';
import { LoaderComponent } from './shared/components/loader/loader.component';

@Component({
  selector: 'app-root',
  imports: [LoaderComponent, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly schoolConfig = inject(SchoolConfigService);

  ngOnInit(): void {
    void this.schoolConfig.loadForCurrentHost();
  }
}
