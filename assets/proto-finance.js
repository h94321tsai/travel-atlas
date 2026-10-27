// 沿用 Travel Atlas.html 的記帳邏輯與 atlas:fin: 儲存格式。
(() => {
  const detailBody={querySelector:selector=>document.getElementById('trip-panel-finance')?.querySelector(selector)};
  const TODAY=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Taipei'});
  function openLightbox(list,i=0){
    const dialog=document.createElement('dialog');dialog.className='trip-lightbox';dialog.setAttribute('aria-label','收據照片');
    const img=document.createElement('img');img.src=list[i];img.alt='收據';
    const close=document.createElement('button');close.textContent='關閉 ×';close.onclick=()=>dialog.close();
    dialog.append(img,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();
  }
const FIN_CATS=[{k:'food',i:'🍜',n:'餐飲'},{k:'transit',i:'🚃',n:'交通'},{k:'stay',i:'🏨',n:'住宿'},{k:'shop',i:'🛍️',n:'購物'},{k:'ticket',i:'🎟️',n:'門票體驗'},{k:'other',i:'📦',n:'其他'}];
const catOf=k=>FIN_CATS.find(c=>c.k===k)||FIN_CATS[5];
const FIN_CURRENCIES=['JPY','TWD','KRW','THB','USD','VND','EUR'];
const finKey=t=>`atlas:fin:${t.name}`;
const nfInt=new Intl.NumberFormat('en-US');
const twdFmt=n=>'NT$'+nfInt.format(Math.round(n||0));
const finUid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function finLoad(t){ let d=null; try{d=JSON.parse(localStorage.getItem(finKey(t)));}catch(e){}
  if(!d||typeof d!=='object') d={};
  if(!Array.isArray(d.members)||!d.members.length) d.members=(t.members&&t.members.length)?t.members.slice():['我'];
  if(!Array.isArray(d.expenses)) d.expenses=[];
  if(!d.settled||typeof d.settled!=='object') d.settled={};
  const seed=t.financeSource;
  if(seed?.nativeExpenses?.length&&!d.sourceImports?.[seed.importVersion]){
    const prior=localStorage.getItem(finKey(t));if(prior&&!localStorage.getItem(finKey(t)+':before-source-import'))localStorage.setItem(finKey(t)+':before-source-import',prior);
    if(d.members.length===1&&d.members[0]==='我'&&!d.expenses.length)d.members=[];
    d.members=Array.from(new Set([...d.members,...(seed.members||[]),...seed.nativeExpenses.flatMap(e=>[e.payer,...Object.keys(e.shares)])]));
    for(const e of seed.nativeExpenses)if(!d.expenses.some(existing=>existing.id===e.id))d.expenses.push(JSON.parse(JSON.stringify(e)));
    d.sourceImports={...(d.sourceImports||{}),[seed.importVersion]:true};
    localStorage.setItem(finKey(t),JSON.stringify(d));
  }
  // 預設成員「我」就是 owner 本人:匯入後兩者並存時合併成 owner,帳目一起轉過去
  const owner=seed?.owner;
  if(owner&&owner!=='我'&&d.members.includes('我')&&d.members.includes(owner)){
    const prior=localStorage.getItem(finKey(t));if(prior&&!localStorage.getItem(finKey(t)+':before-merge-me'))localStorage.setItem(finKey(t)+':before-merge-me',prior);
    const mergeKey=o=>{if(o&&typeof o==='object'&&'我' in o){o[owner]=(+o[owner]||0)+(+o['我']||0);delete o['我'];}};
    for(const e of d.expenses){
      if(e.payer==='我')e.payer=owner;
      if(e.autoMember==='我')e.autoMember=owner;
      if(Array.isArray(e.consumers))e.consumers=Array.from(new Set(e.consumers.map(m=>m==='我'?owner:m)));
      mergeKey(e.shares);mergeKey(e.extras);mergeKey(e.allocations);
    }
    d.members=d.members.filter(m=>m!=='我');for(const k of Object.keys(d.settled))if(k.split('>').includes('我'))delete d.settled[k];
    localStorage.setItem(finKey(t),JSON.stringify(d));
  }
  const history=t.financeSource?.historicalRates;
  if(d.notionImported&&history&&!d.notionImported.historicalVersion){
    const snapshot=localStorage.getItem(finKey(t));
    if(snapshot&&!localStorage.getItem(finKey(t)+':before-historical'))localStorage.setItem(finKey(t)+':before-historical',snapshot);
    for(const e of d.expenses){
      const rt=history.rates[e.date];
      if(!e.id?.startsWith('notion-')||e.deleted||e.currency!=='THB'||!rt)continue;
      e.rate=rt;e.twd=Math.round(e.amount*rt);e.est=true;
      e.note=(e.note||'').replace(/匯入時參考匯率[^\n]*/g,'').trim()+`\n歷史參考匯率：1 THB = ${rt} TWD（${e.date}；${/2025-11-0[12]/.test(e.date)?'週末沿用10/31；':''}Exchange-Rates.org），非實際刷卡／換鈔匯率。`;
      e.updatedAt=Date.now();
    }
    d.notionImported.historicalVersion=1;d.notionImported.rateSource=history.source;
    localStorage.setItem(finKey(t),JSON.stringify(d));
  }
  return d; }
// Source IDs remain stable so edits and deleted rows are never imported twice.
function importNotionFinance(t,rate){
  const records=t.financeSource?.records||[];if(!records.length||!(rate>0))return;
  const d=finLoad(t);if(d.notionImported)return;
  const prior=localStorage.getItem(finKey(t));
  if(prior&&!localStorage.getItem(finKey(t)+':before-notion'))localStorage.setItem(finKey(t)+':before-notion',prior);
  d.members=Array.from(new Set([...(d.members.length===1&&d.members[0]==='我'&&!d.expenses.length?[]:d.members),'若涵','屁屁']));
  for(const row of records){
    if((row.twd===null&&row.thb===null)||d.expenses.some(e=>e.id===row.id))continue;
    const shared=row.consumer==='平分',currency=row.twd!==null?'TWD':'THB';
    const original=currency==='TWD'?row.twd:row.thb,amount=Math.abs(original)*(shared?2:1),rt=currency==='TWD'?1:rate;
    const payer=row.payer==='屁屁'?'屁屁':'若涵';
    d.expenses.push({id:row.id,date:row.date.slice(0,10),title:row.title,amount,currency,rate:rt,est:currency!=='TWD',twd:Math.round(amount*rt),
      category:row.category==='飯店'?'stay':row.category==='交通'?'transit':row.category==='吃+點心'?'food':/按摩|指甲/.test(row.title)?'ticket':row.category==='阿哩不噠'?'shop':'other',payer,
      shares:shared?{'若涵':1,'屁屁':1}:{'若涵':1},extras:{},
      note:[row.note,`Notion 原金額：${currency} ${original}；付款欄：${row.payer}；消費欄：${row.consumer}`,shared?'依每人份還原兩人總額；此為匯入假設。':'JOHAN／若涵個人消費對應若涵。',currency==='THB'?`匯入時參考匯率 ${rate}，非歷史成交匯率，台幣暫估。`:''].filter(Boolean).join('\n'),
      createdAt:Date.parse(row.date.slice(0,10)+'T00:00:00')||0,updatedAt:Date.now(),deleted:false});
  }
  d.notionImported={at:new Date().toISOString(),rate,rule:'shared-personal-share-times-two',pending:records.filter(row=>row.twd===null&&row.thb===null).map(row=>row.id)};
  finSave(t,d);
}
function finSave(t,d){ localStorage.setItem(finKey(t),JSON.stringify(d)); }
function tripDayOf(t,dateStr){ if(!t.start||!dateStr)return null; const s=new Date(t.start+'T00:00:00'),x=new Date(dateStr+'T00:00:00'); const diff=Math.round((x-s)/86400000); return (diff>=0 && (!t.days||diff<t.days))?(diff+1):null; }
// 匯率:open.er-api.com,每日每幣別快取;抓不到沿用最近一次並標暫估
async function finRate(cur){ if(!cur||cur==='TWD')return {rate:1,est:false};
  const ck=`atlas:rate:${cur}:${TODAY}`, c=localStorage.getItem(ck); if(c)return {rate:+c,est:false};
  try{ const r=await fetch(`https://open.er-api.com/v6/latest/${cur}`); const j=await r.json();
    const v=j&&j.rates&&j.rates.TWD; if(v){localStorage.setItem(ck,String(v));return {rate:v,est:false};} }catch(e){}
  for(let i=1;i<=30;i++){ const d=new Date(Date.now()-i*86400000).toISOString().slice(0,10); const cc=localStorage.getItem(`atlas:rate:${cur}:${d}`); if(cc)return {rate:+cc,est:true}; }
  return {rate:null,est:true}; }
// 單筆分攤 → 每人應付 TWD(先扣各人加點、剩餘按份數均分、再加回加點)
function splitExpense(e){ const res={}, total=e.twd||0, shares=e.shares||{}, extras=e.extras||{};
  if(e.splitMode==='amount'&&e.allocations){
    const entries=Object.entries(e.allocations).filter(([,v])=>+v>0), sum=entries.reduce((a,[,v])=>a+(+v),0);
    let used=0; entries.forEach(([n,v],i)=>{const value=i===entries.length-1?total-used:Math.round(total*(+v)/sum*100)/100;res[n]=value;used+=value;});
    return res;
  }
  const names=Object.keys(shares).filter(n=>+shares[n]>0);
  let extrasSum=0; for(const n in extras) extrasSum+=(+extras[n]||0);
  const base=total-extrasSum, tot=names.reduce((s,n)=>s+(+shares[n]||0),0)||1;
  names.forEach(n=>res[n]=base*(+shares[n]||0)/tot+(+extras[n]||0));
  for(const n in extras){ if(!(n in res)) res[n]=(+extras[n]||0); }
  return res; }
// 結算:每人已付/應分攤/淨額 + 最少轉帳
function computeSettle(t,d){ const per={}; d.members.forEach(m=>per[m]={paid:0,owed:0});
  d.expenses.filter(e=>!e.deleted).forEach(e=>{ if(!per[e.payer])per[e.payer]={paid:0,owed:0}; per[e.payer].paid+=e.twd||0;
    const sp=splitExpense(e); for(const n in sp){ if(!per[n])per[n]={paid:0,owed:0}; per[n].owed+=sp[n]; } });
  const cred=[],deb=[]; for(const n in per){ const v=Math.round(per[n].paid-per[n].owed); if(v>0)cred.push([n,v]); else if(v<0)deb.push([n,-v]); }
  cred.sort((a,b)=>b[1]-a[1]); deb.sort((a,b)=>b[1]-a[1]);
  const transfers=[]; let i=0,j=0;
  while(i<deb.length&&j<cred.length){ const pay=Math.min(deb[i][1],cred[j][1]); if(pay>0)transfers.push({from:deb[i][0],to:cred[j][0],amt:pay});
    deb[i][1]-=pay; cred[j][1]-=pay; if(deb[i][1]===0)i++; if(cred[j][1]===0)j++; }
  return {per,transfers}; }

let finTrip=null;
function renderFinance(t){ finTrip=t; const root=detailBody.querySelector('#finRoot'); if(!root)return;
  const d=finLoad(t), me=t.financeSource?.owner||d.members[0]||'我';
  const exps=d.expenses.filter(e=>!e.deleted).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')||((b.createdAt||0)-(a.createdAt||0)));
  const total=exps.reduce((s,e)=>s+(e.twd||0),0);
  const myPaid=exps.filter(e=>e.payer===me).reduce((s,e)=>s+(e.twd||0),0);
  const mySpent=exps.reduce((sum,e)=>sum+(splitExpense(e)[me]||0),0);
  const byCur={}; exps.forEach(e=>byCur[e.currency]=(byCur[e.currency]||0)+(+e.amount||0));
  const foreign=Object.entries(byCur).filter(([c])=>c!=='TWD').map(([c,a])=>`${c} ${nfInt.format(Math.round(a))}`).join('　·　');
  const summary=`<div class="fin-summary"><div class="fin-main"><span class="fv">${twdFmt(mySpent)}</span><span class="fl">我的個人總花費${exps.some(e=>e.est)?'（暫估）':''}</span></div>
    <div class="fin-subs"><div><b>${twdFmt(myPaid)}</b><span>我付的</span></div><div><b>${twdFmt(total)}</b><span>已記錄全體支出</span></div></div>
    ${foreign?`<div class="fin-foreign">全體支出原幣 ${foreign}</div>`:''}</div>`;
  // 📊 花費分析:類別圓餅 + 每日長條
  let chartHTML='';
  if(exps.length&&total>0){
    const CATC={food:'#f3b89b',transit:'#c8daea',stay:'#b7bfdf',shop:'#f7d2d8',ticket:'#e7d8b6',other:'#d2c6ac'};
    const byCat={}; exps.forEach(e=>{const k=e.category||'other'; byCat[k]=(byCat[k]||0)+(e.twd||0);});
    const catArr=FIN_CATS.map(c=>({...c,v:byCat[c.k]||0})).filter(c=>c.v>0).sort((a,b)=>b.v-a.v);
    let acc=0; const stops=catArr.map(c=>{const from=acc/total*360; acc+=c.v; const to=acc/total*360; return `${CATC[c.k]} ${from.toFixed(1)}deg ${to.toFixed(1)}deg`;}).join(',');
    const legend=catArr.map(c=>`<div class="lg-row"><span class="lg-sw" style="background:${CATC[c.k]}"></span><span class="lg-n">${c.n}</span><span class="lg-v">${twdFmt(c.v)}</span><span class="lg-p">${Math.round(c.v/total*100)}%</span></div>`).join('');
    const dayMap={}; exps.forEach(e=>{dayMap[e.date]=(dayMap[e.date]||0)+(e.twd||0);});
    const dayKeys=Object.keys(dayMap).sort(); const maxD=Math.max(...Object.values(dayMap),1);
    const bars=dayKeys.map(dt=>{const v=dayMap[dt]; const h=Math.max(4,v/maxD*100); const dn=tripDayOf(t,dt);
      const lab=dn?('D'+dn):(dt||'').slice(5).replace('-','/'); const vs=v>=1000?(v/1000).toFixed(v>=10000?0:1)+'k':Math.round(v);
      return `<div class="bar-col" title="${dt}　${twdFmt(v)}"><span class="bar-v">${vs}</span><div class="bar" style="height:${h.toFixed(1)}%"></div><span class="bar-d">${lab}</span></div>`;}).join('');
    chartHTML=`<div class="fin-sec fin-charts"><div class="fin-sec-h">花費分析</div>
      <div class="chart-donut-wrap"><div class="donut-box"><div class="chart-donut" style="background:conic-gradient(${stops})"></div><span class="donut-lbl">類別</span></div><div class="chart-legend">${legend}</div></div>
      ${dayKeys.length>1?`<div class="bars-wrap"><div class="bars-cap">每日花費</div><div class="bars-row">${bars}</div></div>`:''}</div>`;
  }
  // 明細:依日期(Day)分組
  let detailHTML='';
  if(exps.length){
    const groups={}; exps.forEach(e=>{ (groups[e.date]=groups[e.date]||[]).push(e); });
    const dates=Object.keys(groups).sort((a,b)=>b.localeCompare(a));
    detailHTML=dates.map(dt=>{ const items=groups[dt]; const sub=items.reduce((s,e)=>s+(e.twd||0),0);
      const dayN=tripDayOf(t,dt); const label=(dayN?`Day ${dayN}`:'')+(dayN?'　':'')+(dt||'日期未填');
      const rows=items.map(e=>{ const c=catOf(e.category); const sp=splitExpense(e); const who=Object.keys(sp);
        const splitTxt=who.length>=d.members.length?'全員':(who.length<=1?(who[0]||''):who.join('、'));
        return `<div class="fin-item" data-id="${e.id}"><div class="fi-ic">${c.i}</div>
          <div class="fi-mid"><div class="fi-t">${e.title||c.n}${e.followUp?'<span class="fin-followup-badge">待回家處理</span>':''}</div>
          <div class="fi-sub">${e.payer} 付・分 ${splitTxt}${e.note?'・'+e.note:''}</div>${e.items?`<div class="fi-items">${String(e.items).replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])).replace(/\n/g,'<br>')}</div>`:''}</div>
          ${e.receipt?`<img class="fi-rcpt" data-rk="${e.receipt}" alt="收據" hidden>`:''}
          <div class="fi-amt"><div class="fi-twd">${twdFmt(e.twd)}</div>${e.currency!=='TWD'?`<div class="fi-ori">${e.currency} ${nfInt.format(Math.round(e.amount))}${e.est?' <span class="est">暫估</span>':''}</div>`:''}</div></div>`;}).join('');
      return `<div class="fin-daygrp"><div class="fin-dayhead"><span>${label}</span><span class="fin-daysub">${twdFmt(sub)}</span></div>${rows}</div>`;}).join('');
  } else detailHTML=`<div class="d-empty">還沒有任何花費，點上方「新增一筆」開始記帳。</div>`;
  // 結算
  const {per,transfers}=computeSettle(t,d);
  let settleHTML='';
  if(exps.length){
    const rows=d.members.map(m=>{const p=per[m]||{paid:0,owed:0},net=p.paid-p.owed;
      return `<div class="set-row"><span class="set-name">${m}</span><span class="set-fig">付 ${twdFmt(p.paid)}</span><span class="set-fig">分 ${twdFmt(p.owed)}</span><span class="set-net ${net>=0?'pos':'neg'}">${net>=0?'+':'−'}${twdFmt(Math.abs(net))}</span></div>`;}).join('');
    const tr=transfers.length?transfers.map((x,i)=>{const key=`${x.from}>${x.to}`;const done=!!d.settled[key];
      return `<div class="set-transfer ${done?'done':''}" data-k="${key}"><span>${x.from} <span class="arr">→</span> ${x.to}</span><span class="tr-amt">${twdFmt(x.amt)}</span><button class="tr-done">${done?'已還款 ✓':'標為已還'}</button></div>`;}).join(''):`<div class="d-empty" style="padding:4px 0">目前打平,不用轉帳 🎉</div>`;
    settleHTML=`<div class="fin-sec"><div class="fin-sec-h">分帳結算</div><div class="set-table">${rows}</div><div class="set-transfers">${tr}</div></div>`;
  }
  const tools=`<div class="fin-tools"><button class="fin-tbtn" id="finMembers">👥 成員(${d.members.length})</button><button class="fin-tbtn" id="finExport">💾 匯出備份</button><button class="fin-tbtn" id="finOcrCfg">⚙️ 收據辨識設定</button></div>`;
  const heading=`<div class="fin-page-heading"><div><p>EXPENSES / 旅行記帳</p><span>金額統一換算為新台幣</span></div><button class="fin-fab" id="finAdd" aria-label="記一筆">＋ 新增一筆</button></div>`;
  const detailSection=`<section class="fin-details"><h3 class="fin-sec-h">花費明細</h3>${detailHTML}</section>`;
  const sourceRows=t.financeSource?.records||[];
  const sourceText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sourceAmount=(value,currency)=>value===null||value===undefined?'—':`${currency} ${nfInt.format(value)}`;
  const imported=sourceRows.length?`<details class="fin-source"><summary class="fin-sec-h">Notion 原始記帳 · ${sourceRows.length} 筆（含2筆待確認）</summary><p class="fin-source-note">原始資料備查；此處的欄位合計不重複計入統計。待確認：機票未填金額；乙萱代買THB1,720僅記在備註、付款與分攤待補。</p><div class="fin-source-totals"><strong>${sourceAmount(sourceRows.reduce((sum,row)=>sum+(row.twd||0),0),'NT$')}</strong><strong>${sourceAmount(sourceRows.reduce((sum,row)=>sum+(row.thb||0),0),'THB')}</strong></div><div class="fin-source-scroll" role="region" aria-label="Notion 原始記帳明細" tabindex="0"><table><thead><tr><th>日期</th><th>項目／備註</th><th>類別</th><th>台幣</th><th>泰銖</th><th>付款人（原欄位）</th><th>消費對象（原欄位）</th></tr></thead><tbody>${sourceRows.map(row=>`<tr data-source-id="${sourceText(row.id)}"><td>${sourceText(row.date)}</td><td><b>${sourceText(row.title)}</b>${row.note?`<small>${sourceText(row.note)}</small>`:''}${row.twd===null&&row.thb===null?'<small>金額欄未填</small>':''}</td><td>${sourceText(row.category)}</td><td>${sourceAmount(row.twd,'NT$')}</td><td>${sourceAmount(row.thb,'THB')}</td><td>${sourceText(row.payer)||'未填'}</td><td>${sourceText(row.consumer)||'未填'}</td></tr>`).join('')}</tbody></table></div></details>`:'';
  const importNotice=sourceRows.length?`<p class="fin-source-note">匯入規則：平分金額按每人份×2還原，負數轉為屁屁付款；JOHAN對應若涵。泰銖依支出日期的歷史參考匯率換算；11/1–11/2沿用10/31。統計與結算仍為估算，不含銀行價差與手續費。${d.notionImported?'已轉入63筆，可點明細修改；原表65筆保留於下方。':'正在套用歷史匯率；完成後會轉入明細。'}</p>`:'';
  const nativeNotice=t.financeSource?.nativeExpenses?`<section class="fin-source"><h3 class="fin-sec-h">Notion 記帳已匯入 · ${t.financeSource.nativeExpenses.length} 筆</h3><p class="fin-source-note">依原表付款與分攤對象計算，沒有再次還原或折半；韓元沿用原表匯率0.023。原表沒有日期，明細標示「日期未填」。</p>${(t.financeSource.pending||[]).length?`<details><summary>待確認 ${(t.financeSource.pending||[]).length} 筆（尚未計入統計）</summary>${t.financeSource.pending.map(e=>`<p class="fin-source-note">${sourceText(e.title)}：${sourceText(e.currency||'幣別未填')} ${nfInt.format(e.amount)}；付款人${sourceText(e.payer)}，分攤者未填。</p>`).join('')}</details>`:''}</section>`:'';
  const followUps=exps.filter(e=>e.followUp);
  const followUpHTML=followUps.length?`<section class="fin-followups"><h3 class="fin-sec-h">待回家處理 · ${followUps.length} 筆</h3><p class="fin-source-note">點選紀錄補齊內容，完成後取消勾選。已填金額仍計入統計；未填金額暫不計入。</p>${followUps.map(e=>`<button type="button" class="fin-followup-open" data-followup-id="${sourceText(e.id)}"><span>${sourceText(e.title||'未命名紀錄')}</span><span>${e.amount?sourceText(e.currency)+' '+nfInt.format(e.amount):'金額待補'} →</span></button>`).join('')}</section>`:'';
  root.innerHTML=heading+followUpHTML+nativeNotice+importNotice+((sourceRows.length&&!exps.length)?'<p class="fin-source-note">目前沒有另外新增的記帳；可使用「新增一筆」補記。</p>':summary+chartHTML+detailSection+settleHTML)+imported+tools;
  // wire
  root.querySelector('#finAdd').onclick=()=>openExpenseSheet(t,null);
  root.querySelectorAll('[data-followup-id]').forEach(button=>button.onclick=()=>{const e=d.expenses.find(e=>e.id===button.dataset.followupId);if(e)openExpenseSheet(t,e);});
  root.querySelectorAll('.fin-item').forEach(el=>el.onclick=()=>{const e=d.expenses.find(x=>x.id===el.dataset.id); if(e)openExpenseSheet(t,e);});
  root.querySelectorAll('.fi-rcpt[data-rk]').forEach(img=>{ idbGet(img.dataset.rk).then(u=>{if(u){img.src=u;img.hidden=false;}}); img.onclick=(ev)=>{ev.stopPropagation(); if(img.src)openLightbox([img.src],0);}; });
  root.querySelectorAll('.tr-done').forEach(b=>b.onclick=()=>{const k=b.closest('.set-transfer').dataset.k; d.settled[k]=!d.settled[k]; finSave(t,d); renderFinance(t);});
  const mb=root.querySelector('#finMembers'); if(mb)mb.onclick=()=>openMembersSheet(t);
  root.querySelector('#finExport').onclick=()=>exportFinance(t);
  root.querySelector('#finOcrCfg').onclick=()=>openOcrConfig();
}

