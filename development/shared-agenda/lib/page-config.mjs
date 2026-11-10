// Puts the public Google OAuth client ID into the page so google-sign-in.js can start sign-in.
// Only a strictly formatted ID is inserted; anything else leaves the page unconfigured (sign-in refuses, local data kept).
export function withGoogleClientId(html,clientId){
 if(typeof clientId!=='string'||!/^[A-Za-z0-9._-]{1,200}$/.test(clientId))return html;
 return html.replace('<head>','<head><meta name="lifepilot-google-client-id" content="'+clientId+'">');
}
