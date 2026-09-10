const test=require('node:test');
const assert=require('node:assert/strict');
const {submitContact}=require('../lib/contact');
const fields={'mf-first-name':'Test','mf-last-name':'Visitor','mf-email':'test@example.test','mf-subject':'Test request','mf-comment':'Test message'};
const config='<div class="mf-form-wrapper" data-form-id="1481" data-wp-nonce="fresh-wp" data-form-nonce="fresh-form"></div>';
test('contact validates fields before contacting WordPress',async()=>{
  await assert.rejects(()=>submitContact({...fields,'mf-email':'bad'},()=>{throw new Error('should not fetch');}),/valid email/);
});
test('contact uses fresh nonces and forwards only the expected fields',async()=>{
  let calls=0;
  const result=await submitContact({...fields,unexpected:'ignored'},async(url,options)=>{
    calls++;
    if(calls===1)return new Response(config);
    assert.equal(url,'https://acsengitech.com/wp-json/metform/v1/entries/insert/1481');
    assert.equal(options.headers['X-WP-Nonce'],'fresh-wp');
    assert.equal(options.body.get('form_nonce'),'fresh-form');
    assert.equal(options.body.get('mf-email'),fields['mf-email']);
    assert.equal(options.body.has('unexpected'),false);
    return Response.json({status:true,data:{message:'Message received.'}});
  });
  assert.equal(result.message,'Message received.');assert.equal(calls,2);
});
test('contact never reports success for a refused or unavailable upstream',async()=>{
  await assert.rejects(()=>submitContact(fields,async()=>new Response('',{status:503})),/unavailable/);
  let calls=0;
  await assert.rejects(()=>submitContact(fields,async()=>++calls===1?new Response(config):Response.json({status:false,error:['Invalid nonce']})),/not accepted/);
});
