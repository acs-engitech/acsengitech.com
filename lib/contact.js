const {parse}=require('parse5');
const FIELDS=['mf-first-name','mf-last-name','mf-email','mf-subject','mf-comment'];

async function submitContact(fields,request=fetch) {
  const values={};
  for(const name of FIELDS){
    if(typeof fields[name]!=='string'||!fields[name].trim()||fields[name].length>(name==='mf-comment'?10000:320)){
      const error=new Error('Complete all required fields within the allowed length.');error.statusCode=400;throw error;
    }
    values[name]=fields[name].trim();
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values['mf-email'])){
    const error=new Error('Enter a valid email address.');error.statusCode=400;throw error;
  }
  // The WordPress form tokens expire. Read the current public form before submitting.
  const page=await request('https://acsengitech.com/contact/',{signal:AbortSignal.timeout(10000)});
  if(!page.ok)throw new Error('The contact service is temporarily unavailable.');
  const document=parse(await page.text());
  let tokens;
  function visit(node){
    const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
    if(attrs['data-form-id']==='1481'&&attrs['data-wp-nonce']&&attrs['data-form-nonce'])tokens=attrs;
    for(const child of node.childNodes||[])visit(child);
  }
  visit(document);
  if(!tokens)throw new Error('The contact service is temporarily unavailable.');
  const body=new FormData();
  for(const [name,value] of Object.entries(values))body.append(name,value);
  body.append('form_nonce',tokens['data-form-nonce']);
  const response=await request('https://acsengitech.com/wp-json/metform/v1/entries/insert/1481',{
    method:'POST',headers:{'X-WP-Nonce':tokens['data-wp-nonce']},body,signal:AbortSignal.timeout(10000),
  });
  if(!response.ok)throw new Error('Your message was not accepted. Please try again or email sales@acsengitech.com.');
  const result=await response.json();
  if(result.status!==true)throw new Error('Your message was not accepted. Please try again or email sales@acsengitech.com.');
  return {ok:true,message:typeof result.data?.message==='string'?result.data.message:'Your message has been sent.'};
}

module.exports={submitContact};
