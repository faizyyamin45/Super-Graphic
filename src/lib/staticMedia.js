import manifest from '../../server/seed-media/manifest.json';
export const staticMedia=manifest.map(item=>({...item,url:'/images/'+item.filename}));
