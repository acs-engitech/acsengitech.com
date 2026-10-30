feature - applying these 3 main changes:
1) new role base admin panel,
2) and to end acs product purchasing, trading & sales system
3) overall Kanban/visual analytics/graphical analytical/dashboard/overview (and other visual style modern professional monitoring system if required) monitoring system across the model above which includes all required graphical interface to understand exact status and overview over any system we built above.

depth -
---
(changes in) existing: (/admin) 
1) admin -  superadmin, hr (managing positions, applications, Enquiries), john doe (not confirmed(will be renamed in future) - for handling page SEO and blog posting), 

new:
1) /dispatch, /purchase, /trading, /sales - these will have every respective details to their domain .. coz these are separate systems/modules themselves.
2) enquirer (user)...  /<username>
---

/trading - this is where the actual enquiries from the products like simens etc we'll collect, build and send quotations accordingly, get approval/rejections, send new ones (in short manage them), monitor enquiries and send finalized enquiries and quotes to /purchase so.. purchasing team can ask for these products to providers.

/purchase - this would include all product providers details including the quotations being provided by enquiries (which is there in admin rn but that is part of /trading), providers this will include all purchase related briefs,negotiations, finalized )purchase amount... this amount will be se discussed between acs and then sell to the enquirer, send the finalized proposal to enquirer. (this journey travel from through /purchase->/trading->/user)

/sales - let it be untouched for a while. (coz I don't here what to do (you can suggest it if u get it))

/dispatch- when proposal is accepted and /purchase approves the purchased. this module handles all the details about dispatch related information along with getting details from /purchase (who's provider, who purchased) etc.

(each {/module} above itself is a system, so it should itself have proper tables, auth, analytics, visualizations and all.)
---

now, main monitoring system. (/admin - handled by directors)
which have all the access of above module existed. 

this include having access of all modules, all data go through, all transitions and all. 
but main point here is to visualize here more rather than just having access of all modules. we should have like overview kind of thing in which my initial internal visualization is to have Kanban kind of system where in a single window, we have each tab as each module showing real time process, analytics side by side (graph, plots, each dashboard metric which is showing realtime graphical interface)

focus
---
for more clarity, look at this attached screenshot:
simple - narration. 

ACS builds SCADA/PLC kind of panels and manufactures entire systems around it. 
but, enquiries often arrive for the individual components or parts too like logo, simens etc.
ACS reserves its stocks for their production and for trading purpose. 

for example ACS requires 15 units of simens for their production. and someone enquires 5 units. ACS reduces sells those 5 simens to the buyer and look for one of their providers/suppliers to provide their rest of the 5, whoever provides them at the best rate. they purchase it

--
thigs I wrote above were contextual purpose.
now come to the executional part. Dont't use your platforms context window. point to my local obsidian vault (all guidelines are there in vault),

before even going to execution, I want you have strategized so good that, you execute with 100% accuracy and efficiency, don't burn tokens, time and efforts. use internal harness and orchestrations.
use whatever skills u require like laya, LLM-COUNCIL, agent-reach, compound-engineering, etc. you're open for efficiency and accuracy. 

and good point is not to build entire UI from scratch : I've brought u some resources which will help you a lot. 
ERP-next (by frappe): https://github.com/frappe/erpnext.git (for new system)
frappe-ui (for extra component or ui ref): https://github.com/frappe/frappe-ui.git (for existing tailadmin swap to frappe UI)
you are allowed to use most smoothest, aesthetic, visually premium libraries to use if they are opensource. 

Main thing is our representation: What, Why and How.
This must never adapt sloppy AI-Vibe coded touch at all, make sure that