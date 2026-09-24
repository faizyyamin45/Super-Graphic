import { SERVICES } from './siteContent.js';
export const MEDIA_SERVICES = [...SERVICES.map(s=>({slug:s.slug,title:{en:s.title,ar:s.title}})),{slug:'fabrication',title:{en:'Structures & installation',ar:'Structures & installation'}}];
