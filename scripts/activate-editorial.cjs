const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {parse}=require('parse5');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.scratch/design-manifest.json')));
const report=JSON.parse(fs.readFileSync(path.join(root,'.scratch/editorial-verification.json')));
const resolve=file=>{const target=path.resolve(root,file);if(!target.startsWith(root+path.sep))throw new Error('Path outside repository');return target;};
function metadata(html){
 const result=[];
 function visit(n){
  const attr=name=>n.attrs?.find(a=>a.name===name)?.value;
  if(n.tagName==='title'||n.tagName==='meta'||(n.tagName==='link'&&attr('rel')==='canonical')||(n.tagName==='script'&&attr('type')==='application/ld+json'))result.push(JSON.stringify({tag:n.tagName,attrs:n.attrs,text:n.childNodes?.map(c=>c.value||'').join('')}));
  n.childNodes?.forEach(visit);
 }visit(parse(html));return result.join('\n');
}
// Validate the whole batch before changing any public route.
for(const [file,m]of Object.entries(manifest)){
 const bytes=fs.readFileSync(resolve(m.staged)),hash=createHash('sha256').update(bytes).digest('hex');
 const checks=report.filter(r=>r.file===file);
 if(![320,390,1440].every(width=>checks.some(r=>r.width===width))||checks.some(r=>r.hash!==hash||r.overflow>1||r.bad.length||r.errors.length||r.broken.length||r.formMismatch||r.h1!==1))throw new Error('Verification incomplete: '+file);
 if(metadata(fs.readFileSync(resolve(file),'utf8'))!==metadata(bytes.toString()))throw new Error('SEO metadata changed: '+file);
}
const backup=resolve('.scratch/pre-editorial');fs.mkdirSync(backup,{recursive:true});
for(const file of Object.keys(manifest))fs.copyFileSync(resolve(file),path.join(backup,file),fs.constants.COPYFILE_EXCL);
for(const [file,m]of Object.entries(manifest))fs.renameSync(resolve(m.staged),resolve(file));
console.log(`Activated ${Object.keys(manifest).length} public routes. Original HTML retained in .scratch/pre-editorial. SEO and form contracts preserved.`);
