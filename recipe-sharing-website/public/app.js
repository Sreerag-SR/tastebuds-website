const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const state = { user: null, token: localStorage.getItem("tastebuds_token"), category: "", query: "", difficulty: "", sort: "newest", favoritesOnly: false, recipes: [], modalRecipe: null };
const fallbackImages = {
  Breakfast:"https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80",
  Lunch:"https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
  Dinner:"https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=900&q=80",
  Healthy:"https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
  Dessert:"https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=80"
};
let toastTimer;
function esc(s=""){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function authHeaders(){return state.token?{"Authorization":`Bearer ${state.token}`}:{ };}
async function api(url, options={}) {
  const headers = {...authHeaders(), ...(options.body ? {"Content-Type":"application/json"}:{}), ...(options.headers||{})};
  const response = await fetch(url,{...options,headers});
  const data = await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function imageFor(r){return r.image_url || fallbackImages[r.category] || fallbackImages.Dinner;}
function openModal(content, wide=false){$("#modalRoot").innerHTML=`<div class="modal-backdrop" id="modalBackdrop"><section class="modal ${wide?"wide":""}" role="dialog" aria-modal="true">${content}</section></div>`;$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});document.addEventListener("keydown",escModal,{once:true});}
function escModal(e){if(e.key==="Escape")closeModal();}
function closeModal(){$("#modalRoot").innerHTML="";}
function modalHead(kicker,title){return `<div class="modal-head"><div><div class="eyebrow">${kicker}</div><h2>${title}</h2></div><button class="modal-close" type="button" aria-label="Close" onclick="closeModal()">×</button></div>`;}
async function loadMe(){if(!state.token)return;try{const d=await api("/api/auth/me");state.user=d.user;}catch{state.token=null;state.user=null;localStorage.removeItem("tastebuds_token");}}
function renderAccountButton(){$("#accountNav").textContent=state.user?state.user.name.trim().charAt(0).toUpperCase():"👤";$("#accountNav").title=state.user?`${state.user.name} · account`:"Sign in";}
async function loadRecipes(){
  $("#recipeGrid").innerHTML='<div class="loading">Gathering something delicious…</div>';
  const params=new URLSearchParams({q:state.query,category:state.category,difficulty:state.difficulty,sort:state.sort});
  if(state.favoritesOnly){if(!state.user){$("#recipeGrid").innerHTML="";$("#emptyState").classList.remove("hidden");$("#recipeTitle").innerHTML='Your <em>saved recipes.</em>';return;}params.set("favorite","true");params.set("viewerId",state.user.id);}
  else if(state.user)params.set("viewerId",state.user.id);
  try{state.recipes=await api(`/api/recipes?${params}`);renderRecipes();}
  catch(e){$("#recipeGrid").innerHTML=`<p>${esc(e.message)}. Is the server running?</p>`;}
}
function renderRecipes(){
  const grid=$("#recipeGrid");grid.innerHTML="";
  $("#recipeTitle").innerHTML=state.favoritesOnly?'Your <em>saved recipes.</em>':state.category?`${esc(state.category)} <em>favorites.</em>`:'Today’s <em>inspiration.</em>';
  $("#recipeEyebrow").textContent=state.favoritesOnly?"YOUR PERSONAL COLLECTION":state.query?`RESULTS FOR “${state.query.toUpperCase()}”`:"FRESH FROM THE COMMUNITY";
  $("#emptyState").classList.toggle("hidden",state.recipes.length>0);
  if(!state.recipes.length)return;
  for(const r of state.recipes){
    const card=document.createElement("article");card.className="recipe-card";
    card.innerHTML=`<div class="recipe-image-wrap" data-open="${r.id}"><img class="recipe-image" src="${esc(imageFor(r))}" alt="${esc(r.title)}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80'"><span class="recipe-category">${esc(r.category)}</span><button class="save-button ${r.favorite?"saved":""}" data-favorite="${r.id}" aria-label="Save recipe">${r.favorite?"♥":"♡"}</button></div><div class="recipe-info" data-open="${r.id}"><div class="recipe-meta"><span>✦ ${esc(r.difficulty)}</span><span>◷ ${Number(r.cooking_time)} min</span></div><h3>${esc(r.title)}</h3><p>${esc(r.description)}</p><div class="card-bottom"><span class="author"><span class="author-dot">✿</span>${esc(r.author||"Home cook")}</span><span class="like-count">♡ ${r.likes||0} likes</span></div></div>`;
    grid.appendChild(card);
  }
  $$("[data-open]",grid).forEach(el=>el.addEventListener("click",()=>openRecipe(Number(el.dataset.open))));
  $$("[data-favorite]",grid).forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();toggleFavorite(Number(el.dataset.favorite));}));
}
async function toggleFavorite(id){if(!state.user)return showAuth("login");try{await api(`/api/recipes/${id}/favorite`,{method:"POST"});toast("Your recipe collection has been updated.");await loadRecipes();}catch(e){toast(e.message);}}
async function openRecipe(id){
  try{const r=await api(`/api/recipes/${id}${state.user?`?viewerId=${state.user.id}`:""}`);state.modalRecipe=r;
    const canEdit=state.user&&(state.user.id===r.user_id||state.user.role==="admin");
    openModal(`${modalHead(r.category.toUpperCase(),esc(r.title))}<div class="recipe-detail"><div><img class="detail-image" src="${esc(imageFor(r))}" alt="${esc(r.title)}"><p class="detail-description">${esc(r.description)}</p><div class="recipe-meta"><span>✦ ${esc(r.difficulty)}</span><span>◷ ${r.cooking_time} min</span><span>♡ ${r.likes} likes</span></div><div class="detail-actions"><button class="button button-dark" id="detailFavorite">${r.favorite?"♥ Saved":"♡ Save recipe"}</button><button class="button-outline" id="detailLike">${r.liked?"♥ Liked":"♡ Like"}</button>${canEdit?'<button class="button-outline" id="editRecipe">Edit</button><button class="danger" id="deleteRecipe">Delete</button>':""}</div><div class="detail-block"><h3>Ingredients</h3><ul>${r.ingredients.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div></div><div><div class="detail-block"><h3>Let’s get cooking</h3><ol>${r.steps.map(x=>`<li>${esc(x)}</li>`).join("")}</ol></div><div class="comments"><h3 class="detail-block">Kitchen talk (${r.comments.length})</h3><div id="commentList">${r.comments.map(c=>`<div class="comment"><strong>${esc(c.author)}</strong><p>${esc(c.body)}</p><small>${esc(c.created_at||"")}</small></div>`).join("")||'<p class="form-hint">Be the first to leave a kind note.</p>'}</div>${state.user?'<form class="comment-form" id="commentForm"><input name="body" maxlength="500" placeholder="Leave a comment…" required><button class="button button-dark">Post</button></form>':'<p class="form-hint">Sign in to join the conversation.</p>'}</div></div></div>`,true);
    $("#detailFavorite").onclick=()=>toggleFromDetail(id,"favorite");$("#detailLike").onclick=()=>toggleFromDetail(id,"like");
    if($("#editRecipe"))$("#editRecipe").onclick=()=>showRecipeForm(r);
    if($("#deleteRecipe"))$("#deleteRecipe").onclick=()=>deleteRecipe(id);
    if($("#commentForm"))$("#commentForm").onsubmit=submitComment;
  }catch(e){toast(e.message);}
}
async function toggleFromDetail(id,action){if(!state.user)return showAuth("login");try{await api(`/api/recipes/${id}/${action}`,{method:"POST"});await openRecipe(id);await loadRecipes();}catch(e){toast(e.message);}}
async function submitComment(e){e.preventDefault();const body=new FormData(e.target).get("body");try{await api(`/api/recipes/${state.modalRecipe.id}/comments`,{method:"POST",body:JSON.stringify({body})});toast("Comment posted!");await openRecipe(state.modalRecipe.id);}catch(err){toast(err.message);}}
async function deleteRecipe(id){if(!confirm("Delete this recipe? This cannot be undone."))return;try{await api(`/api/recipes/${id}`,{method:"DELETE"});closeModal();toast("Recipe deleted.");await loadRecipes();}catch(e){toast(e.message);}}
function showAuth(tab="login"){
  const login=tab==="login";
  openModal(`${modalHead("WELCOME TO TASTEBUDS",login?"Good to have you back.":"Let’s get cooking.")}<div class="auth-tabs"><button class="${login?"active":""}" id="loginTab">Sign in</button><button class="${!login?"active":""}" id="registerTab">Create account</button></div><form id="authForm">${login?"":'<div class="field"><label>Your name</label><input name="name" autocomplete="name" required></div>'}<div class="field"><label>Email address</label><input name="email" type="email" autocomplete="email" required></div><div class="field"><label>Password</label><input name="password" type="password" minlength="8" autocomplete="${login?"current-password":"new-password"}" required></div><div id="authError" class="form-error"></div><button class="button button-dark" style="width:100%">${login?"Sign in":"Create my account"}</button></form><p class="form-hint" style="margin-top:14px">Your account lets you share recipes, save favorites, like dishes, and comment.</p>`);
  $("#loginTab").onclick=()=>showAuth("login");$("#registerTab").onclick=()=>showAuth("register");
  $("#authForm").onsubmit=async e=>{e.preventDefault();const body=Object.fromEntries(new FormData(e.target));try{const d=await api(`/api/auth/${login?"login":"register"}`,{method:"POST",body:JSON.stringify(body)});state.token=d.token;state.user=d.user;localStorage.setItem("tastebuds_token",d.token);closeModal();renderAccountButton();toast(`Welcome${state.user.name?`, ${state.user.name.split(" ")[0]}`:""}!`);await loadRecipes();}catch(err){$("#authError").textContent=err.message;}};
}
function showRecipeForm(recipe=null){
  if(!state.user)return showAuth("login");
  const r=recipe||{};
  openModal(`${modalHead("FROM YOUR KITCHEN",r.id?"Edit your recipe":"Share something delicious")}<form id="recipeForm"><div class="form-grid"><div class="field full"><label>Recipe title *</label><input name="title" maxlength="100" value="${esc(r.title||"")}" placeholder="Grandma’s Sunday pasta" required></div><div class="field full"><label>A little introduction *</label><textarea name="description" maxlength="400" placeholder="What makes this dish special?" required>${esc(r.description||"")}</textarea></div><div class="field"><label>Category *</label><select name="category" required>${["Breakfast","Lunch","Dinner","Healthy","Dessert","Snack","Drinks"].map(c=>`<option ${r.category===c?"selected":""}>${c}</option>`).join("")}</select></div><div class="field"><label>Difficulty</label><select name="difficulty">${["Easy","Medium","Hard"].map(c=>`<option ${r.difficulty===c?"selected":""}>${c}</option>`).join("")}</select></div><div class="field"><label>Cooking time (minutes)</label><input type="number" name="cooking_time" min="1" max="1440" value="${Number(r.cooking_time)||30}" required></div><div class="field"><label>Photo URL (optional)</label><input type="url" name="image_url" value="${esc(r.image_url||"")}" placeholder="https://…"></div><div class="field full"><label>Ingredients * (one per line)</label><textarea name="ingredients" placeholder="2 cups flour&#10;1 tbsp olive oil" required>${esc(Array.isArray(r.ingredients)?r.ingredients.join("\n"):r.ingredients||"")}</textarea></div><div class="field full"><label>Steps * (one per line, in order)</label><textarea name="steps" placeholder="Preheat the oven…&#10;Mix the ingredients…" required>${esc(Array.isArray(r.steps)?r.steps.join("\n"):r.steps||"")}</textarea></div></div><div id="recipeError" class="form-error"></div><button class="button button-dark" style="width:100%">${r.id?"Save changes":"Publish recipe"} ↗</button></form><p class="form-hint" style="margin-top:12px">Tip: use one line per ingredient and one line per cooking step.</p>`,true);
  $("#recipeForm").onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(e.target));try{await api(r.id?`/api/recipes/${r.id}`:"/api/recipes",{method:r.id?"PUT":"POST",body:JSON.stringify(b)});closeModal();toast(r.id?"Recipe updated!":"Your recipe is live!");state.favoritesOnly=false;await loadRecipes();}catch(err){$("#recipeError").textContent=err.message;}};
}
async function showAdmin(){
  if(!state.user||state.user.role!=="admin")return;
  try{const s=await api("/api/admin/stats");openModal(`${modalHead("CONTROL ROOM","Community dashboard")}<div class="stats-grid"><div class="stat"><strong>${s.users}</strong><span>Members</span></div><div class="stat"><strong>${s.recipes}</strong><span>Recipes</span></div><div class="stat"><strong>${s.comments}</strong><span>Comments</span></div></div><div class="detail-block"><h3>Recent members</h3>${s.recentUsers.map(u=>`<div class="admin-user"><div><strong>${esc(u.name)}</strong><small>${esc(u.email)} · ${esc(u.role)}</small></div>${u.id!==state.user.id?`<button class="danger" data-remove-user="${u.id}">Remove</button>`:""}</div>`).join("")}</div><div class="detail-actions"><button class="button-outline" id="adminRecipes">Manage recipes</button></div>`,true);
    $$("[data-remove-user]").forEach(b=>b.onclick=async()=>{if(!confirm("Remove this member and their content?"))return;try{await api(`/api/admin/users/${b.dataset.removeUser}`,{method:"DELETE"});toast("Member removed.");showAdmin();}catch(e){toast(e.message);}});
    $("#adminRecipes").onclick=async()=>{const rs=await api("/api/admin/recipes");openModal(`${modalHead("MODERATION","Manage recipes")}<div>${rs.map(r=>`<div class="admin-user"><div><strong>${esc(r.title)}</strong><small>by ${esc(r.author)} · ${esc(r.category)}</small></div><button class="danger" data-admin-delete="${r.id}">Delete</button></div>`).join("")||"No recipes yet."}</div>`,true);$$("[data-admin-delete]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this recipe?"))return;try{await api(`/api/recipes/${b.dataset.adminDelete}`,{method:"DELETE"});toast("Recipe deleted.");showAdmin();await loadRecipes();}catch(e){toast(e.message);}});};
  }catch(e){toast(e.message);}
}
function setCategory(category){state.category=category;state.favoritesOnly=false;$$(".category-chip").forEach(b=>b.classList.toggle("selected",b.dataset.category===category));loadRecipes();}
$("#searchBtn").onclick=()=>{state.query=$("#searchInput").value.trim();state.favoritesOnly=false;loadRecipes();};
$("#searchInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("#searchBtn").click();});
$$(".category-chip").forEach(b=>b.onclick=()=>setCategory(b.dataset.category));
$("#clearCategory").onclick=()=>{state.query="";$("#searchInput").value="";state.difficulty="";$("#difficultyFilter").value="";setCategory("");};
$("#difficultyFilter").onchange=e=>{state.difficulty=e.target.value;loadRecipes();};
$("#sortFilter").onchange=e=>{state.sort=e.target.value;loadRecipes();};
$("#addNav").onclick=$("#bannerAdd").onclick=$("#emptyAdd").onclick=()=>showRecipeForm();
$("#favoritesNav").onclick=()=>{state.favoritesOnly=!state.favoritesOnly;state.category="";$$(".category-chip").forEach(b=>b.classList.toggle("selected",b.dataset.category===""));loadRecipes();};
$("#accountNav").onclick=()=>{if(!state.user)return showAuth("login");openModal(`${modalHead("YOUR TASTEBUDS ACCOUNT",`Hello, ${esc(state.user.name.split(" ")[0])}!`)}<p class="detail-description">${esc(state.user.email)}</p><div class="detail-actions"><button class="button button-dark" id="myRecipes">Browse my saved recipes</button>${state.user.role==="admin"?'<button class="button-outline" id="adminPanel">Admin dashboard</button>':""}<button class="button-outline" id="logout">Sign out</button></div><p class="form-hint">Recipes you create are attached to your account. You can edit or delete your own recipes from their recipe page.</p>`);$("#myRecipes").onclick=()=>{$("#favoritesNav").click();closeModal();};if($("#adminPanel"))$("#adminPanel").onclick=showAdmin;$("#logout").onclick=()=>{state.user=null;state.token=null;localStorage.removeItem("tastebuds_token");renderAccountButton();closeModal();toast("You have signed out.");loadRecipes();};};
(async()=>{await loadMe();renderAccountButton();await loadRecipes();})();
