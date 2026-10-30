import '../css/ops.css';
import Alpine from 'alpinejs';
import { opsApp } from './app.js';

window.Alpine = Alpine;
Alpine.data('ops', opsApp);
Alpine.start();
