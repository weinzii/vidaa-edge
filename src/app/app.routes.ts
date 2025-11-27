import { Route } from '@angular/router';
import { InstallerComponent } from './pages/installer/installer.component';
import { RemoteConsoleComponent } from './components/remote-console/remote-console.component';
import { FileExplorerComponent } from './components/file-explorer/file-explorer.component';
import { CanDeactivateFileExplorerGuard } from './guards/can-deactivate-file-explorer.guard';

export const appRoutes: Route[] = [
  {
    path: '',
    component: InstallerComponent,
    pathMatch: 'full',
    title: 'VidaaEdge - Install Apps',
  },
  {
    path: 'console',
    component: RemoteConsoleComponent,
    title: 'VidaaEdge - Remote Console',
  },
  {
    path: 'file-explorer',
    component: FileExplorerComponent,
    title: 'VidaaEdge - File System Explorer',
    canDeactivate: [CanDeactivateFileExplorerGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
