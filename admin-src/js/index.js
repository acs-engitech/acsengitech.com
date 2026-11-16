import '../css/style.css';
import '../css/theme.css';
import Alpine from 'alpinejs';
import { adminShell } from './shell.js';
window.Alpine = Alpine;
Alpine.data('adminShell', adminShell);
Alpine.start();
import './admin-app.js';
