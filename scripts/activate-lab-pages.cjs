const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'.scratch/lab-build-manifest.json')));
const results=JSON.parse(fs.readFileSync(path.join(root,'.scratch/lab-verification.json')));
const files=Object.entries(manifest);
for(const [file,{staged}]of files){
  if(path.dirname(path.resolve(root,file))!==root||path.dirname(path.resolve(root,staged))!==root)throw new Error('Path outside project');
  const hash=createHash('sha256').update(fs.readFileSync(path.join(root,staged))).digest('hex');
  for(const width of [390,1440,1920]){
    const result=results.find(r=>r.file===file&&r.width===width);
    if(!result||result.hash!==hash||result.missing.length||result.broken.length||result.errors.length||result.overflow.length||result.overflowPixels>1||result.headers!==1||result.footers!==1)throw new Error(`Verification not clean/current: ${file} at ${width}`);
  }
}
const backup=path.join(root,'.scratch','pre-lab-html');fs.mkdirSync(backup,{recursive:true});
// Verify every file first, then retain originals before atomic replacement of each page.
for(const [file]of files)fs.copyFileSync(path.join(root,file),path.join(backup,file),fs.constants.COPYFILE_EXCL);
for(const [file,{staged}]of files)fs.renameSync(path.join(root,staged),path.join(root,file));
console.log(`Activated ${files.length} verified pages. Originals retained in .scratch/pre-lab-html.`);
