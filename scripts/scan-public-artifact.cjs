'use strict';
const fs = require('node:fs'), path = require('node:path');
function inspect(relative, contents) {
  if (/(^|\/)(\.env[^/]*|\.git|\.tools|node_modules|backend|tests|email-templates)(\/|$)|\.(budbackup|pem|p12|key)$|service.account.*\.json$/i.test(relative)) return 'private-file';
  const text = contents.toString('utf8');
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|"type"\s*:\s*"service_account"|APP_USR-[a-zA-Z0-9_-]{30,}|gh[pousr]_[a-zA-Z0-9]{30,}|gsk_[a-zA-Z0-9]{30,}/.test(text)) return 'private-credential';
  return null;
}
function scan(dir, base = dir) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir,item.name), relative = path.relative(base,file).replaceAll('\\','/');
    if (item.isSymbolicLink()) throw Error('Public artifact contains a symbolic link');
    if (item.isDirectory()) scan(file,base);
    else { const issue = inspect(relative,fs.readFileSync(file)); if (issue) throw Error('Publication blocked: ' + issue + ' in ' + relative); }
  }
}
if (require.main === module) { try { scan(path.resolve(__dirname,'../dist/site')); console.log('Public artifact secret scan passed.'); } catch (error) { console.error(error.message); process.exitCode=1; } }
module.exports = { inspect, scan };
