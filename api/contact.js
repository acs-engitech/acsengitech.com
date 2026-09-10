const {submitContact}=require('../lib/contact');
const {parseMultipart}=require('../lib/uploads');
const {checkRateLimit,clientIp}=require('../lib/rate-limit');

module.exports=async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  const send=(status,payload)=>{res.statusCode=status;res.end(JSON.stringify(payload));};
  if(req.method!=='POST')return send(405,{error:'Method not allowed'});
  if(!checkRateLimit(`contact:${clientIp(req)}`,5,60*60*1000))return send(429,{error:'Too many messages. Please try again later.'});
  try{
    const {fields}=await parseMultipart(req,{fileFields:[],maxFileSize:0});
    return send(200,await submitContact(fields));
  }catch(error){
    return send(error.statusCode||502,{error:error.statusCode===400?error.message:'Your message could not be sent. Please try again or email sales@acsengitech.com.'});
  }
};
