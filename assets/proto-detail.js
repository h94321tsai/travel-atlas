(() => {
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const url=x=>{const v=String(x||'');return /^(https?:\/\/|assets\/)/.test(v)?esc(encodeURI(v)):'';};
  const home=document.querySelector('.wrap');
  function buildDetail(source){
  const trip={...source,shopping:(source.shopping||[]).map((g,gi)=>({...g,items:(g.items||[]).map((item,ii)=>{
    try{return {...item,...JSON.parse(localStorage.getItem(`atlas:edit:${source.name}:${gi}:${ii}`)||'{}')};}catch{return item;}
  })}))};
  const isHiroshima=/廣島.*倉敷.*高松/.test(trip._title);
  const page=document.createElement('main');page.className='trip-page';page.hidden=true;page.id='trip-detail';
  const meta=trip.tripMeta||{},recap=trip.recap||{};
  const stay=x=>typeof x==='string'?{n:x}:x;
  const photosOf=day=>[...(day.spots||[]).flatMap(s=>(s.photos||[]).map(p=>({...p,spot:s.n}))),...(day.others||[])];
  const photoGroups=(recap.days||[]).map(d=>({title:d.d,date:d.date||'',photos:photosOf(d)}));
  if(recap.unclassified?.length)photoGroups.push({title:'其他片刻',photos:recap.unclassified});
  const count=photoGroups.reduce((n,d)=>n+d.photos.length,0);
  const totalShop=(trip.shopping||[]).reduce((n,g)=>n+(g.items||[]).length,0);
  const empty=text=>`<p class="trip-empty">${esc(text)}</p>`;
  const duration=Number(trip.days)>0?`${Number(trip.days)}天${Math.max(0,Number(trip.days)-1)}夜`:'尚未決定';
  const people=trip.people?`${esc(trip.people)} 人`:'尚未記錄';
  const companions=isHiroshima?'（11大+2小）':(trip.companions||[]).join('、');
  const transport=trip.transport||meta.transport||(isHiroshima?'全程包車':'尚未記錄');
  const cover=isHiroshima?'assets/images/廣島/recap/f_DSC05579.jpg':recap.cover;
  const icon=isHiroshima?'🦪':/濟州|jeju/i.test(trip._title)?'🍊':repObjects(trip)[0]||trip.flag||'📁';
  const stickerAssets={'🦪':'assets/stickers/oyster-puffy-pink-v3.png','🍊':'assets/stickers/jeju-mandarin-orange-v2.png'};
  const visual=cover
    ? `<figure class="trip-cover trip-overview-photo"><img src="${url(cover)}" alt="${esc(trip._title)}旅行照片">${stickerAssets[icon]?`<img class="overview-photo-sticker" src="${url(stickerAssets[icon])}" alt="" aria-hidden="true">`:`<span class="overview-photo-sticker emoji-sticker" aria-hidden="true">${icon}</span>`}</figure>`
    : `<div class="trip-overview-photo overview-illustration" aria-hidden="true">${stickerMarkup(icon)}</div>`;
  const dateLabel=trip.start&&trip.end?`${trip.start} — ${trip.end}`:trip.start||trip.year||'日期未定';
  const status=trip._status||computeStatus(trip);

  function overview(){return `<div class="trip-overview editorial-overview">
    <div class="overview-hero"><div class="overview-intro"><h2 class="overview-eyebrow">OVERVIEW / 旅程總覽</h2><dl class="trip-facts"><div><dt>旅行天數</dt><dd>${duration}</dd></div><div><dt>旅伴</dt><dd>${trip.people?people:esc(companions)||people}${trip.people&&companions?`<span class="trip-fact-detail">${esc(companions)}</span>`:''}</dd></div><div><dt>交通</dt><dd>${esc(transport)}</dd></div></dl><div class="trip-tags" aria-label="旅程標籤">${(trip.tags||[]).map(t=>`<span>${esc(t)}</span>`).join('')}</div></div>${visual}</div>
    <section class="overview-section"><h3>航班</h3>${flightsBlock()}</section>
    <section class="overview-section"><h3>住宿</h3><div class="overview-rows">${(meta.stays||[]).map(stay).map(s=>s.local||s.addr?stayCard(s):`<div class="overview-row"><p class="overview-row-label">${s.url&&url(s.url)?`<a href="${url(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.n)} ↗</a>`:esc(s.n)}</p><p>${esc(s.when||'日期尚未記錄')}</p></div>`).join('')||'<p class="trip-small">尚未記錄</p>'}</div></section>
    ${(meta.restaurants||[]).length?`<section class="overview-section"><h3>收藏餐廳</h3><div class="stay-cards">${meta.restaurants.map(stayCard).join('')}</div></section>`:''}
  </div>`;}
  // 航班:物件 {dir,date,airline,no,from:{code,name,time},to:{…},dur,status};舊字串「去 10/4(日) CI112 桃園T2 07:15 → 廣島 10:35」也轉成卡片
  const planeSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" transform="rotate(90 12 12)"/></svg>';
  function flightOf(f,i){
    if(f&&typeof f==='object')return f;
    const m=String(f).match(/^([去回])\s+(\S+)\s+([A-Z0-9]{2}\d{2,4})\s+(.+?)\s+(\d{1,2}:\d{2})\s*→\s*(.+?)\s+(\d{1,2}:\d{2})$/);
    return m?{dir:m[1]+'程',date:m[2],no:m[3],from:{name:m[4],time:m[5]},to:{name:m[6],time:m[7]}}:null;
  }
  function flightsBlock(){
    const list=meta.flights||[];
    if(!list.length)return '<p class="trip-small">尚未記錄</p>';
    return `<div class="flight-cards">${list.map((f,i)=>{
      const x=flightOf(f,i);
      if(!x)return `<div class="overview-row"><span class="overview-row-label">${i===0?'去程':i===1?'回程':'航班 '+(i+1)}</span><p>${esc(String(f).replace(/^[去回]\s+/,''))}</p></div>`;
      const end=(p,side)=>`<div class="flight-end ${side}"><b class="flight-time">${esc(p.time||'--:--')}</b>${p.code?`<span class="flight-code">${esc(p.code)}</span>`:''}<span class="flight-place">${esc(p.name||'')}</span></div>`;
      return `<article class="flight-card"><div class="flight-head"><span class="flight-dir">${esc(x.dir||(i===0?'去程':'回程'))}<i>|</i>${esc(x.date||'')}</span>${x.status?`<span class="flight-status">${esc(x.status)}</span>`:''}</div>
        <div class="flight-body">${end(x.from||{},'from')}<div class="flight-mid"><span>${esc([x.airline,x.no].filter(Boolean).join(' '))}</span><span class="flight-line">${planeSvg}</span>${x.dur?`<span>${esc(x.dur)}</span>`:''}</div>${end(x.to||{},'to')}</div></article>`;
    }).join('')}${meta.flightNote?`<p class="flight-note">${esc(meta.flightNote)}</p>`:''}</div>`;
  }
  // 住宿/餐廳卡:{n,local,addr,when,note,url,icon}
  function stayCard(s){
    const name=`${s.icon?`<span aria-hidden="true">${esc(s.icon)} </span>`:''}${esc(s.n)}`;
    return `<div class="stay-card"><p class="stay-name">${s.url&&url(s.url)?`<a href="${url(s.url)}" target="_blank" rel="noopener noreferrer">${name} ↗</a>`:name}</p>${s.local?`<p class="stay-local">${esc(s.local)}</p>`:''}${s.addr?`<p class="stay-addr">${esc(s.addr)}</p>`:''}${s.when?`<p class="stay-when">${esc(s.when)}</p>`:''}${s.note?`<p class="stay-when">${esc(s.note)}</p>`:''}</div>`;
  }
  function itinerary(){
    const days=trip.itineraryRich?.length?trip.itineraryRich:(trip.itinerary||[])
      .filter(row=>row.slice(1).some(value=>String(value||'').trim()))
      .map(row=>({d:row[0],date:row[1],title:row[2]||'當日安排',highlight:row[3]?`住宿：${row[3]}`:'',schedule:row.slice(4).filter(Boolean).map(value=>['',value]),spots:[]}));
    if(!days.length)return empty('這趟還沒有每日行程。');
    return `<div class="trip-section-head itinerary-heading"><h2>ITINERARY / 每日行程</h2><span class="trip-small">${days.length} DAYS</span></div>${days.map((d,i)=>`
      <details class="trip-day" ${i===0?'open':''}>
        <summary><b>${esc(d.d)}</b><small>${esc(d.date)}</small><h3>${esc(d.title)}</h3></summary>
        <div class="trip-day-body">
          ${(d.highlight||d.remind||d.photo)?`<div class="trip-day-collage ${d.photo?'':'without-photo'}"><div class="trip-day-memo">${d.highlight?`<p class="day-eyebrow">今日重點</p><p class="day-highlight">${esc(d.highlight)}</p>`:''}${d.remind?`<p class="trip-reminder"><span>提醒</span>${esc(d.remind)}</p>`:''}</div>${d.photo?`<figure class="trip-day-frame"><img class="trip-day-photo" loading="lazy" src="${url(d.photo)}" alt="${esc(d.photoCredit||d.title)}">${d.photoCredit?`<figcaption>${esc(d.photoCredit)}</figcaption>`:''}</figure>`:''}</div>`:''}
          ${(d.schedule||[]).length?`<section class="day-schedule"><h4>時間安排</h4><ol class="trip-timeline">${(d.schedule||[]).map(r=>`<li><time>${esc(r[0])}</time><span>${esc(r[1])}</span></li>`).join('')}</ol></section>`:''}
          ${(d.spots||[]).length?`<section class="day-places"><h4>地點與導航</h4><div class="trip-spots">${d.spots.map(s=>`<a class="trip-spot" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.c||s.n)}" target="_blank" rel="noopener noreferrer">${esc(s.n)} ↗${s.note?`<span>${esc(s.note)}</span>`:''}</a>`).join('')}</div></section>`:''}
        </div>
      </details>`).join('')}${(meta.collections||[]).map(c=>`${c.collapsible?`<details class="itinerary-collection trip-note"><summary><h3>${esc(c.title)}</h3></summary><div class="trip-note-body">`:`<section class="itinerary-collection"><h3>${esc(c.title)}</h3>`}${c.note?`<p class="trip-small">${esc(c.note)}</p>`:''}<ul>${(c.items||[]).map(item=>`<li>${item.url&&url(item.url)?`<a href="${url(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.n)} ↗</a>`:esc(item.n)}</li>`).join('')}</ul>${(c.sections||[]).map(section=>`<div class="transport-note-section"><h4>${esc(section.title)}</h4><dl>${(section.items||[]).map(item=>`<div><dt>${esc(item.label)}</dt><dd>${esc(item.text)}</dd></div>`).join('')}</dl></div>`).join('')}${c.collapsible?'</div></details>':'</section>'}`).join('')}`;
  }
  function shopping(){return `<div class="trip-section-head shopping-heading"><h2>SHOPPING / 購物清單</h2><span class="shop-head-tools"><span id="trip-shop-progress" class="trip-small" aria-live="polite"></span><button type="button" class="shop-hide-toggle" aria-pressed="false">隱藏已買</button></span></div>${(trip.buyTiming||[]).length?`<details class="shop-timing"><summary>採買時間提醒</summary><div>${trip.buyTiming.map(x=>`<p>${esc(x)}</p>`).join('')}</div></details>`:''}${(trip.shopping||[]).map((g,gi)=>`${g.store&&g.store!==trip.shopping[gi-1]?.store?`<h3 class="shop-store">${esc(g.store)}</h3>`:''}<details class="trip-shop-group${g.store?' in-store':''}" open><summary><h3>${esc((g.group||'購物').replace(/^[^\p{L}\p{N}]+/u,''))}</h3><span class="shop-group-count">${(g.items||[]).length} 項</span></summary>${g.note?`<p class="shop-group-note">${esc(g.note)}</p>`:''}<div class="trip-shop-list">${(g.items||[]).map((item,ii)=>`${item.brand&&item.brand!==g.items[ii-1]?.brand?`<p class="shop-brand">${esc(item.brand)}</p>`:''}<div class="shop-swipe-row" tabindex="0" role="group" aria-label="${esc(item.name)}，按向左鍵開啟購買選項"><div class="shop-swipe-actions" hidden><button type="button" data-shop-status="later" aria-pressed="false">下次買</button><button type="button" data-shop-status="skip" aria-pressed="false">不買了</button></div><label class="trip-shop-item"><input type="checkbox" data-shop="${gi}:${ii}" data-name="${esc(item.name)}" aria-label="已購買 ${esc(item.name)}">${item.imgs?.[0]?`<span class="shop-photo-trigger" role="button" tabindex="0" data-shop-photo="${gi}:${ii}" aria-label="放大 ${esc(item.name)}，共 ${item.imgs.length} 張照片"><img loading="lazy" src="${url((trip.imageBase||'')+'/'+item.imgs[0])}" alt="${esc(item.name)}">${item.imgs.length>1?`<span class="shop-photo-count">${item.imgs.length} 張</span>`:''}</span>`:'<span class="shop-no-image" aria-hidden="true"></span>'}<span class="shop-copy"><strong>${esc(item.name)}</strong>${item.desc?`<p>${esc(item.desc)}</p>`:''}${item.price?`<em>${esc(item.price)}</em>`:''}<span class="shop-status" hidden></span></span></label></div>`).join('')}</div></details>`).join('')||empty('這趟還沒有購物清單。')}`;}
  const allPhotos=[];
  function gallery(){return `<div class="trip-section-head gallery-heading"><h2>MEMORIES / 旅程回顧</h2><span class="trip-small">${count} 張照片</span></div>${photoGroups.map(g=>`<section class="trip-photos-day"><div class="gallery-day-heading"><h3>${esc(g.title)}</h3>${g.date?`<span>${esc(g.date)}</span>`:''}<small>${g.photos.length} 張</small></div><div class="trip-photo-grid trip-memory-mosaic">${g.photos.map((p,pi)=>{const i=allPhotos.push(p)-1;const caption=p.caption||p.spot||p.time||'';return `<button class="trip-photo-button ${g.photos.length>2&&pi%10===0?'memory-feature':g.photos.length>5&&pi%10===5?'memory-wide':''}" data-photo="${i}" aria-label="放大 ${esc(p.caption||p.spot||p.src||'旅行照片')}"><img loading="lazy" src="${url(p.thumb||p.full)}" alt="${esc(p.caption||p.spot||p.src||'旅行照片')}">${caption?`<small>${esc(caption)}</small>`:''}</button>`;}).join('')}</div></section>`).join('')||empty('這趟還沒有回顧照片。')}`;}
  const tabs=[['overview','總覽',overview],['itinerary','行程',itinerary],['shopping','購物',shopping],['photos','回顧',gallery],['finance','記帳',()=>'<div id="finRoot"></div>']];
  page.innerHTML=`<div class="trip-topbar"><button class="trip-back" type="button">← Back</button><div class="trip-heading"><h1 tabindex="-1">${esc(trip._title)}</h1><p>${esc(dateLabel)}</p></div><span class="trip-seal"><span class="dot"></span>${esc(status)}</span></div><div class="trip-file"><nav class="trip-tabs" role="tablist" aria-label="旅程內容">${tabs.map(([id,name],i)=>`<button type="button" class="trip-tab" id="trip-tab-${id}" role="tab" aria-controls="trip-panel-${id}" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-tab="${id}"><span class="trip-tab-number">0${i+1}</span><span class="trip-tab-name">${name}</span></button>`).join('')}</nav><div class="trip-sheet"><div class="trip-paper">${tabs.map(([id,,render],i)=>`<section class="trip-panel" id="trip-panel-${id}" role="tabpanel" aria-labelledby="trip-tab-${id}" ${i?'hidden':''}>${render()}</section>`).join('')}</div></div></div>`;
  document.body.append(page);
  const dialog=document.createElement('dialog');dialog.className='trip-lightbox';dialog.setAttribute('aria-label','回顧照片');dialog.innerHTML='<img alt=""><div class="trip-lightbox-bar"><button data-dir="-1" aria-label="上一張">←</button><p></p><button data-dir="1" aria-label="下一張">→</button><button data-close>關閉 ×</button></div>';document.body.append(dialog);
  let photoIndex=0,lightboxPhotos=allPhotos;
  function showPhoto(i,photos){
    if(photos)lightboxPhotos=photos;
    if(!lightboxPhotos.length)return;
    photoIndex=(i+lightboxPhotos.length)%lightboxPhotos.length;
    const p=lightboxPhotos[photoIndex];
    dialog.querySelector('img').src=p.full||p.thumb;
    dialog.querySelector('img').alt=p.caption||p.spot||p.src||'旅行照片';
    dialog.querySelector('p').textContent=`${photoIndex+1} / ${lightboxPhotos.length} · ${p.caption||p.spot||p.src||''}`;
    dialog.querySelectorAll('[data-dir]').forEach(b=>b.hidden=lightboxPhotos.length<2);
    if(!dialog.open)dialog.showModal();
  }
  function showShopPhotos(key){
    const [gi,ii]=key.split(':').map(Number),item=trip.shopping?.[gi]?.items?.[ii];
    if(!item?.imgs?.length)return;
    showPhoto(0,item.imgs.map(name=>({full:(trip.imageBase||'')+'/'+name,caption:item.name})));
  }
  dialog.addEventListener('click',e=>{if(e.target.closest('[data-close]')||e.target===dialog)dialog.close();const b=e.target.closest('[data-dir]');if(b)showPhoto(photoIndex+Number(b.dataset.dir));});
  dialog.addEventListener('keydown',e=>{if(e.key==='ArrowRight')showPhoto(photoIndex+1);if(e.key==='ArrowLeft')showPhoto(photoIndex-1);});
  function selectTab(id,focus=false){if(id==='finance'&&window.renderProtoFinance)window.renderProtoFinance(trip);page.querySelectorAll('[role=tab]').forEach(b=>{const on=b.dataset.tab===id;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus();});page.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!==`trip-panel-${id}`);}
  page.addEventListener('click',e=>{const shopPhoto=e.target.closest('[data-shop-photo]');if(shopPhoto){e.preventDefault();e.stopPropagation();showShopPhotos(shopPhoto.dataset.shopPhoto);return;}const tab=e.target.closest('[data-tab]');if(tab)selectTab(tab.dataset.tab);const photo=e.target.closest('[data-photo]');if(photo)showPhoto(Number(photo.dataset.photo),allPhotos);});
  page.addEventListener('keydown',e=>{const photo=e.target.closest('[data-shop-photo]');if(photo&&(e.key==='Enter'||e.key===' ')){e.preventDefault();showShopPhotos(photo.dataset.shopPhoto);}});
  page.querySelector('[role=tablist]').addEventListener('keydown',e=>{const keys=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();const current=tabs.findIndex(([id])=>id===document.activeElement.dataset.tab);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(current+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+tabs.length)%tabs.length;selectTab(tabs[next][0],true);});
  // 原型購物勾選獨立儲存，保留正式版原有的記錄。
  const shopKey='atlas:proto:shopping:'+trip.name;let checked={};try{checked=JSON.parse(localStorage.getItem(shopKey)||'{}')||{};}catch{}
  function progress(){page.querySelector('#trip-shop-progress').textContent=`已收集 ${page.querySelectorAll('[data-shop]:checked').length} / ${totalShop}`;}
  // 勾選以商品名稱為主鍵(n:名稱)，清單重排也不會跑掉；舊的位置鍵只當備援
  const has=k=>Object.prototype.hasOwnProperty.call(checked,k);
  page.querySelectorAll('[data-shop]').forEach(input=>{const nk='n:'+input.dataset.name;input.checked=has(nk)?Boolean(checked[nk]):has(input.dataset.shop)?Boolean(checked[input.dataset.shop]):localStorage.getItem(`atlas:${trip.name}:${input.dataset.shop}`)==='1';input.addEventListener('change',()=>{checked[nk]=input.checked;checked[input.dataset.shop]=input.checked;setTimeout(applyHide,450);try{localStorage.setItem(shopKey,JSON.stringify(checked));localStorage.setItem(`atlas:${trip.name}:${input.dataset.shop}`,input.checked?'1':'0');}catch{}progress();});});progress();
  // 隱藏已買:整台裝置記住開關;品牌小標/分組全買完也一起收起來
  const hideKey='atlas:shop:hideBought',hideBtn=page.querySelector('.shop-hide-toggle');
  function applyHide(){const on=hideBtn.getAttribute('aria-pressed')==='true';page.querySelectorAll('.shop-swipe-row').forEach(l=>{l.hidden=on&&l.querySelector('[data-shop]').checked;});page.querySelectorAll('.shop-brand').forEach(b=>{let el=b.nextElementSibling,left=false;while(el&&!el.classList.contains('shop-brand')){if(el.matches('.shop-swipe-row')&&!el.hidden)left=true;el=el.nextElementSibling;}b.hidden=!left;});page.querySelectorAll('.trip-shop-group').forEach(g=>{g.hidden=on&&!g.querySelector('.shop-swipe-row:not([hidden])');});page.querySelectorAll('.shop-store').forEach(h=>{let el=h.nextElementSibling,left=false;while(el&&el.classList.contains('in-store')){if(!el.hidden)left=true;el=el.nextElementSibling;}h.hidden=!left;});}
  function setHide(on){hideBtn.setAttribute('aria-pressed',String(on));hideBtn.textContent=on?'顯示全部':'隱藏已買';try{localStorage.setItem(hideKey,on?'1':'0');}catch{}applyHide();}
  hideBtn.addEventListener('click',()=>setHide(hideBtn.getAttribute('aria-pressed')!=='true'));
  let hideOn=false;try{hideOn=localStorage.getItem(hideKey)==='1';}catch{}setHide(hideOn);
  const shopPanel=page.querySelector('#trip-panel-shopping');
  const statusKey='atlas:shop:status:'+trip.name;
  let statuses={};
  try{statuses=JSON.parse(localStorage.getItem(statusKey)||'{}')||{};}catch{}
  let openRow=null, drag=null, wheelDistance=0, wheelRow=null, wheelAt=0, suppressClickUntil=0;
  const statusText={later:'下次買',skip:'不買了'};

  function setOpenRow(row){
    if(row===openRow)return;
    if(openRow){
      openRow.classList.remove('is-open');
      openRow.querySelector('.shop-swipe-actions').hidden=true;
    }
    openRow=row;
    if(row){
      row.querySelector('.shop-swipe-actions').hidden=false;
      row.classList.add('is-open');
    }
  }

  function renderStatus(row,status){
    const badge=row.querySelector('.shop-status');
    badge.textContent=statusText[status]||'';
    badge.hidden=!badge.textContent;
    row.dataset.status=badge.hidden?'':status;
    row.querySelectorAll('[data-shop-status]').forEach(button=>{
      button.setAttribute('aria-pressed',String(button.dataset.shopStatus===status));
    });
  }

  function saveStatus(row,status){
    const name='n:'+row.querySelector('[data-shop]').dataset.name;
    if(status)statuses[name]=status;
    else delete statuses[name];
    try{localStorage.setItem(statusKey,JSON.stringify(statuses));}catch{}
    renderStatus(row,status);
  }

  shopPanel.querySelectorAll('.shop-swipe-row').forEach(row=>{
    const input=row.querySelector('[data-shop]');
    renderStatus(row,input.checked?'':statuses['n:'+input.dataset.name]);
    input.addEventListener('change',()=>{
      if(input.checked)saveStatus(row,'');
    });
  });

  page.addEventListener('click',event=>{
    if(event.detail&&Date.now()<suppressClickUntil){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);
  page.addEventListener('click',event=>{
    const row=event.target.closest('.shop-swipe-row');
    const choice=event.target.closest('[data-shop-status]');
    if(choice){
      const input=row.querySelector('[data-shop]');
      const status=choice.getAttribute('aria-pressed')==='true'?'':choice.dataset.shopStatus;
      if(status&&input.checked){
        input.checked=false;
        input.dispatchEvent(new Event('change',{bubbles:true}));
        applyHide();
      }
      saveStatus(row,status);
      setOpenRow(null);
      if(!event.detail)row.focus();
    }else if(openRow){
      setOpenRow(null);
    }
  });
  shopPanel.addEventListener('keydown',event=>{
    const row=event.target.closest('.shop-swipe-row');
    if(event.key==='ArrowLeft'&&row===event.target){
      event.preventDefault();
      setOpenRow(row);
      row.querySelector('[data-shop-status]').focus();
    }else if(event.key==='Escape'&&openRow){
      const previous=openRow;
      setOpenRow(null);
      previous.focus();
    }
  });
  function startDrag(row,id,x,y){
    suppressClickUntil=0;
    drag=row?{row,id,x,y,active:false}:null;
  }
  function moveDrag(id,x,y,capture){
    if(!drag||drag.id!==id)return false;
    const dx=x-drag.x,dy=y-drag.y;
    if(!drag.active){
      if(Math.abs(dy)>10&&Math.abs(dy)>=Math.abs(dx)){drag=null;return false;}
      if(Math.abs(dx)<9||Math.abs(dx)<=Math.abs(dy))return false;
      drag.active=true;
      drag.wasOpen=openRow===drag.row;
      if(capture)drag.row.setPointerCapture(id);
      setOpenRow(drag.row);
      drag.row.classList.add('is-dragging');
    }
    const offset=Math.min(0,Math.max(-132,(drag.wasOpen?-132:0)+dx));
    drag.row.style.setProperty('--shop-drag-offset',offset+'px');
    return true;
  }
  function finishDrag(id,x,completed){
    if(!drag||drag.id!==id)return false;
    const start=drag;
    drag=null;
    if(!start.active)return false;
    const dx=x-start.x;
    start.row.classList.remove('is-dragging');
    start.row.style.removeProperty('--shop-drag-offset');
    const open=completed?(start.wasOpen?dx<36:dx<=-36):start.wasOpen;
    setOpenRow(open?start.row:null);
    if(completed)suppressClickUntil=Date.now()+350;
    return true;
  }
  shopPanel.addEventListener('touchstart',event=>{
    if(event.touches.length!==1){
      if(drag)finishDrag(drag.id,drag.x,false);
      return;
    }
    const point=event.touches[0];
    startDrag(event.target.closest('.shop-swipe-row'),'touch:'+point.identifier,point.clientX,point.clientY);
  },{passive:true});
  shopPanel.addEventListener('touchmove',event=>{
    const point=event.changedTouches[0];
    if(point&&moveDrag('touch:'+point.identifier,point.clientX,point.clientY,false)&&event.cancelable)event.preventDefault();
  },{passive:false});
  shopPanel.addEventListener('touchend',event=>{
    const point=event.changedTouches[0];
    if(point&&finishDrag('touch:'+point.identifier,point.clientX,true)&&event.cancelable)event.preventDefault();
  },{passive:false});
  shopPanel.addEventListener('touchcancel',event=>{
    const point=event.changedTouches[0];
    if(point)finishDrag('touch:'+point.identifier,point.clientX,false);
  },{passive:true});
  shopPanel.addEventListener('pointerdown',event=>{
    if(event.pointerType==='touch'||!event.isPrimary||event.button!==0)return;
    startDrag(event.target.closest('.shop-swipe-row'),event.pointerId,event.clientX,event.clientY);
  });
  shopPanel.addEventListener('pointermove',event=>moveDrag(event.pointerId,event.clientX,event.clientY,true));
  for(const type of ['pointerup','pointercancel','lostpointercapture']){
    shopPanel.addEventListener(type,event=>finishDrag(event.pointerId,event.clientX,type==='pointerup'));
  }
  shopPanel.addEventListener('dragstart',event=>{
    if(event.target.closest('.shop-swipe-row'))event.preventDefault();
  });
  shopPanel.addEventListener('wheel',event=>{
    const row=event.target.closest('.shop-swipe-row');
    const delta=event.deltaX|| (event.shiftKey?event.deltaY:0);
    if(!row||!delta||(!event.shiftKey&&Math.abs(delta)<=Math.abs(event.deltaY)))return;
    event.preventDefault();
    const now=Date.now();
    if(wheelRow!==row||now-wheelAt>220)wheelDistance=0;
    wheelRow=row;
    wheelAt=now;
    wheelDistance+=delta*(event.deltaMode===1?16:1);
    if(wheelDistance>=26)setOpenRow(row);
    if(wheelDistance<=-26&&openRow===row)setOpenRow(null);
  },{passive:false});

  page.querySelector('.trip-back').addEventListener('click',goHome);
  return {page,dialog,selectTab,trip};
  }
  let active=null,homeScroll=0;
  function mount(trip){
    if(active?.trip.name===trip.name)return;
    if(active){if(active.dialog.open)active.dialog.close();active.page.remove();active.dialog.remove();}
    document.getElementById('finSheet')?.classList.remove('on');
    active=buildDetail(trip);
  }
  function display(open){
    document.body.classList.toggle('trip-detail-open',open);home.hidden=open;active.page.hidden=!open;
    document.title=open?active.trip._title+' · 旅行檔案室':(location.pathname.includes('proto-cards')?'原型 · 口袋資料夾首頁':'Travel Atlas · 旅行檔案室');
    if(!open&&active.dialog.open)active.dialog.close();
  }
  function routedTrip(){
    if(location.hash==='#hiroshima')return trips.find(t=>/廣島.*倉敷.*高松/.test(t._title));
    if(location.hash.startsWith('#trip=')){try{const name=decodeURIComponent(location.hash.slice(6));return trips.find(t=>t.name===name);}catch{}}
    return null;
  }
  function openTrip(trip){
    homeScroll=window.scrollY;mount(trip);
    const hash=/廣島.*倉敷.*高松/.test(trip._title)?'#hiroshima':'#trip='+encodeURIComponent(trip.name);
    history.pushState({atlasTrip:trip.name},'',hash);display(true);window.scrollTo({top:0,behavior:'instant'});active.page.querySelector('h1').focus({preventScroll:true});
  }
  function restoreHome(){display(false);window.scrollTo(0,homeScroll);folders[trips.findIndex(t=>t.name===active.trip.name)]?.focus({preventScroll:true});}
  function goHome(){if(history.state?.atlasTrip)history.back();else{history.replaceState(null,'',location.pathname+location.search);restoreHome();}}
  folders.forEach((card,i)=>{const trip=trips[i];card.setAttribute('role','button');card.tabIndex=0;card.setAttribute('aria-label','打開 '+trip._title);card.addEventListener('click',()=>openTrip(trip));card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openTrip(trip);}});});
  window.addEventListener('popstate',()=>{const trip=routedTrip();if(trip){mount(trip);display(true);window.scrollTo(0,0);}else if(active)restoreHome();});
  const initial=routedTrip();
  const defaultTrip=initial||trips.find(t=>/廣島.*倉敷.*高松/.test(t._title))||trips[0];
  if(defaultTrip){mount(defaultTrip);if(initial)display(true);}
})();
