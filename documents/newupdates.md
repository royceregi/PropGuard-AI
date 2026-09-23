read this, this is my property database in postgressql and i want you to understand current table and column formate and then in my project which is block chain based property transaction verification system with agentic ai , here the property owners are the basic users and other than that the super admin, the land registry and the real estate agency are there the super admin is the main controller for the complete system as the developer and accoding to the system the 3 role is register(form the land registry), agent, (from the realestate) and the user (property owners) auth use as eigher register or the agent add the normal user to the system for user need and (agent and register is added by super admin

if  a user want to make a transaction with a party, the seller can send the property details to the buyer and the buyer can verify the property details, ownership history, and any encumbrances before proceeding with the transaction. The buyer can also submit the transaction for analysis to receive a risk assessment and evidence report.

the buyer can only check the shared details not alter the official property history and the other poprety details

for the public user to login he is added to system by a land_registry or the realestate authority. The public user can access the property details, ownership history, and any encumbrances related to the property they are interested in. They can also submit a request for a risk assessment and evidence report for the property. However, they cannot make any changes to the official property records or details.

for public agent to login not only he is added to system by one of the athorities but also he is approved by the super admin as per the commercialization like the payment for view the details

Part 1
2 interacting intelligence 
Using more llms
Using nlp techniques 
An information retrieval module
Security feature / input sanitation 
Define communication protection

-----
the verify block chain page is for compare the stored with the user entering details and the user inserting details is not auto fill, user enter the details like

auth system
- End users exist in the DB as STANDARD by default and have no system access (even if is_active).
- Registry / Company: Active toggle ON submits STANDARD → ELEVATED (Pending) for Super Admin review. Toggle OFF withdraws to STANDARD.
- Super Admin: promotes Pending (ELEVATED) → PUBLIC to grant system access. is_active alone does not grant login.
- Login requires operational access_level (SYSTEM / REGISTRY / COMPANY / PUBLIC) and is_active.