/* ---------- 💰 OCR 設定(Cloudflare Worker) ---------- */
const OCR_CFG_KEY='atlas:finOCR';
function ocrCfg(){ try{return JSON.parse(localStorage.getItem(OCR_CFG_KEY))||{};}catch(e){return {};} }
function openOcrConfig(){ const c=ocrCfg();
  openSheet('收據辨識設定',`<label class="fin-lbl">Worker 網址</label><input class="fin-in" id="ocrUrl" placeholder="https://xxx.workers.dev" value="${c.url||''}">
    <label class="fin-lbl">通關密語</label><input class="fin-in" id="ocrSecret" placeholder="你在 Worker 設的密語" value="${c.secret||''}">
    <p class="fin-hint">設定好後,記帳時就能用「📷 掃描收據」自動帶入金額。這兩個值只存在你這台裝置。</p>`,
    ()=>{ localStorage.setItem(OCR_CFG_KEY,JSON.stringify({url:document.getElementById('ocrUrl').value.trim(),secret:document.getElementById('ocrSecret').value.trim()})); closeSheet(); });
}
async function ocrScan(dataUrl){ const c=ocrCfg(); if(!c.url)throw new Error('尚未設定收據辨識(右下⚙️)');
  const r=await fetch(c.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret:c.secret,image:dataUrl,today:TODAY})});
  let j={}; try{j=await r.json();}catch(e){}
  if(!r.ok) throw new Error(j.error||('HTTP '+r.status));
  if(j&&j.error) throw new Error(j.error);
  return j;
}

