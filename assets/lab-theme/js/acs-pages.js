(() => {
  const contact=document.getElementById('acs-contact-form');
  contact?.addEventListener('submit',async event=>{
    event.preventDefault();
    const button=contact.querySelector('[type=submit]'),status=document.getElementById('acs-contact-status');
    if(button.disabled||!contact.reportValidity())return;
    button.disabled=true;status.textContent='Sending...';
    try{
      const response=await fetch('/api/contact',{method:'POST',body:new FormData(contact),signal:AbortSignal.timeout(25000)});
      const result=await response.json();
      if(!response.ok||!result.ok)throw new Error(result.error||'Your message could not be sent. Please try again.');
      status.textContent=result.message;contact.reset();
    }catch(error){status.textContent=error.name==='TimeoutError'?'Delivery could not be confirmed. Please contact sales@acsengitech.com before retrying.':error.message;}
    finally{button.disabled=false;}
  });
  const reduced=matchMedia('(prefers-reduced-motion:reduce)').matches;
  document.querySelectorAll('[data-product-filter]').forEach(button=>button.addEventListener('click',()=>{
    const scope=button.closest('.acs-content-group')||document;
    scope.querySelectorAll('[data-product-filter]').forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    scope.querySelectorAll('[data-product-category]').forEach(card=>{card.hidden=button.dataset.productFilter!=='all'&&card.dataset.productCategory!==button.dataset.productFilter;});
  }));
  const dialog=document.getElementById('acs-image-dialog');
  if(dialog){
    document.querySelectorAll('.acs-product-card img').forEach(img=>{
      img.tabIndex=0;img.setAttribute('role','button');img.setAttribute('aria-label',`View ${img.alt||'product image'}`);
      const open=()=>{dialog.querySelector('img').src=img.src;dialog.querySelector('img').alt=img.alt;dialog.showModal();};
      img.addEventListener('click',open);
      img.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open();}});
    });
    dialog.querySelector('button').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  }
  if(!reduced&&window.Odometer&&'IntersectionObserver' in window){
    const io=new IntersectionObserver(entries=>entries.forEach(({target,isIntersecting})=>{
      if(!isIntersecting)return;io.unobserve(target);
      new Odometer({el:target,value:0,format:'d',duration:900}).update(Number(target.dataset.countTo));
    }),{threshold:.5});
    document.querySelectorAll('[data-count-to]').forEach(node=>io.observe(node));
  }
})();
