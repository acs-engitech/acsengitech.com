const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {Readable}=require('node:stream');
const {submitContact}=require('../lib/contact');
const store=require('../lib/store');
const handler=require('../api/contact');
const fields={'mf-first-name':'Test','mf-last-name':'Visitor','mf-email':'test@example.test','mf-subject':'Test request','mf-comment':'Test message'};

test('contact validates fields before storing anything',async()=>{
  const save=()=>{throw new Error('should not save');};
  await assert.rejects(()=>submitContact({...fields,'mf-email':'bad'},save),/valid email/);
  await assert.rejects(()=>submitContact({...fields,'mf-subject':'  '},save),/required fields/);
  await assert.rejects(()=>submitContact({...fields,'mf-comment':'x'.repeat(10001)},save),/allowed length/);
  await assert.rejects(()=>submitContact({...fields,'mf-first-name':['a','b']},save),/required fields/);
});

test('contact stores only the expected fields, trimmed',async()=>{
  let saved;
  const result=await submitContact({...fields,'mf-first-name':'  Test ',unexpected:'ignored'},async row=>{saved=row;return {id:'7'};});
  assert.deepEqual(saved,{firstName:'Test',lastName:'Visitor',email:'test@example.test',subject:'Test request',message:'Test message'});
  assert.equal(result.ok,true);assert.equal(result.id,'7');assert.match(result.message,/sent/);
});

test('contact never reports success when storage fails',async()=>{
  await assert.rejects(()=>submitContact(fields,async()=>{throw new Error('connection refused');}),/connection refused/);
});

function isolatedStore(query){
  const context={
    module:{exports:{}},process:{env:{NEON_DATABASE_URL:'test'}},
    require:name=>name==='@neondatabase/serverless'?{neon:()=>query}:require('../lib/acs-defaults'),
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../lib/store'),'utf8'),context);
  return context.module.exports;
}

test('insertEnquiry creates the enquiries table and inserts the submission',async()=>{
  const queries=[];
  const store=isolatedStore(async(strings,...values)=>{
    const text=strings.join('?');queries.push({text,values});
    if(/INSERT INTO acs_enquiries/.test(text))return [{id:1,first_name:values[0],last_name:values[1],email:values[2],subject:values[3],message:values[4],status:'new',admin_notes:null,created_at:'2026-10-22T00:00:00Z',updated_at:'2026-10-22T00:00:00Z'}];
    return [];
  });
  const enquiry=await store.insertEnquiry({firstName:'Test',lastName:'Visitor',email:'test@example.test',subject:'Test request',message:'Test message'});
  assert.ok(queries.some(q=>/CREATE TABLE IF NOT EXISTS acs_enquiries/.test(q.text)));
  const insert=queries.find(q=>/INSERT INTO acs_enquiries/.test(q.text));
  assert.deepEqual(insert.values,['Test','Visitor','test@example.test','Test request','Test message']);
  assert.deepEqual({...enquiry},{id:'1',firstName:'Test',lastName:'Visitor',name:'Test Visitor',email:'test@example.test',subject:'Test request',message:'Test message',status:'new',adminNotes:null,createdAt:'2026-10-22T00:00:00Z',updatedAt:'2026-10-22T00:00:00Z'});
});

async function callContact(form,ip){
  const request=new Request('http://localhost/api/contact',{method:'POST',body:form});
  const req=Readable.from(Buffer.from(await request.arrayBuffer()));
  req.method='POST';req.headers={'content-type':request.headers.get('content-type'),'x-forwarded-for':ip};
  const res={headers:{},statusCode:200,setHeader(name,value){this.headers[name]=value;},end(body){this.body=JSON.parse(body);}};
  await handler(req,res);
  return res;
}

function contactForm(values=fields){
  const form=new FormData();
  for(const [name,value] of Object.entries(values))form.append(name,value);
  return form;
}

test('POST /api/contact saves the enquiry and returns success',async()=>{
  const rows=[];
  store.insertEnquiry=async row=>{rows.push(row);return {id:'42'};};
  const res=await callContact(contactForm(),'203.0.113.10');
  assert.equal(res.statusCode,200);assert.equal(res.body.ok,true);assert.equal(res.body.id,'42');
  assert.equal(rows.length,1);assert.equal(rows[0].email,'test@example.test');
});

test('POST /api/contact rejects invalid input and storage failures without claiming success',async()=>{
  store.insertEnquiry=async()=>{throw new Error('Database is not configured');};
  const invalid=await callContact(contactForm({...fields,'mf-email':'bad'}),'203.0.113.11');
  assert.equal(invalid.statusCode,400);assert.match(invalid.body.error,/valid email/);
  const failed=await callContact(contactForm(),'203.0.113.11');
  assert.equal(failed.statusCode,502);assert.match(failed.body.error,/sales@acsengitech\.com/);
  assert.doesNotMatch(failed.body.error,/Database/);
});

test('POST /api/contact rate limits repeated submissions from one address',async()=>{
  store.insertEnquiry=async()=>({id:'1'});
  const statuses=[];
  for(let i=0;i<6;i++)statuses.push((await callContact(contactForm(),'203.0.113.12')).statusCode);
  assert.deepEqual(statuses,[200,200,200,200,200,429]);
});