/* ---------- 收據圖片儲存(IndexedDB) ---------- */
let _idb=null;
function idb(){ if(_idb)return _idb; _idb=new Promise((res,rej)=>{const q=indexedDB.open('atlasReceipts',1);
  q.onupgradeneeded=()=>q.result.createObjectStore('r'); q.onsuccess=()=>res(q.result); q.onerror=()=>rej(q.error);}); return _idb; }
async function idbPut(k,v){ const db=await idb(); return new Promise((res,rej)=>{const tx=db.transaction('r','readwrite');tx.objectStore('r').put(v,k);tx.oncomplete=res;tx.onerror=()=>rej(tx.error);}); }
async function idbGet(k){ const db=await idb(); return new Promise((res)=>{const tx=db.transaction('r','readonly');const rq=tx.objectStore('r').get(k);rq.onsuccess=()=>res(rq.result);rq.onerror=()=>res(null);}); }
async function resizeImg(file,max=1200,q=0.72){ const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=URL.createObjectURL(file);});
  const r=Math.min(1,max/Math.max(img.width,img.height)); const cv=document.createElement('canvas'); cv.width=Math.round(img.width*r); cv.height=Math.round(img.height*r);
  cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height); URL.revokeObjectURL(img.src); return cv.toDataURL('image/jpeg',q); }

