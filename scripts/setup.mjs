import {existsSync,writeFileSync} from 'node:fs';
import {randomBytes,scryptSync} from 'node:crypto';
if(existsSync('.env')){console.log('Existing .env preserved. Run npm run dev to start.');process.exit(0)}
const password='SG-'+randomBytes(18).toString('base64url');
const salt=randomBytes(16).toString('hex');
writeFileSync('.env',`SITE_ORIGIN=http://127.0.0.1:5173\nVITE_MEDIA_BACKEND=server\nPORT=3001\nHOST=127.0.0.1\nADMIN_PASSWORD_HASH=${salt}:${scryptSync(password,salt,64).toString('hex')}\nMEDIA_DATA_DIR=.media-data\nTRUST_PROXY_HOPS=0\n`);
writeFileSync('.admin-access.txt',`Admin: http://127.0.0.1:5173/admin\nPassword: ${password}\nKeep this file private.\n`);
console.log('Local backend configured. Your password is in .admin-access.txt. Run npm run dev.');
