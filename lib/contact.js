const FIELDS=['mf-first-name','mf-last-name','mf-email','mf-subject','mf-comment'];

// Validates the public contact form and stores the enquiry through `save` (store.insertEnquiry in production).
async function submitContact(fields,save) {
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
  const enquiry=await save({
    firstName:values['mf-first-name'],lastName:values['mf-last-name'],email:values['mf-email'],
    subject:values['mf-subject'],message:values['mf-comment'],
  });
  return {ok:true,id:enquiry?.id,message:'Thank you. Your message has been sent and our team will get back to you shortly.'};
}

module.exports={submitContact};