/* ---------- bottom sheet ---------- */
function ensureSheet(){ let s=document.getElementById('finSheet'); if(s)return s;
  s=document.createElement('div'); s.id='finSheet'; s.className='fin-sheet';
  s.innerHTML=`<div class="fin-sheet-card"><div class="fin-sheet-head"><span class="fsh-title"></span><button class="fsh-x">✕</button></div><div class="fin-sheet-body"></div><div class="fin-sheet-foot"><button class="fsh-save"></button></div></div>`;
  document.body.appendChild(s); s.onclick=e=>{if(e.target===s)closeSheet();}; s.querySelector('.fsh-x').onclick=closeSheet; return s; }
function openSheet(title,bodyHTML,onSave,saveLabel='儲存'){ const s=ensureSheet(); s.querySelector('.fsh-title').textContent=title;
  s.querySelector('.fin-sheet-body').innerHTML=bodyHTML; const sv=s.querySelector('.fsh-save'); sv.textContent=saveLabel; sv.disabled=false; sv.style.display=onSave?'':'none'; sv.onclick=onSave||null;
  s.classList.add('on'); return s; }
function closeSheet(){ const s=document.getElementById('finSheet'); if(s)s.classList.remove('on'); }
addEventListener('keydown',e=>{if(e.key==='Escape'){const s=document.getElementById('finSheet'); if(s&&s.classList.contains('on')){closeSheet();}}});

