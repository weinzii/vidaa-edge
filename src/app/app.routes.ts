import { Route } from '@angular/router';
import { StartComponent } from 'src/app/pages/start/start.component';
import { DocumentationComponent } from './pages/documentation/documentation.component';
import { GettingStartedComponent } from './pages/documentation/pages/getting-started/getting-started.component';
import { HostedComponent } from './pages/documentation/pages/hosted/hosted.component';
import { SelfHostedComponent } from './pages/documentation/pages/self-hosted/self-hosted.component';
import { ApiComponent } from './pages/documentation/pages/api/api.component';
import { InstallationComponent } from './pages/documentation/pages/installation/installation.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: StartComponent,
    pathMatch: 'full',
    title: 'Vidaahub - Manage',
  },
  {
    path: 'documentation',
    title: 'Vidaahub - Getting Started',
    component: DocumentationComponent,
    children: [
      {
        path: '',
        component: GettingStartedComponent,
        title: 'Vidaahub - Getting Started',
      },
      {
        path: 'hosted',
        component: HostedComponent,
        title: 'Vidaahub - Hosted',
      },
      {
        path: 'self-hosted',
        component: SelfHostedComponent,
        title: 'Vidaahub - Self-hosted',
      },
      {
        path: 'installation',
        component: InstallationComponent,
        title: 'Vidaahub - Apps',
      },
      {
        path: 'api',
        component: ApiComponent,
        title: 'Vidaahub - Hisense API',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