/* ---------- 記一筆 / 編輯 ---------- */
function openExpenseSheet(t,exp){ const d=finLoad(t), me=t.financeSource?.owner||d.members[0]||'我', editing=!!exp, e=exp||{};
  let cur=e.currency||t.currency||'JPY', rate=(e.rate||null), est=e.est||false, receiptKey=e.receipt||null;
  const cats=FIN_CATS.map(c=>`<button class="cat-chip ${(e.category||'food')===c.k?'on':''}" data-k="${c.k}">${c.i}<span>${c.n}</span></button>`).join('');
  const curOpts=FIN_CURRENCIES.map(c=>`<option ${c===cur?'selected':''}>${c}</option>`).join('');
  const payerOpts=d.members.map(m=>`<option ${(e.payer||me)===m?'selected':''}>${m}</option>`).join('');
  const shares=e.shares||{}, extras=e.extras||{}, previous=splitExpense(e);
  let splitting=editing&&(e.splitEnabled??(Object.keys(previous).some(n=>n!==me))), splitMode=e.splitMode||((Object.keys(extras).length||Object.values(shares).some(v=>v!==1))?'amount':'equal');
  const memberOn=m=>editing?((m in shares&&+shares[m]>0)||(m in previous&&previous[m]>0)):true;
  const memberChips=d.members.map(m=>`<label class="sp-person"><input type="checkbox" class="sp-on" data-m="${m}" ${memberOn(m)?'checked':''}><span>${m===me?'我':m}</span></label>`).join('');
  const splitRows=d.members.map(m=>{
    const amount=e.allocations?.[m]??(e.twd?Math.round((previous[m]||0)/e.twd*(e.amount||0)*100)/100:'');
    return `<div class="sp-row" data-m="${m}"><span class="sp-name">${m===me?'我':m}<small class="sp-auto-label" data-m="${m}">餘額</small></span>
      <div class="sp-value"><output class="sp-equal" data-m="${m}"></output><input aria-label="${m}分攤金額" class="sp-amount fin-in" data-m="${m}" inputmode="decimal" placeholder="0" value="${amount}"></div></div>`;}).join('');
  // 快速帶入:這趟最近用過的(類別+名稱)+ 幾個常見預設
  let quickHTML='';
  if(!editing){
    const seen=new Set(), recents=[];
    d.expenses.filter(x=>!x.deleted&&x.title).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).forEach(x=>{const key=(x.category||'other')+'|'+x.title; if(!seen.has(key)){seen.add(key);recents.push({c:x.category||'other',t:x.title});}});
    const defaults=[{c:'food',t:'便利商店'},{c:'food',t:'餐廳'},{c:'transit',t:'計程車'},{c:'transit',t:'車票'},{c:'ticket',t:'門票'},{c:'shop',t:'藥妝'}];
    const quick=recents.slice(0,6); defaults.forEach(dq=>{if(quick.length<6&&!quick.some(q=>q.t===dq.t))quick.push(dq);});
    const chips=quick.slice(0,6).map(q=>{const c=catOf(q.c);return `<button type="button" class="quick-chip" data-cat="${q.c}" data-title="${q.t.replace(/"/g,'&quot;')}">${c.i} ${q.t}</button>`;}).join('');
    if(chips)quickHTML=`<div class="quick-wrap"><div class="quick-lbl">⚡ 快速帶入</div><div class="quick-row">${chips}</div></div>`;
  }
  const body=`${quickHTML}<div class="amt-wrap"><input id="fAmt" class="amt-in" inputmode="decimal" placeholder="0" value="${e.amount||''}"><select id="fCur" class="cur-sel">${curOpts}</select></div>
    <div id="fTwd" class="twd-preview"></div>
    <div class="cat-row">${cats}</div>
    <input id="fTitle" class="fin-in" placeholder="名稱(選填,例:島田水產)" value="${(e.title||'').replace(/"/g,'&quot;')}">
    <textarea id="fItems" class="fin-in fin-items-in" rows="3" placeholder="細項(選填)—每行一項,例:生啤 ×2 ¥1200&#10;唐揚雞 ¥680。掃描收據會自動帶入">${(e.items||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</textarea>
    <div class="row2"><div><label class="fin-lbl">日期</label><input id="fDate" type="date" class="fin-in" value="${editing?(e.date||''):TODAY}"></div>
      <div><label class="fin-lbl">誰付的</label><select id="fPayer" class="fin-in">${payerOpts}</select></div></div>
    <div id="fDayHint" class="day-hint"></div>
    <section class="fin-split-section"><div class="split-head">分帳<span class="fin-segment" id="fSplitToggle"><button type="button" data-value="no">不分</button><button type="button" data-value="yes">分</button></span></div>
    <div id="fSplit"><div class="sp-people">${memberChips}</div><div class="split-head sp-method"><span>分攤方式</span><span class="fin-segment" id="fSplitMode"><button type="button" data-value="equal">平均</button><button type="button" data-value="amount">指定金額</button></span></div>
    <div class="sp-table-head"><span class="fin-split-currency"></span><label id="fAutoWrap">餘額歸 <select id="fAutoMember" aria-label="自動計算餘額的對象"></select></label></div><div class="sp-amounts">${splitRows}</div><div id="fSplitTotal" class="fin-split-total" aria-live="polite"></div><div id="fSplitError" role="alert"></div></div></section>
    <input id="fNote" class="fin-in" placeholder="備註(選填)" value="${(e.note||'').replace(/"/g,'&quot;')}">
    <label class="fin-followup-field"><input id="fFollowUp" type="checkbox" ${e.followUp?'checked':''}><span><b>待回家處理</b><small>先記下來，之後再核對金額、收據或分攤；可先不填金額。</small></span></label>
    <div class="receipt-row"><button type="button" id="fScan" class="fin-scan">📷 掃描 / 附收據</button><div id="fReceiptPrev" class="rcpt-prev"></div></div>
    ${editing?`<button type="button" id="fDelete" class="fin-del">刪除這筆</button>`:''}
    <input type="file" id="fFile" accept="image/*" capture="environment" hidden>`;
  openSheet(editing?'編輯花費':'記一筆',body,save,'儲存');
  const sh=document.getElementById('finSheet');
  const amtEl=sh.querySelector('#fAmt'), curEl=sh.querySelector('#fCur'), twdEl=sh.querySelector('#fTwd');
  const esc=s=>(window.CSS&&CSS.escape)?CSS.escape(s):s.replace(/["\\\]]/g,'\\$&');
  function updTwd(){ const a=parseFloat(amtEl.value)||0; if(rate==null){twdEl.textContent='匯率抓取中…';return;} twdEl.innerHTML=`≈ <b>${twdFmt(a*rate)}</b> <span class="rate-note">1 ${cur}≈${(+rate).toFixed(cur==='JPY'||cur==='KRW'||cur==='VND'?4:3)} TWD${est?' · 暫估':''} · 點改</span>`; }
  async function loadRate(){ rate=null; updTwd(); const r=await finRate(cur); rate=(r.rate!=null?r.rate:1); est=r.est; updTwd(); }
  twdEl.onclick=()=>{ const nr=prompt('手動輸入匯率(1 '+cur+' = ? TWD)',rate); if(nr!=null&&!isNaN(+nr)&&+nr>0){rate=+nr;est=false;updTwd();} };
  amtEl.oninput=updTwd; curEl.onchange=()=>{cur=curEl.value;loadRate();};
  if(rate==null) loadRate(); else updTwd();
  sh.querySelectorAll('.cat-chip').forEach(c=>c.onclick=()=>{sh.querySelectorAll('.cat-chip').forEach(x=>x.classList.remove('on'));c.classList.add('on');});
  sh.querySelectorAll('.quick-chip').forEach(b=>b.onclick=()=>{ sh.querySelector('#fTitle').value=b.dataset.title;
    const cc=sh.querySelector('.cat-chip[data-k="'+b.dataset.cat+'"]'); if(cc){sh.querySelectorAll('.cat-chip').forEach(x=>x.classList.remove('on'));cc.classList.add('on');}
    amtEl.focus(); });
  const dateEl=sh.querySelector('#fDate'), dayHint=sh.querySelector('#fDayHint');
  const updDay=()=>{const n=tripDayOf(t,dateEl.value);dayHint.textContent=n?`→ Day ${n}`:'';}; dateEl.onchange=updDay; updDay();
  const splitEl=sh.querySelector('#fSplit'), splitError=sh.querySelector('#fSplitError');
  function selected(){return [...sh.querySelectorAll('.sp-on')].filter(ck=>ck.checked).map(ck=>ck.dataset.m);}
  function amountInput(m){return [...sh.querySelectorAll('.sp-amount')].find(input=>input.dataset.m===m);}
  let autoMember=e.autoMember||null;
  function updateRemainder(){
    const names=selected(); if(splitMode!=='amount'||!names.length)return;
    if(!names.includes(autoMember))autoMember=names.includes(me)?me:names[names.length-1];
    const sum=names.filter(n=>n!==autoMember).reduce((a,n)=>a+(parseFloat(amountInput(n).value)||0),0);
    amountInput(autoMember).value=Math.round(((parseFloat(amtEl.value)||0)-sum)*100)/100;
  }
  function updateSplit(){
    splitEl.hidden=!splitting;
    sh.querySelectorAll('#fSplitToggle button').forEach(b=>{b.classList.toggle('on',(b.dataset.value==='yes')===splitting);b.setAttribute('aria-pressed',String((b.dataset.value==='yes')===splitting));});
    sh.querySelectorAll('#fSplitMode button').forEach(b=>{b.classList.toggle('on',b.dataset.value===splitMode);b.setAttribute('aria-pressed',String(b.dataset.value===splitMode));});
    const names=selected(), total=parseFloat(amtEl.value)||0;
    const fmt=v=>new Intl.NumberFormat('zh-TW',{maximumFractionDigits:2}).format(v);
    sh.querySelector('.fin-split-currency').textContent=cur;
    sh.querySelectorAll('.sp-amount').forEach(input=>{
      const on=names.includes(input.dataset.m), automatic=input.dataset.m===autoMember;
      input.hidden=splitMode!=='amount';input.disabled=!on;input.readOnly=automatic;
      input.closest('.sp-row').classList.toggle('is-off',!on);
      input.classList.toggle('is-auto',automatic);
    });
    sh.querySelectorAll('.sp-row').forEach(row=>row.hidden=!names.includes(row.dataset.m));
    sh.querySelectorAll('.sp-auto-label').forEach(label=>label.hidden=splitMode!=='amount'||label.dataset.m!==autoMember);
    const autoSelect=sh.querySelector('#fAutoMember');
    if([...autoSelect.options].map(o=>o.value).join('|')!==names.join('|'))autoSelect.innerHTML=names.map(n=>`<option value="${n}">${n===me?'我':n}</option>`).join('');
    autoSelect.value=autoMember||'';
    sh.querySelector('#fAutoWrap').hidden=splitMode!=='amount'||!names.length;
    sh.querySelectorAll('.sp-equal').forEach(out=>{out.hidden=splitMode!=='equal';out.textContent=names.includes(out.dataset.m)?fmt(total/names.length):'—';});
    const sum=names.reduce((a,n)=>a+(parseFloat(amountInput(n).value)||0),0);
    const invalid=splitMode==='amount'&&names.some(n=>(parseFloat(amountInput(n).value)||0)<0);
    sh.querySelector('#fSplitTotal').textContent=names.length?`${names.length} 人 · 合計 ${fmt(splitMode==='equal'?total:sum)} ${cur}`:'尚未選擇對象';
    splitError.textContent=invalid?'分攤金額超過總額，請調整':'';
    sh.querySelector('.fsh-save').disabled=!!splitting&&(!names.length||invalid);
  }
  sh.querySelectorAll('#fSplitToggle button').forEach(b=>b.onclick=()=>{
    const was=splitting;splitting=b.dataset.value==='yes';
    if(splitting&&!was&&selected().length===1&&selected()[0]===me)sh.querySelectorAll('.sp-on').forEach(ck=>ck.checked=true);
    updateRemainder();updateSplit();
  });
  sh.querySelectorAll('#fSplitMode button').forEach(b=>b.onclick=()=>{splitMode=b.dataset.value;updateRemainder();updateSplit();});
  sh.querySelectorAll('.sp-on').forEach(ck=>ck.onchange=()=>{updateRemainder();updateSplit();});
  sh.querySelector('#fAutoMember').onchange=event=>{autoMember=event.target.value;updateRemainder();updateSplit();};
  sh.querySelectorAll('.sp-amount').forEach(input=>input.oninput=()=>{updateRemainder();updateSplit();});
  amtEl.oninput=()=>{updTwd();updateRemainder();updateSplit();};
  curEl.onchange=()=>{cur=curEl.value;loadRate();updateSplit();};
  if(splitMode==='amount')updateRemainder();
  updateSplit();
  const fileEl=sh.querySelector('#fFile'), prev=sh.querySelector('#fReceiptPrev');
  sh.querySelector('#fScan').onclick=()=>fileEl.click();
  fileEl.onchange=async()=>{ const f=fileEl.files[0]; if(!f)return;
    prev.innerHTML=`<span class="ocr-ing">讀取照片…</span>`;
    let url;
    try{ url=await resizeImg(f); }
    catch(err){ prev.innerHTML=`<span class="ocr-ing err">照片讀不了,可能是 HEIC 格式。請改用 JPG,或直接用相機拍。</span>`; fileEl.value=''; return; }
    receiptKey=receiptKey||('rcpt_'+finUid()); try{await idbPut(receiptKey,url);}catch(e){}
    prev.innerHTML=`<img src="${url}">`;
    const cfg=ocrCfg();
    if(!cfg.url){ const s=document.createElement('span'); s.className='ocr-ing'; s.textContent='已附收據(未設定辨識,右下⚙️)'; prev.appendChild(s); fileEl.value=''; return; }
    const ing=document.createElement('span'); ing.className='ocr-ing'; ing.textContent='辨識中…'; prev.appendChild(ing);
    try{ const res=await ocrScan(url);
      if(res.amount)amtEl.value=res.amount;
      if(res.currency&&FIN_CURRENCIES.includes(res.currency)){cur=res.currency;curEl.value=cur;await loadRate();}
      if(res.date&&/^\d{4}-\d{2}-\d{2}$/.test(res.date)){dateEl.value=res.date;updDay();}
      if(res.merchant)sh.querySelector('#fTitle').value=res.merchant;
      if(res.items&&(Array.isArray(res.items)?res.items.length:String(res.items).trim())){ const txt=(Array.isArray(res.items)?res.items.join('\n'):String(res.items)).trim(); const it=sh.querySelector('#fItems'); it.value=it.value.trim()?it.value.trim()+'\n'+txt:txt; }
      if(res.category){const cc=sh.querySelector('.cat-chip[data-k="'+res.category+'"]');if(cc){sh.querySelectorAll('.cat-chip').forEach(x=>x.classList.remove('on'));cc.classList.add('on');}}
      updTwd(); updateRemainder();updateSplit(); ing.textContent='✓ 已帶入,請確認'; setTimeout(()=>ing.remove(),2000); }
    catch(err){ ing.textContent='辨識失敗:'+(err.message||err); ing.classList.add('err'); }
    fileEl.value=''; };
  if(receiptKey) idbGet(receiptKey).then(u=>{if(u)prev.innerHTML=`<img src="${u}">`;});
  const del=sh.querySelector('#fDelete'); if(del)del.onclick=()=>{ if(!confirm('刪除這筆花費?'))return; const i=d.expenses.findIndex(x=>x.id===e.id); if(i>=0){d.expenses[i].deleted=true;d.expenses[i].updatedAt=Date.now();finSave(t,d);} closeSheet(); renderFinance(t); };
  function save(){ const amount=parseFloat(amtEl.value)||0, followUp=sh.querySelector('#fFollowUp').checked; if(amount<0||(!followUp&&amount<=0)){amtEl.focus();return;} if(!amount&&!sh.querySelector('#fTitle').value.trim()){sh.querySelector('#fTitle').focus();return;}
    const cat=(sh.querySelector('.cat-chip.on')&&sh.querySelector('.cat-chip.on').dataset.k)||'other';
    const sHares={},exTras={},allocations={};
    if(!splitting)sHares[me]=1;
    else {
      const names=selected();
      if(!names.length){splitError.textContent='請選擇分攤對象';return;}
      names.forEach(n=>{sHares[n]=1;allocations[n]=parseFloat(amountInput(n).value)||0;});
      if(splitMode==='amount'&&(Object.values(allocations).some(v=>v<0)||Math.abs(Object.values(allocations).reduce((a,v)=>a+v,0)-amount)>0.005)){
        splitError.textContent='分攤金額合計需等於這筆花費';return;
      }
    }
    const rt=rate||1, obj={ id:e.id||finUid(), date:dateEl.value||(editing?e.date:TODAY), title:sh.querySelector('#fTitle').value.trim(),
      amount, currency:cur, rate:rt, est, twd:Math.round(amount*rt), category:cat, payer:sh.querySelector('#fPayer').value,
      followUp, autoMember:splitting&&splitMode==='amount'?autoMember:null, splitEnabled:splitting, splitMode:splitting?splitMode:'equal', allocations:splitting&&splitMode==='amount'?allocations:null, shares:sHares, extras:exTras, note:sh.querySelector('#fNote').value.trim(), items:sh.querySelector('#fItems').value.trim(), receipt:receiptKey,
      createdAt:e.createdAt||Date.now(), updatedAt:Date.now(), deleted:false };
    const i=e.id?d.expenses.findIndex(x=>x.id===e.id):-1; if(i>=0)d.expenses[i]=obj; else d.expenses.push(obj);
    finSave(t,d); closeSheet(); renderFinance(t); }
}

/* ---------- 成員 ---------- */
function openMembersSheet(t){ const d=finLoad(t);
  const list=d.members.map(m=>`<div class="mem-row"><input class="fin-in mem-in" value="${(m||'').replace(/"/g,'&quot;')}"><button type="button" class="mem-del">✕</button></div>`).join('');
  openSheet('分帳成員',`<div id="memList">${list}</div><button type="button" id="memAdd" class="fin-tbtn" style="margin-top:10px">＋ 新增成員</button>
    <p class="fin-hint">第一個成員視為「我」(預設付款人)。</p>`,
    ()=>{ const names=[...document.querySelectorAll('#memList .mem-in')].map(i=>i.value.trim()).filter(Boolean); d.members=names.length?names:['我']; finSave(t,d); closeSheet(); renderFinance(t); });
  const sh=document.getElementById('finSheet');
  const bind=b=>b.onclick=()=>b.closest('.mem-row').remove();
  sh.querySelectorAll('.mem-del').forEach(bind);
  sh.querySelector('#memAdd').onclick=()=>{ const w=sh.querySelector('#memList'); const div=document.createElement('div'); div.className='mem-row';
    div.innerHTML=`<input class="fin-in mem-in" value=""><button type="button" class="mem-del">✕</button>`; w.appendChild(div); bind(div.querySelector('.mem-del')); div.querySelector('.mem-in').focus(); };
}

/* ---------- 匯出 / 匯入 ---------- */
function finDL(name,content,type){ const b=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
function exportFinance(t){ const d=finLoad(t);
  openSheet('匯出 / 匯入備份',`<p class="fin-hint">資料存在這台裝置。建議每趟結束匯出存進 Obsidian vault 備份。</p>
    <button type="button" class="fin-tbtn big" id="exJson">⬇️ 下載 JSON(可重新匯入)</button>
    <button type="button" class="fin-tbtn big" id="exMd">⬇️ 下載 花費.md(給 Obsidian 查看)</button>
    <button type="button" class="fin-tbtn big" id="imJson">⬆️ 匯入 JSON(覆蓋目前資料)</button>
    <input type="file" id="imFile" accept="application/json,.json" hidden>`,null);
  const sh=document.getElementById('finSheet');
  sh.querySelector('#exJson').onclick=()=>{ const exps=d.expenses.filter(e=>!e.deleted);
    finDL(`${t.name} 花費.json`,JSON.stringify({trip:t.name,members:d.members,currency:t.currency,expenses:exps,settled:d.settled,exportedAt:new Date().toISOString()},null,1),'application/json'); };
  sh.querySelector('#exMd').onclick=()=>finDL(`${t.name} 花費.md`,financeMd(t,d),'text/markdown');
  const imFile=sh.querySelector('#imFile');
  sh.querySelector('#imJson').onclick=()=>imFile.click();
  imFile.onchange=()=>{ const f=imFile.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ const j=JSON.parse(r.result); if(!confirm('用匯入的資料「覆蓋」目前花費?'))return;
      const nd={members:j.members||d.members,expenses:j.expenses||[],settled:j.settled||{}}; finSave(t,nd); closeSheet(); renderFinance(t); }
      catch(e){ alert('檔案格式不對'); } }; r.readAsText(f); };
}
function financeMd(t,d){ const exps=d.expenses.filter(e=>!e.deleted).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const total=exps.reduce((s,e)=>s+(e.twd||0),0); const {per,transfers}=computeSettle(t,d);
  let md=`# ${t.title||t.name}・花費\n\n總花費 **${twdFmt(total)}**・每人平均 ${twdFmt(d.members.length?total/d.members.length:0)}\n\n`;
  md+=`| 日期 | 類別 | 名稱 | 原幣 | 台幣 | 付款 | 分給 |\n|---|---|---|---|---|---|---|\n`;
  exps.forEach(e=>{const c=catOf(e.category),who=Object.keys(splitExpense(e)); const nm=(e.title||'')+(e.items?' ／ '+e.items.replace(/\n/g,'；').replace(/\|/g,'／'):''); md+=`| ${e.date} | ${c.i}${c.n} | ${nm} | ${e.currency} ${Math.round(e.amount)} | ${twdFmt(e.twd)} | ${e.payer} | ${who.join('、')} |\n`;});
  md+=`\n## 分帳\n`; d.members.forEach(m=>{const p=per[m]||{paid:0,owed:0};md+=`- **${m}**:付 ${twdFmt(p.paid)}、分 ${twdFmt(p.owed)}、淨 ${(p.paid-p.owed>=0?'+':'−')+twdFmt(Math.abs(p.paid-p.owed))}\n`;});
  if(transfers.length){md+=`\n### 建議轉帳\n`; transfers.forEach(x=>md+=`- ${x.from} → ${x.to} ${twdFmt(x.amt)}${d.settled[x.from+'>'+x.to]?' ✓已還':''}\n`);}
  return md; }


  window.renderProtoFinance=t=>{
    renderFinance(t);
    if(!t.financeSource?.records?.length||finLoad(t).notionImported)return;
    if(t.financeSource.historicalRates){importNotionFinance(t,1);renderFinance(t);return;}
    const root=detailBody.querySelector('#finRoot');
    finRate('THB').then(result=>{
      if(finTrip!==t||detailBody.querySelector('#finRoot')!==root)return;
      if(result.rate>0){importNotionFinance(t,result.rate);renderFinance(t);}
      else {const notice=root.querySelector('.fin-source-note');if(notice)notice.textContent='目前無法取得泰銖匯率，原始65筆已保留；重新開啟記帳頁可再試。未以錯誤匯率計入總額。';}
    });
  };
  window.addEventListener('storage',e=>{if(finTrip&&e.key===finKey(finTrip))renderFinance(finTrip);});
})();
